#!/usr/bin/env node
/**
 * ONE MILLION WORDS — the longest story ever told, one dollar at a time.
 * Zero-dependency Node server: static frontend + JSON store + Stripe Checkout.
 *
 * Env:
 *   PORT                  (default 8753)
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

const PORT = Number(process.env.PORT || 8753);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'hello@example.com';
const DEMO = !STRIPE_KEY;

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const PRICE_CENTS = 100;        // $1 per word
const TARGET = 1000000;         // the story ends at word one million
const MAX_AUTHOR = 24;

// A word: optional opening quote, letters (with internal apostrophes/hyphens),
// up to two trailing punctuation marks. 24 chars max.
const WORD_RE = /^["“(]?[A-Za-z]+(?:['’-][A-Za-z]+)*[.,;:!?"”)…]{0,2}$/;

// ---------- storage ----------
let db;
function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try { db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { db = null; }
  // Demo words must never open the live story: archive and restart with the
  // editorial opening only.
  if (db && !DEMO && db.seededDemo) {
    fs.renameSync(DATA_FILE, DATA_FILE.replace(/\.json$/, `.demo-backup-${Date.now()}.json`));
    db = null;
  }
  if (!db) {
    db = { words: [], pending: {} };
    seedOpening();
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
function push(w, author, at) {
  db.words.push({ w, author: author || 'Anonymous', at: at || Date.now() });
}
function seedOpening() {
  const t = Date.now() - 30 * 86400000;
  for (const w of ['Once', 'upon', 'a', 'time,']) push(w, 'The Editors', t);
}
function seedDemo() {
  db.seededDemo = true;
  const demo = ('nobody on the internet could agree about anything, until a stranger ' +
    'appeared selling single words for one dollar each. The first buyer wrote her ' +
    'own name into history and grinned. Others followed, arguing in ink about ' +
    'whether the dragon should be friendly or simply misunderstood, and the story ' +
    'grew longer than anyone intended, which was, of course, the point.').split(' ');
  const authors = ['Mara V.', 'gregg', 'a poet, allegedly', 'Kim', 'wordsmith88', 'Anonymous', 'Deb from Ohio', 'T.', 'someone’s dad', 'inkwell_jones'];
  const t0 = Date.now() - 28 * 86400000;
  demo.forEach((w, i) => push(w, authors[i % authors.length], t0 + i * 9000000));
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
// Word-boundary matching avoids the Scunthorpe problem ("Scunthorpe" is a fine word
// for the story); collapsed-substring matching still catches slur evasion.
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
  push(p.w, p.author);
  p.fulfilled = true;
  p.result = db.words.length; // word number
  save();
  return p.result;
}

// ---------- rate limiting ----------
const buckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const b = buckets.get(ip) || { n: 0, t: now };
  if (now - b.t > 60000) { b.n = 0; b.t = now; }
  b.n++; buckets.set(ip, b);
  return b.n > 15;
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
  const authors = new Set(db.words.map(w => w.author.toLowerCase()));
  return {
    demo: DEMO,
    contact: CONTACT_EMAIL,
    priceCents: PRICE_CENTS,
    target: TARGET,
    count: db.words.length,
    authors: authors.size,
    words: db.words.slice(-5000), // most recent chapter of the scroll
    offset: Math.max(0, db.words.length - 5000),
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, BASE_URL);
  const ip = req.socket.remoteAddress || '?';
  try {
    if (req.method === 'GET' && url.pathname === '/api/state') return json(res, 200, publicState());

    // The full manuscript, paged from any point — nothing is ever unreadable.
    if (req.method === 'GET' && url.pathname === '/api/words') {
      const from = Math.max(0, Math.floor(Number(url.searchParams.get('from')) || 0));
      const limit = Math.min(5000, Math.max(1, Math.floor(Number(url.searchParams.get('limit')) || 2000)));
      return json(res, 200, { from, total: db.words.length, words: db.words.slice(from, from + limit) });
    }

    if (req.method === 'POST' && url.pathname === '/api/checkout') {
      if (db.words.length >= TARGET) return json(res, 400, { error: 'The story is complete. One million words. It is finished.' });
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      const w = String(body.w || '').trim();
      const author = String(body.author || '').trim().replace(/\s+/g, ' ').slice(0, MAX_AUTHOR);
      if (!w) return json(res, 400, { error: 'The story needs a word.' });
      if (w.length > 24) return json(res, 400, { error: 'One word, 24 characters or fewer.' });
      if (!WORD_RE.test(w)) return json(res, 400, { error: 'One single word — letters, with punctuation allowed at the end. No spaces, no numbers.' });
      if (blocked(w) || blocked(author)) return json(res, 400, { error: 'Not that word. The story deserves better.' });
      if (spammy(author)) return json(res, 400, { error: 'Sign with a name, not a link.' });
      if (rateLimited(ip)) return json(res, 429, { error: 'One word at a time, wordsmith.' });

      if (DEMO) {
        const sid = 'demo_' + crypto.randomUUID();
        db.pending[sid] = { w, author, createdAt: Date.now(), fulfilled: false };
        save();
        return json(res, 200, { url: `/api/demo-pay?sid=${sid}`, demo: true });
      }
      const params = new URLSearchParams({
        mode: 'payment',
        'line_items[0][quantity]': '1',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][unit_amount]': String(PRICE_CENTS),
        'line_items[0][price_data][product_data][name]': 'One Million Words — one word, set in ink',
        'line_items[0][price_data][product_data][description]': `Your word: "${w}"`,
        success_url: `${BASE_URL}/?sid={CHECKOUT_SESSION_ID}`,
        cancel_url: `${BASE_URL}/?canceled=1`,
        expires_at: String(Math.floor(Date.now() / 1000) + 1800),
      });
      const session = await stripePost('checkout/sessions', params);
      db.pending[session.id] = { w, author, createdAt: Date.now(), fulfilled: false };
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
      return json(res, 200, { ok: true, wordNumber: p.result, w: p.w, state: publicState() });
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
      const n = Number(body.wordNumber);
      if (n >= 1 && n <= db.words.length) {
        db.words[n - 1] = { ...db.words[n - 1], w: '[removed]' }; // redact, never renumber
        save();
      }
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
  console.log(`ONE MILLION WORDS listening on ${BASE_URL} ${DEMO ? '(DEMO MODE — payments simulated)' : '(LIVE — Stripe enabled)'}`);
});
