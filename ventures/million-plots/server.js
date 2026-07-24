#!/usr/bin/env node
/**
 * A MILLION PLOTS — a virtual cemetery of 1,000,000 grave plots (a 1000×1000 grid).
 * Each plot (one pixel) is unclaimed until won at a timed ascending auction; once paid
 * for, it is owned permanently and bears a memorial. No one can auction a claimed plot.
 *
 * Zero-dependency Node server: canvas frontend + sparse JSON store + Stripe Checkout.
 *
 * Auction model (all durations overridable via env for testing):
 *   - First bid (>= FLOOR) on an unclaimed plot opens an auction that runs AUCTION_MS.
 *   - Each further bid must beat the current top by minNext(); the top bidder can't re-bid.
 *   - A bid inside the final SNIPE_MS extends the close to now+SNIPE_MS (anti-sniping).
 *   - When the timer ends, the auction enters "awaiting_claim": the winner has CLAIM_MS
 *     to pay their winning bid (via Stripe) and set the memorial. Payment => owned.
 *   - If the winner doesn't pay in time, the next-highest eligible bidder is promoted
 *     (with a fresh claim window); if none remain, the plot returns to unclaimed.
 *
 * Env: PORT BASE_URL STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET ADMIN_TOKEN CONTACT_EMAIL DATA_DIR
 *      FLOOR_CENTS MIN_INCREMENT_CENTS AUCTION_MS SNIPE_MS CLAIM_MS CHECKOUT_GRACE_MS SEED_DEMO
 */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 8754);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'hello@example.com';
const DEMO = !STRIPE_KEY;

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const DIM = 1000;                 // 1000 × 1000 = 1,000,000 plots
const TOTAL = DIM * DIM;
const FLOOR_CENTS = Number(process.env.FLOOR_CENTS || 500);          // $5 opening bid
const MIN_INCREMENT_CENTS = Number(process.env.MIN_INCREMENT_CENTS || 100);
const MAX_CENTS = 5000000;        // $50,000 sanity cap on a single bid
const AUCTION_MS = Number(process.env.AUCTION_MS || 3 * 86400000);   // 3 days
const SNIPE_MS = Number(process.env.SNIPE_MS || 5 * 60000);          // 5 min soft close
const CLAIM_MS = Number(process.env.CLAIM_MS || 24 * 3600000);       // 24 h to pay
const CHECKOUT_GRACE_MS = Number(process.env.CHECKOUT_GRACE_MS || 35 * 60000);
const SEED_DEMO = process.env.SEED_DEMO ? process.env.SEED_DEMO === '1' : DEMO;

// Headstone palette (index → hex). Kept small so the state payload stays compact.
const PALETTE = ['#9a9a9a', '#c7c2b4', '#6b7d6a', '#5b6a86', '#b08d57', '#a06b6b', '#c9a961', '#3a3a3f'];
const AUCTION_COLOR = '#e8b23f';
const CLAIMING_COLOR = '#8a6a2a';

const MAX_NAME = 40, MAX_EPITAPH = 140, MAX_DATE = 24, MAX_DISPLAY = 32, MAX_TOKEN = 80;

