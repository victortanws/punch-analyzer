#!/usr/bin/env node
/**
 * RAINBOW BRIDGE — a gentle, permanent memorial meadow for companion animals.
 * $19 places a pet on the meadow forever; $29 "eternal" adds a candle + a longer story.
 * Every memorial is reviewed by a human before it appears. Zero-dependency Node server:
 * static frontend + sparse JSON store + Stripe Checkout.
 *
 * Env: PORT BASE_URL STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET ADMIN_TOKEN CONTACT_EMAIL
 *      DATA_DIR ALLOW_IMAGES(default on — pet photos are the point; still review-gated)
 */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 8755);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'victortanws@gmail.com';
const DEMO = !STRIPE_KEY;
// Pet photos ARE the product here and carry none of the human-likeness/CSAM exposure that
// forces images off elsewhere — but every photo is still human-reviewed before it appears.
const ALLOW_IMAGES = process.env.ALLOW_IMAGES ? process.env.ALLOW_IMAGES === '1' : true;

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const IMG_DIR = path.join(DATA_DIR, 'images');
const SEED_DIR = path.join(__dirname, 'seed');
const PUBLIC_DIR = path.join(__dirname, 'public');

const PRICE_PLACE = Number(process.env.PRICE_PLACE_CENTS || 1900);   // $19 to place
const PRICE_ETERNAL = Number(process.env.PRICE_ETERNAL_CENTS || 2900); // $29 eternal
const MAX_NAME = 40, MAX_WORDS = 280, MAX_WORDS_ETERNAL = 700, MAX_DATE = 24, MAX_BY = 40, MAX_EMAIL = 120;
const MAX_IMAGE_BYTES = 700 * 1024, MAX_PENDING_IMAGE_BYTES = 60 * 1024 * 1024;
const PER_PAGE = 24;
const SPECIES = ['dog', 'cat', 'bird', 'rabbit', 'horse', 'other'];

// ---------- helpers: ip, admin token, security headers ----------
function clientIp(req) {
  // Trust the RIGHTMOST X-Forwarded-For hop — the one the platform's own proxy appends.
  // The leftmost is client-supplied and trivially spoofable to defeat rate limiting.
  const xff = req.headers['x-forwarded-for'];
  if (xff) { const parts = String(xff).split(',').map(s => s.trim()).filter(Boolean); if (parts.length) return parts[parts.length - 1]; }
  return req.socket.remoteAddress || '?';
}
function tokenOk(provided) {
  if (!ADMIN_TOKEN || !provided) return false;
  const a = Buffer.from(String(provided)), b = Buffer.from(ADMIN_TOKEN);
  if (a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(a, b); } catch { return false; }
}
const CSP = "default-src 'self'; img-src 'self' data:; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; " +
  "script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; " +
  "form-action 'self' https://checkout.stripe.com";
