#!/usr/bin/env node
/**
 * THE LEDGER OF VANITY — a public list of names, ranked purely by amount paid.
 * Zero-dependency Node server: static frontend + JSON store + Stripe Checkout.
 *
 * Env:
 *   PORT                  (default 8751)
 *   BASE_URL              public URL (default http://localhost:PORT)
 *   STRIPE_SECRET_KEY     absent => DEMO MODE (payments simulated)
 *   STRIPE_WEBHOOK_SECRET whsec_... (recommended in live mode)
 *   ADMIN_TOKEN           enables POST /api/admin/remove
 */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 8751);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'hello@example.com';
const DEMO = !STRIPE_KEY;
// Image uploads are OFF by default: accepting arbitrary user images with no content
// scanning is a serious legal exposure (copyright, likeness, illegal/shock content) for
// a solo operator. Opt in with ALLOW_IMAGES=1 only once a scanning + review process
// exists. Demo mode enables them so the showcase (with its seeded portrait) still works.
const ALLOW_IMAGES = process.env.ALLOW_IMAGES === '1' || DEMO;

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIN_CENTS = 100;               // $1 minimum tribute
const MAX_CENTS = 999900;            // $9,999 per single payment
const MAX_NAME = 32, MAX_MOTTO = 140; // motto = the message displayed to the world
const IMG_DIR = path.join(DATA_DIR, 'images');
const SEED_DIR = path.join(__dirname, 'seed');
const MAX_IMAGE_BYTES = 600 * 1024;  // decoded cap; client downsizes to ~512px JPEG
const MAX_PENDING_IMAGE_BYTES = 40 * 1024 * 1024; // total unpaid image bytes cap (anti disk-fill)
const PER_PAGE = 24;

// Client IP, trusting only the proxy's X-Forwarded-For (Railway terminates in front).
function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.socket.remoteAddress || '?';
}
// Constant-time token check that won't throw on length mismatch.
function tokenOk(provided) {
  if (!ADMIN_TOKEN || !provided) return false;
  const a = Buffer.from(String(provided)), b = Buffer.from(ADMIN_TOKEN);
  if (a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(a, b); } catch { return false; }
}
// Defense-in-depth headers on every response. script-src is 'self' because the page's
// JS lives in /app.js (no inline script); inline styles + Google Fonts are allowed.
const CSP = "default-src 'self'; img-src 'self' data:; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; " +
  "script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; " +
  "form-action 'self' https://checkout.stripe.com";
function baseHeaders(extra) {
  const h = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': CSP,
  };
  if (!DEMO) h['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  return Object.assign(h, extra || {});
}