// ---------- storage (sparse: only non-empty plots are stored) ----------
let db;
function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try { db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { db = null; }
  if (db && !DEMO && db.seededDemo) {
    fs.renameSync(DATA_FILE, DATA_FILE.replace(/\.json$/, `.demo-backup-${Date.now()}.json`));
    db = null;
  }
  if (!db) {
    db = { owned: {}, auctions: {}, pending: {} };
    if (SEED_DEMO) seedDemo();
    save();
  }
  sweepAll(Date.now());
}
let saveScheduled = false;
function save() {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DATA_FILE);
}
function seedDemo() {
  db.seededDemo = true;
  const now = Date.now();
  const rand = mulberry32(1234);
  // A settled cluster of memorials near the centre, so the acre looks tended.
  const memorials = [
    ['Eleanor R. Whitmore', '1931', '2019', 'She planted trees she knew she would never sit beneath.'],
    ['Captain', '2009', '2023', 'A very good dog. The best, in fact.'],
    ['Tomás Delgado', '1955', '2021', 'Every song he sang, he sang too loudly. We miss it.'],
    ['Baby Wren', '', '2022', 'Small hands, held briefly, remembered always.'],
    ['Professor A. Nkemelu', '1948', '2020', 'He answered every question with three better ones.'],
    ['Marguerite', '1940', '2018', 'Danced at ninety. Complained about the band.'],
    ['Old Pete', '1962', '2024', 'Fixed everyone’s roof but his own.'],
    ['Yuki', '2011', '2024', 'The cat who owned us.'],
  ];
  let mi = 0;
  for (let dy = 0; dy < 12; dy++) {
    for (let dx = 0; dx < 16; dx++) {
      if (rand() > 0.55) continue;
      const x = 492 + dx, y = 494 + dy, idx = y * DIM + x;
      const m = memorials[mi % memorials.length]; mi++;
      db.owned[idx] = {
        owner: 'seed', name: m[0], birth: m[1], death: m[2], epitaph: m[3],
        color: (mi % PALETTE.length), priceCents: 500 + Math.floor(rand() * 4000),
        at: now - Math.floor(rand() * 120) * 86400000,
      };
    }
  }
  // A few live auctions nearby, so visitors see the mechanic in motion.
  const liveSpots = [[520, 500], [521, 500], [500, 512], [485, 506], [530, 495]];
  liveSpots.forEach(([x, y], i) => {
    const idx = y * DIM + x;
    if (db.owned[idx]) return;
    const top = FLOOR_CENTS + (i + 1) * 700;
    db.auctions[idx] = {
      status: 'active', topCents: top, topBidder: 'seed_bidder_' + i, topName: ['A. Mourner', 'Kestrel', 'the family', 'R.', 'anon'][i],
      endsAt: now + (2 + i) * 3600000, startedAt: now - 3600000, bidCount: i + 2,
      history: [
        { bidder: 'seed_x', name: 'opening', cents: FLOOR_CENTS, at: now - 3600000 },
        { bidder: 'seed_bidder_' + i, name: ['A. Mourner', 'Kestrel', 'the family', 'R.', 'anon'][i], cents: top, at: now - 60000 },
      ],
      defaulted: [], pendingSid: null,
    };
  });
}
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- auction logic ----------
function minNext(cur) {
  const bump = Math.max(MIN_INCREMENT_CENTS, Math.ceil(cur * 0.05));
  return cur + bump;
}
function highestEligible(a) {
  let best = null;
  for (const h of a.history) {
    if (a.defaulted.includes(h.bidder)) continue;
    if (!best || h.cents > best.cents || (h.cents === best.cents && h.at < best.at)) best = h;
  }
  return best;
}
// One state-machine transition. Claim windows are anchored to the real auction end
// (endsAt) and chained (claimBy + CLAIM_MS), not to when we happen to observe them —
// so lazy settlement yields the same result as a perfectly punctual one.
function settleStep(idx, now) {
  const a = db.auctions[idx];
  if (!a) return false;
  if (a.status === 'active' && now >= a.endsAt) {
    a.status = 'awaiting_claim';
    a.claimBy = a.endsAt + CLAIM_MS;
    a.pendingSid = null;
    return true;
  }
  if (a.status === 'awaiting_claim' && now >= a.claimBy) {
    // Don't evict a winner who has an in-flight checkout that hasn't timed out yet.
    const p = a.pendingSid && db.pending[a.pendingSid];
    if (p && !p.fulfilled && now - p.createdAt < CHECKOUT_GRACE_MS) return false;
    a.defaulted.push(a.topBidder);
    const next = highestEligible(a);
    if (!next) { delete db.auctions[idx]; return true; }
    a.topBidder = next.bidder; a.topName = next.name; a.topCents = next.cents;
    a.claimBy = a.claimBy + CLAIM_MS; a.pendingSid = null;
    return true;
  }
  return false;
}
// Advance an auction through as many transitions as elapsed time warrants (bounded by
// the number of bidders, so it always terminates). Returns true if anything changed.
function settle(idx, now) {
  let changed = false;
  for (let i = 0; i < 64; i++) { if (!settleStep(idx, now)) break; changed = true; }
  return changed;
}
function sweepAll(now) {
  let changed = false;
  for (const idx of Object.keys(db.auctions)) changed = settle(Number(idx), now) || changed;
  if (changed) save();
}

