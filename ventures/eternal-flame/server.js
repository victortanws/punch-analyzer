#!/usr/bin/env node
/**
 * THE ETERNAL FLAME — a quiet wall of candles, each remembering someone.
 * Zero-dependency Node server: static frontend + JSON store + Stripe Checkout.
 *
 * Env:
 *   PORT                  (default 8752)
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

const PORT = Number(process.env.PORT || 8752);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'hello@example.com';
const DEMO = !STRIPE_KEY;

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const PRICE_CENTS = 900; // $9 to light a flame, permanently
const MAX_FOR = 40, MAX_DEDICATION = 240, MAX_BY = 32;

// ---------- storage ----------
let db;
function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try { db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { db = null; }
  // Demo candles must never appear on the live wall: archive and start clean.
  if (db && !DEMO && db.seededDemo) {
    fs.renameSync(DATA_FILE, DATA_FILE.replace(/\.json$/, `.demo-backup-${Date.now()}.json`));
    db = null;
  }
  if (!db) {
    db = { candles: [], pending: {}, seq: 0 };
    if (DEMO) seedDemo();
    save();
  }
  const now = Date.now();
  for (const [sid, p] of Object.entries(db.pending)) {
    if (!p.fulfilled && now - p.createdAt > 86400000) delete db.pending[sid];
    else if (p.fulfilled && now - p.createdAt > 30 * 86400000) delete db.pending[sid];
  }
}
function save() {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}
function seedDemo() {
  db.seededDemo = true;
  const seeds = [
    ['Margaret "Peggy" Olsen', 'You taught me that kindness costs nothing and is worth everything.', 'her granddaughter', 'person', 210],
    ['Biscuit', 'The best boy. Fourteen years was not enough.', 'Sam', 'pet', 180],
    ['Dad', 'I still reach for the phone to call you.', '', 'person', 150],
    ['Luna', 'She slept on my keyboard for twelve years. The typos were worth it.', 'Priya', 'pet', 120],
    ['Ernesto Rivera', 'Mi abuelo. He crossed an ocean so I could complain about wifi.', 'Marco', 'person', 96],
    ['Mrs. Whitfield, 3rd grade', 'You told me I could write. I never stopped.', 'a former student', 'person', 80],
    ['Ziggy', '', 'the Chen family', 'pet', 64],
    ['My brother Tom', 'Twenty-three years of arguments I would give anything to have again.', '', 'person', 51],
    ['Rocket', 'Fastest greyhound at the shelter. Slowest to leave my heart.', 'Dee', 'pet', 33],
    ['Grandma Ruth', 'Her recipes survive. Her laugh does not translate to paper.', 'Rachel', 'person', 20],
    ['The old oak on Miller Road', 'A tree, yes. But it was our tree.', 'the neighborhood', 'other', 9],
    ['Amara', 'Brief and bright, like all the best things.', 'her parents', 'person', 2],
  ];
  for (const [forName, dedication, litBy, kind, daysAgo] of seeds) {
    db.candles.push({ id: 'c' + (++db.seq), forName, dedication, litBy, kind, at: Date.now() - daysAgo * 86400000 });
  }
}

// ---------- moderation ----------
const SLUR_SUBSTRINGS = ['nigger', 'nigga', 'faggot'];
const BAD_TOKENS = new Set(['fuck', 'shit', 'cunt', 'kike', 'spic', 'chink', 'fag', 'fags', 'rape', 'raped', 'rapist']);
const BAD_PREFIXES = ['fuck', 'shit', 'cunt', 'retard', 'nigger', 'nigga', 'faggot'];
const HOMOGLYPHS = { 'а': 'a', 'е': 'e', 'і': 'i', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'ѕ': 's', '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };
function fold(s) {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[аеіорсухѕ013457@$]/g, c => HOMOGLYPHS[c] || c);
}
// Word-boundary matching so a cat named Spice or a grandfather named Draper is never
// scolded on a memorial site; collapsed-substring matching still catches slur evasion.
function blocked(text) {
  const folded = fold(text);
  if (SLUR_SUBSTRINGS.some(w => folded.replace(/[^a-z]/g, '').includes(w))) return true;
  return folded.split(/[^a-z]+/).some(t =>
    BAD_TOKENS.has(t) || BAD_PREFIXES.some(p => t.startsWith(p) && t.length - p.length <= 3));
}
function spammy(text) { return /https?:\/\/|www\.|\.(com|net|org|io|xyz|ru|info)\b/i.test(text); }

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
function fulfill(sid) {
  const p = db.pending[sid];
  if (!p || p.fulfilled) return p ? p.result : null;
  const candle = { id: 'c' + (++db.seq), forName: p.forName, dedication: p.dedication, litBy: p.litBy, kind: p.kind, at: Date.now() };
  db.candles.push(candle);
  p.fulfilled = true;
  p.result = candle.id;
  save();
  return candle.id;
}

// ---------- rate limiting ----------
const buckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const b = buckets.get(ip) || { n: 0, t: now };
  if (now - b.t > 60000) { b.n = 0; b.t = now; }
  b.n++; buckets.set(ip, b);
  return b.n > 20;
}

// ---------- http ----------
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}
function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function publicState() {
  return {
    demo: DEMO,
    contact: CONTACT_EMAIL,
    priceCents: PRICE_CENTS,
    candles: db.candles.slice(-800).reverse(), // newest first
    total: db.candles.length,
    hasMore: db.candles.length > 800,
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, BASE_URL);
  const ip = req.socket.remoteAddress || '?';
  try {
    if (req.method === 'GET' && url.pathname === '/api/state') return json(res, 200, publicState());

    // Every flame stays reachable forever: page back through the wall's history.
    if (req.method === 'GET' && url.pathname === '/api/candles') {
      const before = url.searchParams.get('before') || '';
      let end = db.candles.length;
      if (before) { const i = db.candles.findIndex(c => c.id === before); if (i >= 0) end = i; }
      const start = Math.max(0, end - 200);
      return json(res, 200, { candles: db.candles.slice(start, end).reverse(), hasMore: start > 0 });
    }

    if (req.method === 'POST' && url.pathname === '/api/checkout') {
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      const forName = String(body.forName || '').trim().replace(/\s+/g, ' ').slice(0, MAX_FOR);
      const dedication = String(body.dedication || '').trim().slice(0, MAX_DEDICATION);
      const litBy = String(body.litBy || '').trim().replace(/\s+/g, ' ').slice(0, MAX_BY);
      const kind = ['person', 'pet', 'other'].includes(body.kind) ? body.kind : 'person';
      if (forName.length < 1) return json(res, 400, { error: 'Please tell us who this flame is for.' });
      if (blocked(forName) || blocked(dedication) || blocked(litBy))
        return json(res, 400, { error: 'Please choose different words. This is a place of remembrance.' });
      if (spammy(forName) || spammy(dedication) || spammy(litBy))
        return json(res, 400, { error: 'Links cannot be part of a dedication here.' });
      if (rateLimited(ip)) return json(res, 429, { error: 'Please slow down.' });

      if (DEMO) {
        const sid = 'demo_' + crypto.randomUUID();
        db.pending[sid] = { forName, dedication, litBy, kind, createdAt: Date.now(), fulfilled: false };
        save();
        return json(res, 200, { url: `/api/demo-pay?sid=${sid}`, demo: true });
      }
      const params = new URLSearchParams({
        mode: 'payment',
        'line_items[0][quantity]': '1',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][unit_amount]': String(PRICE_CENTS),
        'line_items[0][price_data][product_data][name]': 'The Eternal Flame — light a flame',
        'line_items[0][price_data][product_data][description]': `In memory of ${forName}`,
        success_url: `${BASE_URL}/?sid={CHECKOUT_SESSION_ID}`,
        cancel_url: `${BASE_URL}/?canceled=1`,
        expires_at: String(Math.floor(Date.now() / 1000) + 1800),
      });
      const session = await stripePost('checkout/sessions', params);
      db.pending[session.id] = { forName, dedication, litBy, kind, createdAt: Date.now(), fulfilled: false };
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
        fulfill(sid);
      }
      return json(res, 200, { ok: true, id: p.result, state: publicState() });
    }

    if (req.method === 'POST' && url.pathname === '/webhook/stripe') {
      const raw = (await readBody(req, 1024 * 1024)).toString();
      if (!verifyStripeSignature(raw, req.headers['stripe-signature'])) return json(res, 400, { error: 'bad signature' });
      const event = JSON.parse(raw);
      if (event.type === 'checkout.session.completed' && event.data.object.payment_status === 'paid') fulfill(event.data.object.id);
      return json(res, 200, { received: true });
    }

    if (req.method === 'POST' && url.pathname === '/api/admin/remove') {
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      if (!ADMIN_TOKEN || body.token !== ADMIN_TOKEN) return json(res, 403, { error: 'forbidden' });
      db.candles = db.candles.filter(c => c.id !== String(body.id || ''));
      save();
      return json(res, 200, { ok: true });
    }

    // static
    if (req.method === 'GET') {
      let file = url.pathname === '/' ? '/index.html' : url.pathname;
      file = path.normalize(file).replace(/^(\.\.[\/\\])+/, '');
      const full = path.join(PUBLIC_DIR, file);
      if (full.startsWith(PUBLIC_DIR) && fs.existsSync(full) && fs.statSync(full).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
        return fs.createReadStream(full).pipe(res);
      }
    }
    json(res, 404, { error: 'not found' });
  } catch (e) {
    json(res, 500, { error: e.message || 'server error' });
  }
});

load();
server.listen(PORT, () => {
  console.log(`THE ETERNAL FLAME listening on ${BASE_URL} ${DEMO ? '(DEMO MODE — payments simulated)' : '(LIVE — Stripe enabled)'}`);
});