// ---------- storage ----------
let db;
function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try { db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { db = null; }
  // Never let fictional demo payers appear on a live ledger: archive and start clean.
  if (db && !DEMO && db.seededDemo) {
    fs.renameSync(DATA_FILE, DATA_FILE.replace(/\.json$/, `.demo-backup-${Date.now()}.json`));
    db = null;
  }
  fs.mkdirSync(IMG_DIR, { recursive: true });
  if (!db) {
    db = { payments: [], pending: {} };
    if (DEMO) seedDemo();
    save();
  }
  const now = Date.now();
  for (const [sid, p] of Object.entries(db.pending)) {
    if (!p.fulfilled && now - p.createdAt > 86400000) delete db.pending[sid];
    else if (p.fulfilled && now - p.createdAt > 30 * 86400000) delete db.pending[sid];
  }
  sweepImages();
}
// Delete image files no payment or live pending checkout references. Runs at boot and on
// a timer, so unpaid/orphaned uploads can't accumulate on the volume between restarts.
function sweepImages() {
  const referenced = new Set();
  for (const p of db.payments) if (p.imageId) referenced.add(p.imageId);
  for (const p of Object.values(db.pending)) if (p.imageId && !p.fulfilled) referenced.add(p.imageId);
  try {
    for (const f of fs.readdirSync(IMG_DIR)) {
      if (!referenced.has(f)) { try { fs.unlinkSync(path.join(IMG_DIR, f)); } catch {} }
    }
  } catch {}
}
// Total bytes of images held by not-yet-paid checkouts — bounds the pre-payment disk-fill.
function pendingImageBytes() {
  let total = 0;
  for (const p of Object.values(db.pending)) {
    if (p.fulfilled || !p.imageId) continue;
    try { total += fs.statSync(path.join(IMG_DIR, p.imageId)).size; } catch {}
  }
  return total;
}
function save() {
  const tmp = DATA_FILE + '.' + crypto.randomBytes(6).toString('hex') + '.tmp'; // unique tmp: concurrent writes can't clobber
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DATA_FILE);
}
function seedDemo() {
  db.seededDemo = true;
  const now = Date.now();
  // Inaugural inscription (DEMO ONLY — archived before any live ledger). A photo, a
  // declaration, and a credible cumulative total from stacked tributes so the throne
  // reads as earned, not claimable for pocket change.
  let ronaldoImg = null;
  try {
    fs.copyFileSync(path.join(SEED_DIR, 'ronaldo.jpg'), path.join(IMG_DIR, 'seed-ronaldo.jpg'));
    ronaldoImg = 'seed-ronaldo.jpg';
  } catch { /* seed image missing — entry still seeds without it */ }
  // Largest tribute carries the displayed motto + image; the smaller ones just stack.
  // Seeds are pre-approved so the demo looks populated (real entries start pending).
  db.payments.push({ name: 'Cristiano Ronaldo', motto: 'Cristiano Ronaldo is the best footballer of all time.', amountCents: 22500, at: now - 6 * 86400000, sid: 'seed', imageId: ronaldoImg, approved: true });
  db.payments.push({ name: 'Cristiano Ronaldo', motto: '', amountCents: 9000, at: now - 3 * 86400000, sid: 'seed', approved: true });
  db.payments.push({ name: 'Cristiano Ronaldo', motto: '', amountCents: 5500, at: now - 1 * 86400000, sid: 'seed', approved: true });
  // A field of smaller tributes beneath him, so pagination and search have real data.
  const first = ['Marge', 'Deshawn', 'Ingrid', 'Paulo', 'Wendy', 'Viktor', 'Amara', 'Chip', 'Rosa', 'Hank',
    'Yuki', 'Bram', 'Cleo', 'Otis', 'Priya', 'Salvo', 'Nadia', 'Earl', 'Femi', 'Gwen'];
  const last = ['from accounting', 'the Bold', 'of Duluth', '(yes, that one)', 'the Unranked', 'II', 'the Patient',
    'who tried', 'the Modest', 'of the Internet', 'the Latecomer', 'Q.', 'the Frugal', 'the Undeterred', 'the Curious'];
  const mottos = ['I was here first-ish.', 'For the record: Messi.', 'My cat made me do it.', '',
    'This is my legacy now.', 'Worth every cent, probably.', '', 'Ranked at last.', 'Hi mom.',
    'I regret nothing.', '', 'Vanity? Never heard of her.', 'One dollar closer to glory.', '', 'The bottom is also a rank.'];
  const rand = (() => { let a = 77; return () => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648; }; })();
  const used = new Set(['cristiano ronaldo']);
  for (let i = 0; i < 60; i++) {
    let name = first[i % first.length] + ' ' + last[Math.floor(rand() * last.length)];
    while (used.has(name.toLowerCase())) name += ' Jr.'; // unique names: no accidental stacking above the throne
    used.add(name.toLowerCase());
    const cents = 100 + Math.floor(rand() * 15) * 25; // $1.00 – $4.75, all below the throne
    db.payments.push({
      name, motto: mottos[Math.floor(rand() * mottos.length)],
      amountCents: cents, at: now - Math.floor(rand() * 30) * 86400000, sid: 'seed', approved: true,
    });
  }
}