// ---------- moderation ----------
const SLUR_SUBSTRINGS = ['nigger', 'nigga', 'faggot'];
const BAD_TOKENS = new Set(['fuck', 'shit', 'cunt', 'kike', 'spic', 'chink', 'fag', 'fags', 'rape', 'raped', 'rapist']);
const BAD_PREFIXES = ['fuck', 'shit', 'cunt', 'retard', 'nigger', 'nigga', 'faggot'];
const HOMOGLYPHS = { 'а': 'a', 'е': 'e', 'і': 'i', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'ѕ': 's', '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };
function foldStr(s) {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[аеіорсухѕ013457@$]/g, c => HOMOGLYPHS[c] || c);
}
function blocked(text) {
  const folded = foldStr(text || '');
  if (SLUR_SUBSTRINGS.some(w => folded.replace(/[^a-z]/g, '').includes(w))) return true;
  return folded.split(/[^a-z]+/).some(t =>
    BAD_TOKENS.has(t) || BAD_PREFIXES.some(p => t.startsWith(p) && t.length - p.length <= 3));
}
function spammy(text) { return /https?:\/\/|www\.|\.(com|net|org|io|xyz|ru|info)\b/i.test(text || ''); }

// ---------- stripe ----------
async function stripePost(endpoint, params) {
  const res = await fetch('https://api.stripe.com/v1/' + endpoint, {
    method: 'POST', headers: { Authorization: `Bearer ${STRIPE_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString(),
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

// ---------- fulfillment (idempotent) ----------
function fulfill(sid) {
  const p = db.pending[sid];
  if (!p || p.fulfilled) return p ? p.result : null;
  const idx = p.index;
  if (db.owned[idx]) {
    // Extremely rare: the plot was claimed by someone else while this checkout was open.
    // Do not create a second owner; flag for a manual refund instead.
    p.fulfilled = true; p.conflict = true; p.result = null; save();
    return null;
  }
  db.owned[idx] = {
    owner: p.bidderToken, name: p.name, birth: p.birth, death: p.death, epitaph: p.epitaph,
    color: p.color, priceCents: p.amountCents, at: Date.now(),
  };
  delete db.auctions[idx];
  p.fulfilled = true; p.result = idx; save();
  return idx;
}

// ---------- rate limiting ----------
const buckets = new Map();
function rateLimited(ip, max = 30) {
  const now = Date.now();
  const b = buckets.get(ip) || { n: 0, t: now };
  if (now - b.t > 60000) { b.n = 0; b.t = now; }
  b.n++; buckets.set(ip, b);
  return b.n > max;
}

// ---------- views ----------
function xy(idx) { return { x: idx % DIM, y: Math.floor(idx / DIM) }; }
function inRange(idx) { return Number.isInteger(idx) && idx >= 0 && idx < TOTAL; }

function publicState() {
  const owned = [];
  for (const [idx, o] of Object.entries(db.owned)) owned.push([Number(idx), o.color]);
  const auctions = [];
  for (const [idx, a] of Object.entries(db.auctions)) {
    auctions.push([Number(idx), a.topCents, a.status === 'active' ? a.endsAt : 0, a.bidCount, a.status === 'active' ? 1 : 2]);
  }
  return {
    demo: DEMO, contact: CONTACT_EMAIL, dim: DIM, total: TOTAL, now: Date.now(),
    floorCents: FLOOR_CENTS, palette: PALETTE, auctionColor: AUCTION_COLOR, claimingColor: CLAIMING_COLOR,
    counts: { owned: owned.length, auctions: auctions.length, unclaimed: TOTAL - owned.length - auctions.length },
    owned, auctions,
  };
}
function plotView(idx, token) {
  const now = Date.now();
  settle(idx, now);
  const pos = xy(idx);
  const o = db.owned[idx];
  if (o) {
    return {
      index: idx, x: pos.x, y: pos.y, status: 'owned', now,
      memorial: { name: o.name, birth: o.birth, death: o.death, epitaph: o.epitaph, color: o.color, priceCents: o.priceCents, at: o.at },
    };
  }
  const a = db.auctions[idx];
  if (!a) return { index: idx, x: pos.x, y: pos.y, status: 'unclaimed', floorCents: FLOOR_CENTS, now };
  const youAreTop = token && a.topBidder === token;
  return {
    index: idx, x: pos.x, y: pos.y, status: a.status, now,
    auction: {
      topCents: a.topCents, topName: a.topName, bidCount: a.bidCount,
      endsAt: a.status === 'active' ? a.endsAt : null,
      claimBy: a.status === 'awaiting_claim' ? a.claimBy : null,
      minNextCents: minNext(a.topCents),
      youAreTop: !!youAreTop,
      youWon: a.status === 'awaiting_claim' && !!youAreTop,
      history: a.history.slice(-12).reverse().map(h => ({ name: h.name, cents: h.cents, at: h.at })),
    },
  };
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
function cleanStr(v, max) { return String(v == null ? '' : v).trim().replace(/\s+/g, ' ').slice(0, max); }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, BASE_URL);
  const ip = req.socket.remoteAddress || '?';
  try {
    const now = Date.now();
    if (req.method === 'GET' && url.pathname === '/api/state') { sweepAll(now); return json(res, 200, publicState()); }

    if (req.method === 'GET' && url.pathname === '/api/plot') {
      const idx = Number(url.searchParams.get('index'));
      if (!inRange(idx)) return json(res, 400, { error: 'That plot does not exist.' });
      return json(res, 200, plotView(idx, url.searchParams.get('token') || ''));
    }

    // Plots this bidder is involved with, so they can return to bid or claim.
    if (req.method === 'GET' && url.pathname === '/api/mine') {
      const token = cleanStr(url.searchParams.get('token'), MAX_TOKEN);
      sweepAll(now);
      const bidding = [], toClaim = [], owned = [];
      if (token && token.length >= 8) {
        for (const [i, a] of Object.entries(db.auctions)) {
          const idx = Number(i);
          if (a.status === 'active' && a.history.some(h => h.bidder === token))
            bidding.push({ index: idx, topCents: a.topCents, youAreTop: a.topBidder === token, endsAt: a.endsAt });
          else if (a.status === 'awaiting_claim' && a.topBidder === token)
            toClaim.push({ index: idx, topCents: a.topCents, claimBy: a.claimBy });
        }
        for (const [i, o] of Object.entries(db.owned)) if (o.owner === token) owned.push({ index: Number(i), name: o.name });
      }
      return json(res, 200, { now: Date.now(), bidding, toClaim, owned });
    }

    if (req.method === 'POST' && url.pathname === '/api/bid') {
      if (rateLimited(ip)) return json(res, 429, { error: 'Too many bids too quickly. A moment, please.' });
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      const idx = Number(body.index);
      const amountCents = Math.round(Number(body.amountCents));
      const token = cleanStr(body.bidderToken, MAX_TOKEN);
      const name = cleanStr(body.displayName, MAX_DISPLAY) || 'Anonymous';
      if (!inRange(idx)) return json(res, 400, { error: 'That plot does not exist.' });
      if (!token || token.length < 8) return json(res, 400, { error: 'Missing bidder identity.' });
      if (!Number.isFinite(amountCents) || amountCents < FLOOR_CENTS || amountCents > MAX_CENTS)
        return json(res, 400, { error: `Bids must be between $${(FLOOR_CENTS / 100).toFixed(0)} and $${(MAX_CENTS / 100).toLocaleString()}.` });
      if (blocked(name) || spammy(name)) return json(res, 400, { error: 'Please choose a different bidder name.' });

      settle(idx, now);
      if (db.owned[idx]) return json(res, 409, { error: 'This plot has been laid to rest. It can never be auctioned again.' });
      let a = db.auctions[idx];
      if (!a) {
        a = db.auctions[idx] = {
          status: 'active', topCents: amountCents, topBidder: token, topName: name,
          endsAt: now + AUCTION_MS, startedAt: now, bidCount: 1,
          history: [{ bidder: token, name, cents: amountCents, at: now }], defaulted: [], pendingSid: null,
        };
        save();
        return json(res, 200, { ok: true, opened: true, plot: plotView(idx, token) });
      }
      if (a.status !== 'active') return json(res, 409, { error: 'This auction has ended and its winner is claiming the plot.' });
      if (a.topBidder === token) return json(res, 409, { error: 'You already hold the highest bid here.' });
      const need = minNext(a.topCents);
      if (amountCents < need) return json(res, 409, { error: `The next bid must be at least $${(need / 100).toFixed(2)}.`, minNextCents: need });
      a.topCents = amountCents; a.topBidder = token; a.topName = name; a.bidCount++;
      a.history.push({ bidder: token, name, cents: amountCents, at: now });
      if (a.endsAt - now < SNIPE_MS) a.endsAt = now + SNIPE_MS; // anti-snipe soft close
      save();
      return json(res, 200, { ok: true, plot: plotView(idx, token) });
    }

    if (req.method === 'POST' && url.pathname === '/api/claim') {
      if (rateLimited(ip)) return json(res, 429, { error: 'One moment, please.' });
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      const idx = Number(body.index);
      const token = cleanStr(body.bidderToken, MAX_TOKEN);
      const name = cleanStr(body.name, MAX_NAME);
      const birth = cleanStr(body.birth, MAX_DATE);
      const death = cleanStr(body.death, MAX_DATE);
      const epitaph = cleanStr(body.epitaph, MAX_EPITAPH);
      const color = Number.isInteger(body.color) && body.color >= 0 && body.color < PALETTE.length ? body.color : 0;
      if (!inRange(idx)) return json(res, 400, { error: 'That plot does not exist.' });
      if (db.owned[idx]) return json(res, 409, { error: 'This plot has already been claimed.' });
      if (!name) return json(res, 400, { error: 'Please give the name to be remembered.' });
      if (blocked(name) || blocked(epitaph)) return json(res, 400, { error: 'Please choose different words. This is a place of remembrance.' });
      if (spammy(name) || spammy(epitaph)) return json(res, 400, { error: 'A memorial cannot contain links.' });

      settle(idx, now);
      const a = db.auctions[idx];
      if (!a || a.status !== 'awaiting_claim') return json(res, 409, { error: 'This plot is not awaiting a claim right now.' });
      if (a.topBidder !== token) return json(res, 403, { error: 'Only the winning bidder may claim this plot.' });
      const amountCents = a.topCents;
      const memorial = { index: idx, bidderToken: token, name, birth, death, epitaph, color, amountCents, createdAt: now, fulfilled: false };

      if (DEMO) {
        const sid = 'demo_' + crypto.randomUUID();
        db.pending[sid] = memorial; a.pendingSid = sid; save();
        return json(res, 200, { url: `/api/demo-pay?sid=${sid}`, demo: true });
      }
      const params = new URLSearchParams({
        mode: 'payment',
        'line_items[0][quantity]': '1',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][unit_amount]': String(amountCents),
        'line_items[0][price_data][product_data][name]': `A Million Plots — plot (${xy(idx).x}, ${xy(idx).y})`,
        'line_items[0][price_data][product_data][description]': `Perpetual memorial for ${name}`,
        success_url: `${BASE_URL}/?sid={CHECKOUT_SESSION_ID}`,
        cancel_url: `${BASE_URL}/?canceled=1&index=${idx}`,
        expires_at: String(Math.floor(now / 1000) + 1800),
      });
      const session = await stripePost('checkout/sessions', params);
      db.pending[session.id] = memorial; a.pendingSid = session.id; save();
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
      if (p.conflict) return json(res, 409, { error: 'This plot was claimed by someone else first; your payment will be refunded. Please contact us.', conflict: true });
      return json(res, 200, { ok: true, index: p.result, plot: plotView(p.result, p.bidderToken), state: publicState() });
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
      const idx = Number(body.index);
      if (inRange(idx)) { delete db.owned[idx]; delete db.auctions[idx]; save(); }
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

// Background sweep so plots free up / promote even without traffic.
const sweepTimer = setInterval(() => sweepAll(Date.now()), Math.max(1000, Math.min(30000, CLAIM_MS)));
if (sweepTimer.unref) sweepTimer.unref();

load();
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`A MILLION PLOTS listening on ${BASE_URL} ${DEMO ? '(DEMO MODE — payments simulated)' : '(LIVE — Stripe enabled)'}`);
  });
}
module.exports = { server, _internal: { settle, minNext, sweepAll, plotView, load } };