function baseHeaders(extra) {
  const h = {
    'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': CSP,
  };
  if (!DEMO) h['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  return Object.assign(h, extra || {});
}

// ---------- storage ----------
let db;
function load() {
  fs.mkdirSync(IMG_DIR, { recursive: true });
  try { db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { db = null; }
  if (db && !DEMO && db.seededDemo) {
    fs.renameSync(DATA_FILE, DATA_FILE.replace(/\.json$/, `.demo-backup-${Date.now()}.json`));
    db = null;
  }
  if (!db) { db = { memorials: [], pending: {}, seq: 0 }; if (DEMO) seedDemo(); save(); }
  const now = Date.now();
  for (const [sid, p] of Object.entries(db.pending)) {
    if (!p.fulfilled && now - p.createdAt > 86400000) delete db.pending[sid];
    else if (p.fulfilled && now - p.createdAt > 30 * 86400000) delete db.pending[sid];
  }
  sweepImages();
}
function save() {
  const tmp = DATA_FILE + '.' + crypto.randomBytes(6).toString('hex') + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DATA_FILE);
}
function sweepImages() {
  const ref = new Set();
  for (const m of db.memorials) if (m.imageId) ref.add(m.imageId);
  for (const p of Object.values(db.pending)) if (p.imageId && !p.fulfilled) ref.add(p.imageId);
  try { for (const f of fs.readdirSync(IMG_DIR)) if (!ref.has(f)) { try { fs.unlinkSync(path.join(IMG_DIR, f)); } catch {} } } catch {}
}
function pendingImageBytes() {
  let t = 0;
  for (const p of Object.values(db.pending)) { if (p.fulfilled || !p.imageId) continue; try { t += fs.statSync(path.join(IMG_DIR, p.imageId)).size; } catch {} }
  return t;
}
// Drop unfulfilled checkouts older than an hour (sessions expire in 30 min), so abandoned
// uploads can't grow data.json unbounded or hog the pending-image budget. Returns true if changed.
function prunePending() {
  const now = Date.now(); let changed = false;
  for (const [sid, p] of Object.entries(db.pending)) {
    if (!p.fulfilled && now - p.createdAt > 3600000) { delete db.pending[sid]; changed = true; }
    else if (p.fulfilled && now - p.createdAt > 30 * 86400000) { delete db.pending[sid]; changed = true; }
  }
  return changed;
}
// On-volume rotating backups give a recovery point if data.json is ever cleared or a bad
// deploy resets state. (Off-volume snapshots — see DEPLOY docs — remain the real DR.)
function backup() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    fs.copyFileSync(DATA_FILE, path.join(DATA_DIR, `data.backup-${Date.now()}.json`));
    const backups = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('data.backup-')).sort();
    while (backups.length > 12) { try { fs.unlinkSync(path.join(DATA_DIR, backups.shift())); } catch {} }
  } catch {}
}
function seedDemo() {
  db.seededDemo = true;
  const now = Date.now();
  const seeds = [
    ['Biscuit', 'dog', '2009', '2023', 'The best boy. Fourteen years was not nearly enough. He waited by the door every single day.', 'Sam', 'eternal', 40],
    ['Luna', 'cat', '2011', '2024', 'She slept on my keyboard for twelve years. The typos were worth it.', 'Priya', 'eternal', 120],
    ['Rocket', 'dog', '2013', '2024', 'Fastest greyhound at the shelter. Slowest to leave my heart.', 'Dee', 'place', 33],
    ['Mochi', 'rabbit', '2018', '2023', 'A small, soft comma in a loud sentence of a life.', 'the Tan family', 'place', 60],
    ['Captain', 'dog', '2010', '2022', 'A very good dog. The best, in fact. He guarded the whole street and asked for nothing but belly rubs.', 'Marco', 'eternal', 200],
    ['Sunny', 'bird', '2015', '2024', 'Sang every morning whether we deserved it or not.', 'Rae', 'place', 15],
    ['Pepper', 'cat', '2007', '2021', 'Grumpy, magnificent, and entirely in charge.', 'the Okafor house', 'place', 9],
    ['Daisy', 'horse', '2004', '2023', 'She carried a nervous little girl for a decade and made her brave.', 'Elena', 'eternal', 75],
    ['Bandit', 'dog', '2014', '2024', 'Stole socks, hearts, and one entire roast chicken. Forgiven for all three.', 'the Lims', 'place', 5],
    ['Willow', 'cat', '2012', '2024', 'Quiet company through the hardest years. She knew before I did when I needed her.', 'Jo', 'eternal', 2],
  ];
  for (const [petName, species, birth, passing, words, litBy, tier, daysAgo] of seeds) {
    db.memorials.push({
      id: 'm' + (++db.seq), petName, species, birth, passing, words, litBy,
      tier, imageId: null, at: now - daysAgo * 86400000, approved: true,
    });
  }
}