// ---------- images ----------
// Accepts a data URL, verifies magic bytes match a real image format, caps the size,
// writes it to disk, and returns the stored file id. Throws a user-facing Error.
function storeImage(dataUrl) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw new Error('The image must be a JPEG, PNG, or WebP.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length < 64) throw new Error('That image appears to be empty.');
  if (buf.length > MAX_IMAGE_BYTES) throw new Error('The image is too large — 600 KB at most (it is resized in your browser first, so this is unusual).');
  const isJpeg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
  const isWebp = buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';
  if ((m[1] === 'jpeg' && !isJpeg) || (m[1] === 'png' && !isPng) || (m[1] === 'webp' && !isWebp))
    throw new Error('That file is not a valid image.');
  // Magic bytes only prove the first bytes; scan the whole payload for embedded markup so
  // a valid-header polyglot carrying HTML/script can't be stored and later sniffed.
  // (This is a stopgap — a full decode+re-encode with an image library is the real fix.)
  const head = buf.slice(0, 4096).toString('latin1').toLowerCase();
  const tail = buf.slice(-2048).toString('latin1').toLowerCase();
  if (/<script|<html|<!doctype|<svg|<\?php|<iframe/.test(head + tail))
    throw new Error('That file is not a valid image.');
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const id = crypto.randomUUID() + '.' + ext;
  fs.writeFileSync(path.join(IMG_DIR, id), buf);
  return { id, bytes: buf.length };
}
const IMG_ID_RE = /^[a-z0-9-]+\.(jpg|png|webp)$/;

// ---------- ranking ----------
// Only approved payments appear on the public ledger and in the totals.
function ledger() {
  const byKey = new Map();
  for (const p of db.payments) {
    if (!p.approved) continue;
    const key = p.name.trim().toLowerCase();
    const e = byKey.get(key) || { name: p.name, motto: '', totalCents: 0, firstAt: p.at, lastAt: p.at, payments: 0, topCents: -1, topAt: 0 };
    e.totalCents += p.amountCents;
    e.payments++;
    e.firstAt = Math.min(e.firstAt, p.at);
    e.lastAt = Math.max(e.lastAt, p.at);
    // Displayed spelling, message, and image belong to the largest single tribute
    // (ties go to the most recent), so a $1 payment can never deface a $1,250
    // inscription. To change what your entry shows, match or exceed your own largest.
    if (p.amountCents > e.topCents || (p.amountCents === e.topCents && p.at >= e.topAt)) {
      e.topCents = p.amountCents; e.topAt = p.at; e.name = p.name; e.motto = p.motto || '';
      e.imageId = p.imageId || null;
    }
    byKey.set(key, e);
  }
  return [...byKey.values()].sort((a, b) => b.totalCents - a.totalCents || a.firstAt - b.firstAt);
}

