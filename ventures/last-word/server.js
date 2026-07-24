#!/usr/bin/env node
/**
 * THE LAST WORD — one sentence rules the page until someone pays more.
 * Zero-dependency Node server: static frontend + JSON store + Stripe Checkout.
 *
 * Env:
 *   PORT                  (default 8750)
 *   BASE_URL              public URL, e.g. https://thelastword.example (default http://localhost:PORT)
 *   STRIPE_SECRET_KEY     sk_live_... / sk_test_...  (absent => DEMO MODE, payments simulated)
 *   STRIPE_WEBHOOK_SECRET whsec_... (optional but recommended in live mode)
 *   ADMIN_TOKEN           enables POST /api/admin/remove for moderation
 */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 8750);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'hello@example.com';
const DEMO = !STRIPE_KEY;

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const BASE_PRICE_CENTS = 100;          // first word costs $1
const ESCALATION = 1.25;               // each dethroning costs 25% more
const MAX_TEXT = 140, MAX_NAME = 32;

// ---------- storage ----------
let db;
function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try { db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { db = null; }
  // Never let demo-seeded content leak into a live ledger: archive it and start clean.
  if (db && !DEMO && db.seededDemo) {
    fs.renameSync(DATA_FILE, DATA_FILE.replace(/\.json$/, `.demo-backup-${Date.now()}.json`));
    db = null;
  }
  if (!db) {
    db = { current: null, history: [], pending: {}, seq: 0 };
    if (DEMO) seedDemo();
    else db.current = record('Every empire begins with a single sentence.', 'The Proprietor', BASE_PRICE_CENTS);
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
function record(text, author, amountCents) {
  return { id: 'w' + (++db.seq), text, author: author || 'Anonymous', amountCents, at: Date.now() };
}
function seedDemo() {
  db.seededDemo = true;
  const seeds = [
    ['Every empire begins with a single sentence.', 'The Proprietor', 100],
    ['I paid a dollar twenty-five to correct him.', 'Mara V.', 125],
    ['This is the most expensive typo I will ever make.', 'gregg', 160],
    ['My startup died so this sentence could live.', 'a founder, retired', 200],
  ];
  for (const [t, a, c] of seeds) {
    if (db.current) db.history.push(db.current);
    db.current = record(t, a, c);
    db.current.at = Date.now() - (seeds.length - db.seq) * 86400000;
  }
}

// ---------- pricing ----------
function nextPriceCents() {
  if (!db.current) return BASE_PRICE_CENTS;
  return Math.ceil((db.current.amountCents * ESCALATION) / 25) * 25; // tidy 25¢ steps
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
// Word-boundary matching avoids the Scunthorpe problem (Spice, Draper, Matsushita
// stay welcome); collapsed-substring matching still catches spaced-out slurs.
function blocked(text) {
  const folded = fold(text);
  if (SLUR_SUBSTRINGS.some(w => folded.replace(/[^a-z]/g, '').includes(w))) return true;
  return folded.split(/[^a-z]+/).some(t =>
    BAD_TOKENS.has(t) || BAD_PREFIXES.some(p => t.startsWith(p) && t.length - p.length <= 3));
}
function spammy(text) { return /https?:\/\/|www\.|\.(com|net|org|io|xyz|ru|info)\b/i.test(text); }

// ---------- stripe (REST via fetch, no SDK) ----------
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
  const parts = {};
  const v1s = [];
  for (const kv of header.split(',')) {
    const [k, v] = kv.split('=');
    if (k === 'v1') v1s.push(v); else parts[k] = v;
  }
  if (!parts.t || Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(`${parts.t}.${payload}`).digest('hex');
  return v1s.some(v => {
    try { return crypto.timingSafeEqual(Buffer.from(v, 'hex'), Buffer.from(expected, 'hex')); } catch { return false; }
  });
}

// ---------- fulfillment (idempotent) ----------
function fulfill(sid) {
  const p = db.pending[sid];
  if (!p || p.fulfilled) return p ? p.result : null;
  if (db.current) db.history.push(db.current);
  db.current = record(p.text, p.author, p.amountCents);
  p.fulfilled = true;
  p.result = db.current.id;
  save();
  return db.current.id;
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
    current: db.current,
    nextPriceCents: nextPriceCents(),
    history: db.history.slice(-50).reverse(),
    reigns: db.history.length + (db.current ? 1 : 0),
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, BASE_URL);
  const ip = req.socket.remoteAddress || '?';
  try {
    if (req.method === 'GET' && url.pathname === '/api/state') return json(res, 200, publicState());

    if (req.method === 'POST' && url.pathname === '/api/checkout') {
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      const text = String(body.text || '').trim().replace(/\s+/g, ' ');
      const author = String(body.author || '').trim().slice(0, MAX_NAME);
      if (text.length < 1 || text.length > MAX_TEXT) return json(res, 400, { error: `Your sentence must be 1–${MAX_TEXT} characters.` });
      if (blocked(text) || blocked(author)) return json(res, 400, { error: 'That language won’t be immortalized here. Try again.' });
      if (spammy(text) || spammy(author)) return json(res, 400, { error: 'Links and URLs aren’t words worth ruling with. Say something instead.' });
      if (rateLimited(ip)) return json(res, 429, { error: 'Slow down.' });
      const amountCents = nextPriceCents();

      if (DEMO) {
        const sid = 'demo_' + crypto.randomUUID();
        db.pending[sid] = { text, author, amountCents, createdAt: Date.now(), fulfilled: false };
        save();
        return json(res, 200, { url: `/api/demo-pay?sid=${sid}`, demo: true });
      }
      const sid_placeholder = '{CHECKOUT_SESSION_ID}';
      const params = new URLSearchParams({
        mode: 'payment',
        'line_items[0][quantity]': '1',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][unit_amount]': String(amountCents),
        'line_items[0][price_data][product_data][name]': 'The Last Word — your sentence takes the page',
        'line_items[0][price_data][product_data][description]': `"${text.slice(0, 80)}"`,
        success_url: `${BASE_URL}/?sid=${sid_placeholder}`,
        cancel_url: `${BASE_URL}/?canceled=1`,
        // Sessions die after 30 min so a checkout link can't be hoarded and redeemed
        // days later at a stale (cheaper) price.
        expires_at: String(Math.floor(Date.now() / 1000) + 1800),
      });
      const session = await stripePost('checkout/sessions', params);
      db.pending[session.id] = { text, author, amountCents, createdAt: Date.now(), fulfilled: false };
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
      const id = String(body.id || '');
      if (db.current && db.current.id === id) {
        db.current = db.history.pop() || record('The page stands empty. For now.', 'The Proprietor', BASE_PRICE_CENTS);
      } else {
        db.history = db.history.filter(h => h.id !== id);
      }
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
  console.log(`THE LAST WORD listening on ${BASE_URL} ${DEMO ? '(DEMO MODE — payments simulated)' : '(LIVE — Stripe enabled)'}`);
});