// ---------- images (browser-resized; validated + content-scanned; review-gated) ----------
function storeImage(dataUrl) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw new Error('The photo must be a JPEG, PNG, or WebP.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length < 64) throw new Error('That photo appears to be empty.');
  if (buf.length > MAX_IMAGE_BYTES) throw new Error('The photo is too large — it is resized in your browser first, so this is unusual.');
  const isJpeg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
  const isWebp = buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';
  if ((m[1] === 'jpeg' && !isJpeg) || (m[1] === 'png' && !isPng) || (m[1] === 'webp' && !isWebp))
    throw new Error('That file is not a valid photo.');
  // Scan the WHOLE payload (it's <=700KB) for embedded markup — a partial scan gives false assurance.
  if (/<script|<html|<!doctype|<svg|<\?php|<iframe/.test(buf.toString('latin1').toLowerCase())) throw new Error('That file is not a valid photo.');
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const id = crypto.randomUUID() + '.' + ext;
  fs.writeFileSync(path.join(IMG_DIR, id), buf);
  return { id, bytes: buf.length };
}
const IMG_ID_RE = /^[a-z0-9-]+\.(jpg|png|webp)$/;

// ---------- moderation (gentle: this is a memorial; block only truly abusive text) ----------
const SUBSTRING_BAD = ['fuck', 'shit', 'faggot', 'nigger', 'nigga'];
const BOUNDARY_BAD = new Set(['cunt', 'kike', 'spic', 'chink', 'rape', 'raped', 'rapist', 'retard']);
const HOMO = { 'а': 'a', 'е': 'e', 'і': 'i', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'ѕ': 's', '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };
function fold(s) { return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[аеіорсухѕ013457@$]/g, c => HOMO[c] || c); }
function blocked(text) {
  const folded = fold(text), tokens = folded.split(/[^a-z]+/).filter(Boolean);
  const joined = []; let run = '';
  for (const t of tokens) { if (t.length === 1) run += t; else { if (run) { joined.push(run); run = ''; } joined.push(t); } }
  if (run) joined.push(run);
  const check = tokens.concat(joined);
  if (check.some(t => SUBSTRING_BAD.some(w => t.includes(w)))) return true;
  return check.some(t => BOUNDARY_BAD.has(t));
}
function spammy(text) {
  const s = String(text || '');
  if (/https?:\/\/|www\./i.test(s)) return true;
  if (/[a-z0-9-]+\.(com|net|org|io|xyz|ru|info|co|ai|shop|link|me|biz)\b/i.test(s.replace(/\s+/g, ''))) return true;
  if (/\bdot\s?(com|net|org|io|co|ai|shop)\b/i.test(s)) return true;
  if (/(^|\s)@[a-z0-9_]{3,}/i.test(s)) return true;
  return false;
}