// ---------- moderation ----------
// Two tiers, so we catch mid-word profanity without the Scunthorpe problem:
//  - SUBSTRING_BAD: safe to match anywhere (motherfucker, clusterfuck, shitshow, bullshit).
//  - BOUNDARY_BAD: appear inside innocent words (cunt→Scunthorpe, spic→auspicious,
//    chink→"chink in the armor"), so match only as a whole token or a prefix.
const SUBSTRING_BAD = ['fuck', 'shit', 'faggot', 'nigger', 'nigga'];
const BOUNDARY_BAD = new Set(['cunt', 'kike', 'spic', 'chink', 'fag', 'fags', 'rape', 'raped', 'rapist', 'retard']);
const BOUNDARY_PREFIX = ['cunt', 'retard'];
const SLUR_COLLAPSED = ['nigger', 'nigga', 'faggot']; // caught even across separators / homoglyphs
const HOMOGLYPHS = { 'а': 'a', 'е': 'e', 'і': 'i', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'ѕ': 's', '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };
function fold(s) {
  return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[аеіорсухѕ013457@$]/g, c => HOMOGLYPHS[c] || c);
}
function blocked(text) {
  const folded = fold(text);
  const tokens = folded.split(/[^a-z]+/).filter(Boolean);
  // Join runs of deliberately-separated single letters ("f u c k" / "f.u.c.k") into words,
  // WITHOUT merging normal adjacent words (so "Scunthorpe" stays intact).
  const joined = []; let run = '';
  for (const t of tokens) {
    if (t.length === 1) run += t;
    else { if (run) { joined.push(run); run = ''; } joined.push(t); }
  }
  if (run) joined.push(run);
  const check = tokens.concat(joined);
  if (check.some(t => SUBSTRING_BAD.some(w => t.includes(w)))) return true;
  if (check.some(t => BOUNDARY_BAD.has(t) || BOUNDARY_PREFIX.some(p => t.startsWith(p) && t.length - p.length <= 2))) return true;
  const letters = folded.replace(/[^a-z]/g, '');
  return SLUR_COLLAPSED.some(w => letters.includes(w));
}
// Broad "this is an advert / contact info" heuristic: any URL, any dotted TLD, phone
// numbers, @handles, and crypto wallet addresses. Deliberately aggressive — the Ledger
// is not a classifieds board.
function spammy(text) {
  const s = String(text || '');
  if (/https?:\/\/|www\./i.test(s)) return true;
  if (/\.[a-z]{2,}\b/i.test(s.replace(/\s+/g, '')) && /[a-z]/i.test(s)) {
    if (/[a-z0-9-]+\.(com|net|org|io|xyz|ru|info|co|ai|shop|gg|app|link|me|biz|store|site|online|dev|xyz|to|cc)\b/i.test(s.replace(/\s+/g, ''))) return true;
  }
  if (/\b\d[\d\s().-]{7,}\d\b/.test(s)) return true;                 // phone-ish number
  if (/(^|\s)@[a-z0-9_]{3,}/i.test(s)) return true;                  // @handle
  if (/\b(0x[a-f0-9]{20,}|[13bc][a-z0-9]{25,})\b/i.test(s)) return true; // crypto wallet
  if (/\bdot\s?(com|net|org|io|co|ai|gg)\b/i.test(s)) return true;   // "spam dot com"
  return false;
}

// ---------- stripe ----------
async function stripePost(endpoint, params) {
  const res = await fetch('https://api.stripe.com/v1/' + endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${STRIPE_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error?.message || 'Stripe error');
  return body;
}
async function stripeGet(endpoint) {
  const res = await fetch('https://api.stripe.com/v1/' + endpoint, { headers: { Authorization: `Bearer ${STRIPE_KEY}` } });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error?.message || 'Stripe error');
  return body;
}
function verifyStripeSignature(payload, header) {
  if (!WEBHOOK_SECRET || !header) return false;
  const parts = {}; const v1s = [];
  for (const kv of header.split(',')) { const [k, v] = kv.split('='); if (k === 'v1') v1s.push(v); else parts[k] = v; }
  if (!parts.t || Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(`${parts.t}.${payload}`).digest('hex');
  return v1s.some(v => { try { return crypto.timingSafeEqual(Buffer.from(v, 'hex'), Buffer.from(expected, 'hex')); } catch { return false; } });
}

// ---------- fulfillment ----------
// stripeAmount (when known, from webhook/session) is authoritative — "the number" is the
// product, so we record what Stripe actually charged, not the client-derived amount.
function fulfill(sid, stripeAmount) {
  const p = db.pending[sid];
  if (!p || p.fulfilled) return;
  const amountCents = Number.isFinite(stripeAmount) ? stripeAmount : p.amountCents;
  // Paid, but held for review — it does not appear on the public ledger until approved.
  db.payments.push({ name: p.name, motto: p.motto, imageId: p.imageId || null, amountCents, at: Date.now(), sid, approved: false });
  p.fulfilled = true;
  save();
}

// ---------- rate limiting ----------
const buckets = new Map();
function rateLimited(ip, max = 20) {
  const now = Date.now();
  const b = buckets.get(ip) || { n: 0, t: now };
  if (now - b.t > 60000) { b.n = 0; b.t = now; }
  b.n++; buckets.set(ip, b);
  return b.n > max;
}
setInterval(() => { // evict stale buckets so the map can't grow unbounded under IP churn
  const now = Date.now();
  for (const [ip, b] of buckets) if (now - b.t > 120000) buckets.delete(ip);
}, 60000).unref?.();

// ---------- http ----------
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.ico': 'image/x-icon' };
function json(res, code, obj, extra) {
  const body = JSON.stringify(obj);
  res.writeHead(code, baseHeaders(Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, extra)));
  res.end(body);
}
// On overflow: respond a clean 413 instead of destroying the socket.
function readBody(req, res, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0, done = false; const chunks = [];
    req.on('data', c => {
      if (done) return;
      size += c.length;
      if (size > limit) { done = true; chunks.length = 0; json(res, 413, { error: 'That request is too large.' }); resolve(null); }
      else chunks.push(c);
    });
    req.on('end', () => { if (!done) resolve(Buffer.concat(chunks)); });
    req.on('error', e => { if (!done) reject(e); });
  });
}