// ---------- stripe ----------
async function stripePost(endpoint, params) {
  const res = await fetch('https://api.stripe.com/v1/' + endpoint, { method: 'POST', headers: { Authorization: `Bearer ${STRIPE_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
  const body = await res.json(); if (!res.ok) throw new Error(body.error?.message || 'Stripe error'); return body;
}
async function stripeGet(endpoint) {
  const res = await fetch('https://api.stripe.com/v1/' + endpoint, { headers: { Authorization: `Bearer ${STRIPE_KEY}` } });
  const body = await res.json(); if (!res.ok) throw new Error(body.error?.message || 'Stripe error'); return body;
}
function verifyStripeSignature(payload, header) {
  if (!WEBHOOK_SECRET || !header) return false;
  const parts = {}; const v1s = [];
  for (const kv of header.split(',')) { const [k, v] = kv.split('='); if (k === 'v1') v1s.push(v); else parts[k] = v; }
  if (!parts.t || Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(`${parts.t}.${payload}`).digest('hex');
  return v1s.some(v => { try { return crypto.timingSafeEqual(Buffer.from(v, 'hex'), Buffer.from(expected, 'hex')); } catch { return false; } });
}

// ---------- fulfillment (idempotent; new memorial is held for review) ----------
function fulfill(sid) {
  const p = db.pending[sid];
  if (!p || p.fulfilled) return;
  db.memorials.push({
    id: 'm' + (++db.seq), petName: p.petName, species: p.species, birth: p.birth, passing: p.passing,
    words: p.words, litBy: p.litBy, ownerEmail: p.ownerEmail || '', tier: p.tier, imageId: p.imageId || null,
    at: Date.now(), approved: false,
  });
  p.fulfilled = true; save();
}

// ---------- rate limiting ----------
const buckets = new Map();
function rateLimited(ip, max = 20) {
  const now = Date.now(); const b = buckets.get(ip) || { n: 0, t: now };
  if (now - b.t > 60000) { b.n = 0; b.t = now; }
  b.n++; buckets.set(ip, b); return b.n > max;
}
setInterval(() => { const now = Date.now(); for (const [ip, b] of buckets) if (now - b.t > 120000) buckets.delete(ip); }, 60000).unref?.();
setInterval(() => { try { if (prunePending()) save(); sweepImages(); } catch {} }, 5 * 60000).unref?.();
setInterval(() => { try { backup(); } catch {} }, 30 * 60000).unref?.();

// ---------- views ----------
function pubMemorial(m) {
  return { id: m.id, petName: m.petName, species: m.species, birth: m.birth, passing: m.passing, words: m.words, litBy: m.litBy, tier: m.tier, imageUrl: m.imageId ? '/img/' + m.imageId : null, at: m.at };
}
function approved() { return db.memorials.filter(m => m.approved); }
function isAnniversaryToday(m) {
  // Only flags when the passing date has a real month+day (a bare "2024" won't parse to today).
  if (!m.passing || !/\d.*\D.*\d/.test(m.passing)) return false;
  const d = new Date(m.passing);
  if (isNaN(d)) return false;
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
function publicState() {
  const list = approved();
  const today = list.filter(isAnniversaryToday).slice(0, 12).map(pubMemorial);
  return { demo: DEMO, contact: CONTACT_EMAIL, allowImages: ALLOW_IMAGES, species: SPECIES,
    prices: { place: PRICE_PLACE, eternal: PRICE_ETERNAL }, total: list.length, today };
}

// ---------- http ----------
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.ico': 'image/x-icon' };
function json(res, code, obj, extra) {
  const body = JSON.stringify(obj);
  res.writeHead(code, baseHeaders(Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, extra)));
  res.end(body);
}
function readBody(req, res, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0, done = false; const chunks = [];
    req.on('data', c => { if (done) return; size += c.length; if (size > limit) { done = true; chunks.length = 0; json(res, 413, { error: 'That request is too large.' }); resolve(null); } else chunks.push(c); });
    req.on('end', () => { if (!done) resolve(Buffer.concat(chunks)); });
    req.on('error', e => { if (!done) reject(e); });
  });
}
function cleanStr(v, max) { return String(v == null ? '' : v).trim().replace(/\s+/g, ' ').slice(0, max); }
function safeJson(str) { try { return JSON.parse(str || '{}'); } catch { return null; } }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, BASE_URL);
  const ip = clientIp(req);
  try {
    if (req.method === 'GET' && url.pathname === '/api/state') return json(res, 200, publicState());

    if (req.method === 'GET' && url.pathname === '/api/meadow') {
      const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
      let list = approved().sort((a, b) => b.at - a.at);
      if (q) list = list.filter(m => (m.petName + ' ' + (m.words || '') + ' ' + (m.litBy || '')).toLowerCase().includes(q));
      const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
      const page = Math.min(pages, Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1)));
      return json(res, 200, { q, page, pages, total: list.length, memorials: list.slice((page - 1) * PER_PAGE, page * PER_PAGE).map(pubMemorial) });
    }

    if (req.method === 'GET' && url.pathname === '/api/memorial') {
      const m = db.memorials.find(x => x.id === url.searchParams.get('id') && x.approved);
      if (!m) return json(res, 404, { error: 'not found' });
      return json(res, 200, { memorial: pubMemorial(m) });
    }

    if (req.method === 'GET' && url.pathname.startsWith('/img/')) {
      const id = url.pathname.slice(5), full = path.join(IMG_DIR, id);
      if (IMG_ID_RE.test(id) && fs.existsSync(full)) {
        res.writeHead(200, baseHeaders({ 'Content-Type': id.endsWith('.png') ? 'image/png' : id.endsWith('.webp') ? 'image/webp' : 'image/jpeg', 'Content-Disposition': 'inline', 'Cache-Control': 'public, max-age=86400' }));
        return fs.createReadStream(full).pipe(res);
      }
      return json(res, 404, { error: 'not found' });
    }

    if (req.method === 'POST' && url.pathname === '/api/checkout') {
      const raw = await readBody(req, res, 1600 * 1024); if (raw === null) return;
      const body = safeJson(raw.toString()); if (!body) return json(res, 400, { error: 'We couldn’t read that submission — please try again.' });
      const petName = cleanStr(body.petName, MAX_NAME);
      const species = SPECIES.includes(body.species) ? body.species : 'other';
      const birth = cleanStr(body.birth, MAX_DATE), passing = cleanStr(body.passing, MAX_DATE);
      const tier = body.tier === 'eternal' ? 'eternal' : 'place';
      // The eternal tier's promised "room for a longer story" is real: a higher word cap.
      const words = cleanStr(body.words, tier === 'eternal' ? MAX_WORDS_ETERNAL : MAX_WORDS);
      const litBy = cleanStr(body.litBy, MAX_BY);
      const ownerEmail = cleanStr(body.ownerEmail, MAX_EMAIL);
      const amountCents = tier === 'eternal' ? PRICE_ETERNAL : PRICE_PLACE;
      if (petName.length < 1) return json(res, 400, { error: 'Please tell us your companion’s name.' });
      if (blocked(petName) || blocked(words) || blocked(litBy)) return json(res, 400, { error: 'Please choose gentler words — this is a place of remembrance.' });
      if (spammy(words) || spammy(litBy)) return json(res, 400, { error: 'A memorial can’t contain links.' });
      if (ownerEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerEmail)) return json(res, 400, { error: 'That email doesn’t look right.' });
      if (rateLimited(ip)) return json(res, 429, { error: 'One moment, please.' });
      let imageId = null;
      if (body.image) {
        if (!ALLOW_IMAGES) return json(res, 400, { error: 'Photos aren’t being accepted right now.' });
        if (pendingImageBytes() > MAX_PENDING_IMAGE_BYTES) return json(res, 503, { error: 'We’re a little busy — please try again shortly.' });
        try { imageId = storeImage(body.image).id; } catch (e) { return json(res, 400, { error: e.message }); }
      }
      const memorial = { petName, species, birth, passing, words, litBy, ownerEmail, tier, imageId, amountCents, createdAt: Date.now(), fulfilled: false };
      if (DEMO) {
        const sid = 'demo_' + crypto.randomUUID();
        db.pending[sid] = memorial; save();
        return json(res, 200, { url: `/api/demo-pay?sid=${sid}`, demo: true });
      }
      const params = new URLSearchParams({
        mode: 'payment',
        'line_items[0][quantity]': '1',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][unit_amount]': String(amountCents),
        'line_items[0][price_data][product_data][name]': (tier === 'eternal' ? 'Rainbow Bridge — eternal memorial' : 'Rainbow Bridge — memorial'),
        'line_items[0][price_data][product_data][description]': `In loving memory of ${petName}`,
        success_url: `${BASE_URL}/?sid={CHECKOUT_SESSION_ID}`,
        cancel_url: `${BASE_URL}/?canceled=1`,
        expires_at: String(Math.floor(Date.now() / 1000) + 1800),
      });
      const session = await stripePost('checkout/sessions', params);
      db.pending[session.id] = memorial; save();
      return json(res, 200, { url: session.url });
    }

    if (req.method === 'GET' && url.pathname === '/api/demo-pay') {
      if (!DEMO) return json(res, 404, { error: 'not found' });
      const sid = url.searchParams.get('sid') || '';
      if (!db.pending[sid]) return json(res, 404, { error: 'unknown session' });
      fulfill(sid);
      res.writeHead(302, baseHeaders({ Location: `/?sid=${sid}` })); return res.end();
    }

    if (req.method === 'GET' && url.pathname === '/api/confirm') {
      const sid = url.searchParams.get('sid') || '', p = db.pending[sid];
      if (!p) return json(res, 404, { error: 'unknown session' });
      if (!p.fulfilled) {
        if (DEMO) return json(res, 402, { error: 'not paid' });
        const session = await stripeGet('checkout/sessions/' + encodeURIComponent(sid));
        if (session.payment_status !== 'paid') return json(res, 402, { error: 'not paid yet' });
        fulfill(sid);
      }
      return json(res, 200, { ok: true, pending: true, petName: p.petName });
    }

    if (req.method === 'POST' && url.pathname === '/webhook/stripe') {
      const rawBuf = await readBody(req, res, 1024 * 1024); if (rawBuf === null) return;
      const raw = rawBuf.toString();
      if (!verifyStripeSignature(raw, req.headers['stripe-signature'])) return json(res, 400, { error: 'bad signature' });
      const event = JSON.parse(raw);
      if (event.type === 'checkout.session.completed' && event.data.object.payment_status === 'paid') fulfill(event.data.object.id);
      return json(res, 200, { received: true });
    }

    // ----- Groundskeeper's desk (review queue + moderation) -----
    if (req.method === 'GET' && url.pathname === '/api/admin/pending') {
      if (!tokenOk(url.searchParams.get('token'))) return json(res, 403, { error: 'forbidden' });
      // Admin view includes the owner's email — it's the refund/removal contact for review.
      const pending = db.memorials.filter(m => !m.approved).sort((a, b) => a.at - b.at)
        .map(m => Object.assign(pubMemorial(m), { ownerEmail: m.ownerEmail || '' }));
      return json(res, 200, { pending, count: pending.length });
    }
    if (req.method === 'POST' && (url.pathname === '/api/admin/approve' || url.pathname === '/api/admin/reject')) {
      if (rateLimited(ip, 30)) return json(res, 429, { error: 'Slow down.' });
      const rawBuf = await readBody(req, res); if (rawBuf === null) return;
      const body = safeJson(rawBuf.toString()); if (!body) return json(res, 400, { error: 'bad request' });
      if (!tokenOk(body.token)) return json(res, 403, { error: 'forbidden' });
      const m = db.memorials.find(x => x.id === body.id && !x.approved);
      if (!m) return json(res, 404, { error: 'no such pending memorial' });
      if (url.pathname === '/api/admin/approve') { m.approved = true; console.log(`[admin] approve ${m.id} "${m.petName}" — ${new Date().toISOString()}`); }
      else { if (m.imageId) { try { fs.unlinkSync(path.join(IMG_DIR, m.imageId)); } catch {} } db.memorials = db.memorials.filter(x => x !== m); console.log(`[admin] reject ${m.id} "${m.petName}" — ${new Date().toISOString()}`); }
      save(); return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/admin/remove') {
      if (rateLimited(ip, 10)) return json(res, 429, { error: 'Slow down.' });
      const rawBuf = await readBody(req, res); if (rawBuf === null) return;
      const body = safeJson(rawBuf.toString()); if (!body) return json(res, 400, { error: 'bad request' });
      if (!tokenOk(body.token)) return json(res, 403, { error: 'forbidden' });
      const m = db.memorials.find(x => x.id === body.id);
      if (m) { if (m.imageId) { try { fs.unlinkSync(path.join(IMG_DIR, m.imageId)); } catch {} } db.memorials = db.memorials.filter(x => x !== m); console.log(`[admin] remove ${m.id} "${m.petName}" — ${new Date().toISOString()}`); save(); }
      return json(res, 200, { ok: true });
    }

    // static
    if (req.method === 'GET' || req.method === 'HEAD') {
      let file = url.pathname === '/' ? '/index.html' : url.pathname;
      file = path.normalize(file).replace(/^(\.\.[\/\\])+/, '');
      const full = path.join(PUBLIC_DIR, file);
      if (full.startsWith(PUBLIC_DIR) && fs.existsSync(full) && fs.statSync(full).isFile()) {
        res.writeHead(200, baseHeaders({ 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' }));
        if (req.method === 'HEAD') return res.end();
        return fs.createReadStream(full).pipe(res);
      }
    }
    json(res, 404, { error: 'not found' });
  } catch (e) { console.error('[error]', e && e.message); json(res, 500, { error: 'Something went wrong on our end. Please try again.' }); }
});

load();
server.listen(PORT, () => console.log(`RAINBOW BRIDGE listening on ${BASE_URL} ${DEMO ? '(DEMO MODE — payments simulated)' : '(LIVE — Stripe enabled)'}`));