function publicState() {
  const entries = ledger();
  const t = entries[0];
  return {
    demo: DEMO,
    contact: CONTACT_EMAIL,
    allowImages: ALLOW_IMAGES,
    totalCents: db.payments.reduce((s, p) => s + (p.approved ? p.amountCents : 0), 0),
    names: entries.length,
    throneCents: t ? t.totalCents : 0,
    throne: t ? { name: t.name, motto: t.motto, totalCents: t.totalCents, firstAt: t.firstAt, imageUrl: t.imageId ? '/img/' + t.imageId : null } : null,
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, BASE_URL);
  const ip = clientIp(req);
  try {
    if (req.method === 'GET' && url.pathname === '/api/state') return json(res, 200, publicState());

    // Paginated, searchable roll of all entries, ranks preserved under search.
    if (req.method === 'GET' && url.pathname === '/api/entries') {
      const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
      const all = ledger().map((e, i) => ({
        rank: i + 1, name: e.name, motto: e.motto, totalCents: e.totalCents,
        firstAt: e.firstAt, payments: e.payments, imageUrl: e.imageId ? '/img/' + e.imageId : null,
      }));
      const filtered = q ? all.filter(e => (e.name + ' ' + e.motto).toLowerCase().includes(q)) : all;
      const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
      const page = Math.min(pages, Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1)));
      return json(res, 200, {
        q, page, pages, perPage: PER_PAGE, total: filtered.length,
        entries: filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE),
      });
    }

    // Stored entry images (ids are validated against a strict pattern).
    if (req.method === 'GET' && url.pathname.startsWith('/img/')) {
      const id = url.pathname.slice(5);
      const full = path.join(IMG_DIR, id);
      if (IMG_ID_RE.test(id) && fs.existsSync(full)) {
        res.writeHead(200, baseHeaders({
          'Content-Type': id.endsWith('.png') ? 'image/png' : id.endsWith('.webp') ? 'image/webp' : 'image/jpeg',
          'Content-Disposition': 'inline', 'Cache-Control': 'public, max-age=86400',
        }));
        return fs.createReadStream(full).pipe(res);
      }
      return json(res, 404, { error: 'not found' });
    }

    if (req.method === 'POST' && url.pathname === '/api/checkout') {
      const raw = await readBody(req, res, 1536 * 1024);
      if (raw === null) return; // 413 already sent
      const body = JSON.parse(raw.toString() || '{}');
      const name = String(body.name || '').trim().replace(/\s+/g, ' ').slice(0, MAX_NAME);
      const motto = String(body.motto || '').trim().replace(/\s+/g, ' ').slice(0, MAX_MOTTO);
      const amountCents = Math.round(Number(body.amountCents));
      if (name.length < 2) return json(res, 400, { error: 'A name of at least two characters is required. You are buying a name, after all.' });
      if (!Number.isFinite(amountCents) || amountCents < MIN_CENTS || amountCents > MAX_CENTS)
        return json(res, 400, { error: `Tribute must be between $1 and $9,999 per payment.` });
      if (blocked(name) || blocked(motto)) return json(res, 400, { error: 'The Ledger declines to inscribe that. Choose different words.' });
      if (spammy(name) || spammy(motto)) return json(res, 400, { error: 'The Ledger records names, not advertisements.' });
      if (rateLimited(ip)) return json(res, 429, { error: 'Slow down.' });
      let imageId = null;
      if (body.image) {
        if (!ALLOW_IMAGES) return json(res, 400, { error: 'Image inscriptions are not being accepted at this time.' });
        if (pendingImageBytes() > MAX_PENDING_IMAGE_BYTES) return json(res, 503, { error: 'Too many uploads in progress. Please try again shortly.' });
        try { imageId = storeImage(body.image).id; }
        catch (e) { return json(res, 400, { error: e.message }); }
      }

      if (DEMO) {
        const sid = 'demo_' + crypto.randomUUID();
        db.pending[sid] = { name, motto, imageId, amountCents, createdAt: Date.now(), fulfilled: false };
        save();
        return json(res, 200, { url: `/api/demo-pay?sid=${sid}`, demo: true });
      }
      const params = new URLSearchParams({
        mode: 'payment',
        'line_items[0][quantity]': '1',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][unit_amount]': String(amountCents),
        'line_items[0][price_data][product_data][name]': 'The Ledger of Vanity — tribute',
        'line_items[0][price_data][product_data][description]': `Inscribed as "${name}". This confers nothing.`,
        success_url: `${BASE_URL}/?sid={CHECKOUT_SESSION_ID}`,
        cancel_url: `${BASE_URL}/?canceled=1`,
        expires_at: String(Math.floor(Date.now() / 1000) + 1800),
      });
      const session = await stripePost('checkout/sessions', params);
      db.pending[session.id] = { name, motto, imageId, amountCents, createdAt: Date.now(), fulfilled: false };
      save();
      return json(res, 200, { url: session.url });
    }

    if (req.method === 'GET' && url.pathname === '/api/demo-pay') {
      if (!DEMO) return json(res, 404, { error: 'not found' });
      const sid = url.searchParams.get('sid') || '';
      if (!db.pending[sid]) return json(res, 404, { error: 'unknown session' });
      fulfill(sid);
      res.writeHead(302, { Location: `/?sid=${sid}` });
      return res.end();
    }

    if (req.method === 'GET' && url.pathname === '/api/confirm') {
      const sid = url.searchParams.get('sid') || '';
      const p = db.pending[sid];
      if (!p) return json(res, 404, { error: 'unknown session' });
      if (!p.fulfilled) {
        if (DEMO) return json(res, 402, { error: 'not paid' });
        const session = await stripeGet('checkout/sessions/' + encodeURIComponent(sid));
        if (session.payment_status !== 'paid') return json(res, 402, { error: 'not paid yet' });
        fulfill(sid, session.amount_total);
      }
      // Every new tribute is held for review, so tell the buyer it's pending rather than
      // showing a rank it hasn't earned on the public ledger yet.
      const rec = db.payments.find(x => x.sid === sid);
      if (rec && !rec.approved) return json(res, 200, { ok: true, pending: true, name: p.name });
      const entries = ledger();
      const rank = entries.findIndex(e => e.name.trim().toLowerCase() === p.name.trim().toLowerCase()) + 1;
      return json(res, 200, { ok: true, name: p.name, rank, state: publicState() });
    }

    if (req.method === 'POST' && url.pathname === '/webhook/stripe') {
      const rawBuf = await readBody(req, res, 1024 * 1024);
      if (rawBuf === null) return;
      const raw = rawBuf.toString();
      if (!verifyStripeSignature(raw, req.headers['stripe-signature'])) return json(res, 400, { error: 'bad signature' });
      const event = JSON.parse(raw);
      if (event.type === 'checkout.session.completed' && event.data.object.payment_status === 'paid')
        fulfill(event.data.object.id, event.data.object.amount_total);
      return json(res, 200, { received: true });
    }

    // ----- review queue -----
    if (req.method === 'GET' && url.pathname === '/api/admin/pending') {
      if (!tokenOk(url.searchParams.get('token'))) return json(res, 403, { error: 'forbidden' });
      const pending = db.payments.filter(p => !p.approved)
        .sort((a, b) => a.at - b.at)
        .map(p => ({ sid: p.sid, name: p.name, motto: p.motto, amountCents: p.amountCents, at: p.at, imageUrl: p.imageId ? '/img/' + p.imageId : null }));
      return json(res, 200, { pending, count: pending.length });
    }

    if (req.method === 'POST' && (url.pathname === '/api/admin/approve' || url.pathname === '/api/admin/reject')) {
      if (rateLimited(ip, 30)) return json(res, 429, { error: 'Slow down.' });
      const rawBuf = await readBody(req, res);
      if (rawBuf === null) return;
      const body = JSON.parse(rawBuf.toString() || '{}');
      if (!tokenOk(body.token)) return json(res, 403, { error: 'forbidden' });
      const rec = db.payments.find(p => p.sid === body.sid && !p.approved);
      if (!rec) return json(res, 404, { error: 'no such pending tribute' });
      if (url.pathname === '/api/admin/approve') {
        rec.approved = true;
        console.log(`[admin] approve sid=${body.sid} "${rec.name}" $${(rec.amountCents / 100).toFixed(2)} — ${new Date().toISOString()}`);
      } else {
        if (rec.imageId) { try { fs.unlinkSync(path.join(IMG_DIR, rec.imageId)); } catch {} }
        db.payments = db.payments.filter(p => p !== rec);
        console.log(`[admin] reject sid=${body.sid} "${rec.name}" — ${new Date().toISOString()}`);
      }
      save();
      return json(res, 200, { ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/api/admin/remove') {
      if (rateLimited(ip, 10)) return json(res, 429, { error: 'Slow down.' });
      const rawBuf = await readBody(req, res);
      if (rawBuf === null) return;
      const body = JSON.parse(rawBuf.toString() || '{}');
      if (!tokenOk(body.token)) return json(res, 403, { error: 'forbidden' });
      const key = String(body.name || '').trim().toLowerCase();
      const before = db.payments.length;
      db.payments = db.payments.filter(p => p.name.trim().toLowerCase() !== key);
      console.log(`[admin] remove "${key}" — ${before - db.payments.length} payment(s) — ${new Date().toISOString()}`);
      save(); sweepImages();
      return json(res, 200, { ok: true, removed: before - db.payments.length });
    }

    // Censorship lever the ToS reserves: strip an image (or a message) without
    // removing the paid inscription itself.
    if (req.method === 'POST' && url.pathname === '/api/admin/censor') {
      if (rateLimited(ip, 10)) return json(res, 429, { error: 'Slow down.' });
      const rawBuf = await readBody(req, res);
      if (rawBuf === null) return;
      const body = JSON.parse(rawBuf.toString() || '{}');
      if (!tokenOk(body.token)) return json(res, 403, { error: 'forbidden' });
      const key = String(body.name || '').trim().toLowerCase();
      let touched = 0;
      for (const p of db.payments) {
        if (p.name.trim().toLowerCase() !== key) continue;
        if (body.image !== false && p.imageId) { try { fs.unlinkSync(path.join(IMG_DIR, p.imageId)); } catch {} p.imageId = null; touched++; }
        if (body.motto === true && p.motto) { p.motto = ''; touched++; }
      }
      console.log(`[admin] censor "${key}" (image:${body.image !== false} motto:${body.motto === true}) — ${touched} change(s) — ${new Date().toISOString()}`);
      save();
      return json(res, 200, { ok: true, changed: touched });
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
  } catch (e) {
    json(res, 500, { error: e.message || 'server error' });
  }
});

load();
setInterval(() => { try { sweepImages(); } catch {} }, 5 * 60000).unref?.(); // reclaim orphaned/unpaid images at runtime
server.listen(PORT, () => {
  console.log(`THE LEDGER OF VANITY listening on ${BASE_URL} ${DEMO ? '(DEMO MODE — payments simulated)' : '(LIVE — Stripe enabled)'}${ALLOW_IMAGES ? '' : ' [images disabled]'}`);
});
