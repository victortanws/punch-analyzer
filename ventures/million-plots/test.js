#!/usr/bin/env node
/**
 * Self-contained auction test harness. Spawns the server in DEMO mode with tiny
 * auction timings, then drives the full lifecycle over HTTP and asserts every case.
 * Run: node test.js
 */
'use strict';
const { spawn } = require('node:child_process');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

const PORT = 9754;
const BASE = `http://localhost:${PORT}`;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-test-'));
const ENV = {
  ...process.env, PORT: String(PORT), DATA_DIR,
  SEED_DEMO: '0', FLOOR_CENTS: '500', MIN_INCREMENT_CENTS: '100',
  AUCTION_MS: '500', SNIPE_MS: '400', CLAIM_MS: '500', CHECKOUT_GRACE_MS: '150',
  STRIPE_SECRET_KEY: '', // demo mode
};

let pass = 0, fail = 0;
const fails = [];
function ok(cond, label) { if (cond) { pass++; } else { fail++; fails.push(label); console.log('  ✗ ' + label); } }
function eq(a, b, label) { ok(a === b, `${label} (expected ${JSON.stringify(b)}, got ${JSON.stringify(a)})`); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function req(method, p, body, token) {
  const url = BASE + p + (token ? (p.includes('?') ? '&' : '?') + 'token=' + token : '');
  const opt = { method, headers: {} };
  if (body) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  const res = await fetch(url, opt);
  let j = null; try { j = await res.json(); } catch {}
  return { status: res.status, j };
}
async function follow(url) { // follow a demo-pay redirect manually (fetch auto-follows; we just GET)
  const res = await fetch(BASE + url, { redirect: 'manual' });
  return res;
}

async function waitReady() {
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(BASE + '/api/state'); if (r.ok) return; } catch {}
    await sleep(100);
  }
  throw new Error('server did not start');
}

// unique plot index per scenario so scenarios never interfere
let nextPlot = 10;
const P = () => nextPlot++ * 137 + 3; // spread them out

async function run() {
  // ---- state / geometry ----
  let r = await req('GET', '/api/state');
  eq(r.status, 200, 'state 200');
  eq(r.j.total, 1000000, 'total plots = 1,000,000');
  eq(r.j.dim, 1000, 'dim = 1000');
  eq(r.j.counts.owned, 0, 'starts with 0 owned');
  eq(r.j.counts.unclaimed, 1000000, 'starts fully unclaimed');

  // ---- range validation ----
  eq((await req('GET', '/api/plot?index=1000000')).status, 400, 'plot index 1,000,000 out of range');
  eq((await req('GET', '/api/plot?index=-1')).status, 400, 'plot index -1 out of range');
  eq((await req('POST', '/api/bid', { index: 2000000, amountCents: 500, bidderToken: 'tok-aaaaaaa1', displayName: 'A' })).status, 400, 'bid out-of-range rejected');

  // ---- unclaimed plot view ----
  const p0 = P();
  r = await req('GET', '/api/plot?index=' + p0);
  eq(r.j.status, 'unclaimed', 'fresh plot is unclaimed');
  eq(r.j.floorCents, 500, 'floor is $5');

  // ---- bidder token required ----
  eq((await req('POST', '/api/bid', { index: p0, amountCents: 500, bidderToken: 'short', displayName: 'A' })).status, 400, 'short bidder token rejected');

  // ---- below floor ----
  eq((await req('POST', '/api/bid', { index: p0, amountCents: 400, bidderToken: 'tok-aaaaaaa1', displayName: 'A' })).status, 400, 'bid below floor rejected');

  // ---- blocked display name ----
  eq((await req('POST', '/api/bid', { index: p0, amountCents: 500, bidderToken: 'tok-aaaaaaa1', displayName: 'faggot' })).status, 400, 'slur display name rejected');

  // ---- first valid bid opens auction ----
  const A = 'tok-alice-0001', B = 'tok-bob-00002', C = 'tok-carol-003';
  r = await req('POST', '/api/bid', { index: p0, amountCents: 500, bidderToken: A, displayName: 'Alice' });
  eq(r.status, 200, 'opening bid accepted');
  ok(r.j.opened === true, 'auction reported opened');
  eq(r.j.plot.status, 'active', 'auction active after opening');
  eq(r.j.plot.auction.topCents, 500, 'top bid is $5');
  ok(r.j.plot.auction.youAreTop, 'opener is top bidder');
  eq(r.j.plot.auction.minNextCents, 600, 'minNext after $5 is $6 (max of $1 and 5%)');

  // ---- top bidder cannot re-bid ----
  eq((await req('POST', '/api/bid', { index: p0, amountCents: 700, bidderToken: A, displayName: 'Alice' })).status, 409, 'current top bidder cannot re-bid');

  // ---- below min increment ----
  r = await req('POST', '/api/bid', { index: p0, amountCents: 550, bidderToken: B, displayName: 'Bob' });
  eq(r.status, 409, 'bid below min increment rejected');
  eq(r.j.minNextCents, 600, 'rejection reports minNextCents');

  // ---- valid outbid ----
  r = await req('POST', '/api/bid', { index: p0, amountCents: 600, bidderToken: B, displayName: 'Bob' });
  eq(r.status, 200, 'valid outbid accepted');
  ok(r.j.plot.auction.youAreTop, 'new bidder is now top');
  // and Alice is no longer top
  r = await req('GET', '/api/plot?index=' + p0, null, A);
  ok(!r.j.auction.youAreTop, 'previous top bidder no longer top');
  eq(r.j.auction.bidCount, 2, 'bid count is 2');

  // ---- minNext math at higher amount ----
  const pInc = P();
  await req('POST', '/api/bid', { index: pInc, amountCents: 5000, bidderToken: A, displayName: 'Alice' });
  r = await req('GET', '/api/plot?index=' + pInc);
  eq(r.j.auction.minNextCents, 5250, 'minNext after $50 is $52.50 (5%)');

  // ---- anti-snipe extension ----
  const pSnipe = P();
  r = await req('POST', '/api/bid', { index: pSnipe, amountCents: 500, bidderToken: A, displayName: 'Alice' });
  const endsAt1 = r.j.plot.auction.endsAt;
  await sleep(260); // now within the 400ms snipe window (remaining ~240ms)
  r = await req('POST', '/api/bid', { index: pSnipe, amountCents: 600, bidderToken: B, displayName: 'Bob' });
  const endsAt2 = r.j.plot.auction.endsAt;
  ok(endsAt2 > endsAt1, `late bid extends close (was ${endsAt1}, now ${endsAt2})`);

  // ---- full happy path: open, end, winner claims, becomes owned ----
  const pWin = P();
  await req('POST', '/api/bid', { index: pWin, amountCents: 500, bidderToken: A, displayName: 'Alice' });
  await req('POST', '/api/bid', { index: pWin, amountCents: 700, bidderToken: B, displayName: 'Bob' });
  await sleep(700); // let it end (no further bids)
  r = await req('GET', '/api/plot?index=' + pWin, null, B);
  eq(r.j.status, 'awaiting_claim', 'auction ends into awaiting_claim');
  ok(r.j.auction.youWon, 'top bidder won');
  // non-winner cannot claim
  eq((await req('POST', '/api/claim', { index: pWin, bidderToken: A, name: 'Ghost' })).status, 403, 'non-winner cannot claim');
  // winner claims -> demo url
  r = await req('POST', '/api/claim', { index: pWin, bidderToken: B, name: 'Robert Bob', birth: '1950', death: '2024', epitaph: 'He bid true.', color: 2 });
  eq(r.status, 200, 'winner claim returns checkout');
  ok(r.j.url && r.j.url.includes('/api/demo-pay'), 'demo checkout url returned');
  await follow(r.j.url); // simulate payment
  const sid = r.j.url.split('sid=')[1];
  r = await req('GET', '/api/confirm?sid=' + sid);
  eq(r.status, 200, 'confirm ok after demo pay');
  eq(r.j.plot.status, 'owned', 'plot now owned');
  eq(r.j.plot.memorial.name, 'Robert Bob', 'memorial name set');
  eq(r.j.plot.memorial.priceCents, 700, 'owned at winning price');

  // ---- idempotent fulfillment ----
  const before = (await req('GET', '/api/state')).j.counts.owned;
  await req('GET', '/api/confirm?sid=' + sid); // confirm again
  const after = (await req('GET', '/api/state')).j.counts.owned;
  eq(after, before, 'double confirm does not double-own');

  // ---- cannot bid on an owned plot ----
  eq((await req('POST', '/api/bid', { index: pWin, amountCents: 5000, bidderToken: C, displayName: 'Carol' })).status, 409, 'cannot bid on owned plot');
  // ---- cannot claim a plot that is not awaiting ----
  eq((await req('POST', '/api/claim', { index: P(), bidderToken: A, name: 'X' })).status, 409, 'cannot claim an unclaimed plot');

  // ---- defaulted winner is promoted, then plot frees up ----
  const pDef = P();
  await req('POST', '/api/bid', { index: pDef, amountCents: 500, bidderToken: A, displayName: 'Alice' }); // Alice $5
  await req('POST', '/api/bid', { index: pDef, amountCents: 900, bidderToken: B, displayName: 'Bob' });   // Bob $9 (top)
  await sleep(700); // ends -> Bob awaiting_claim
  r = await req('GET', '/api/plot?index=' + pDef, null, B);
  eq(r.j.status, 'awaiting_claim', 'default-test auction ended');
  ok(r.j.auction.youWon, 'Bob is winner first');
  await sleep(650); // Bob does not pay within CLAIM_MS -> promote Alice
  r = await req('GET', '/api/plot?index=' + pDef, null, A);
  eq(r.j.status, 'awaiting_claim', 'still awaiting after promotion');
  ok(r.j.auction.youWon, 'Alice promoted to winner');
  eq(r.j.auction.topCents, 500, 'Alice wins at her own bid');
  await sleep(650); // Alice also does not pay -> no eligible -> plot unclaimed
  r = await req('GET', '/api/plot?index=' + pDef);
  eq(r.j.status, 'unclaimed', 'plot returns to unclaimed when all default');

  // ---- promoted winner CAN claim ----
  const pProm = P();
  await req('POST', '/api/bid', { index: pProm, amountCents: 500, bidderToken: A, displayName: 'Alice' });
  await req('POST', '/api/bid', { index: pProm, amountCents: 900, bidderToken: B, displayName: 'Bob' });
  await sleep(700);
  await sleep(650); // Bob defaults -> Alice promoted
  r = await req('GET', '/api/plot?index=' + pProm, null, A);
  ok(r.j.auction.youWon, 'Alice promoted (claimable test)');
  r = await req('POST', '/api/claim', { index: pProm, bidderToken: A, name: 'Alice Memorial', color: 1 });
  eq(r.status, 200, 'promoted winner can claim');
  await follow(r.j.url);
  r = await req('GET', '/api/confirm?sid=' + r.j.url.split('sid=')[1]);
  eq(r.j.plot.status, 'owned', 'promoted winner becomes owner');
  eq(r.j.plot.memorial.priceCents, 500, 'promoted winner pays their own bid');

  // ---- blocked epitaph on claim ----
  const pMod = P();
  await req('POST', '/api/bid', { index: pMod, amountCents: 500, bidderToken: A, displayName: 'Alice' });
  await sleep(700);
  eq((await req('POST', '/api/claim', { index: pMod, bidderToken: A, name: 'Fine Name', epitaph: 'you faggot' })).status, 400, 'slur epitaph rejected at claim');

  // ---- report ----
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) { console.log('FAILURES:\n  - ' + fails.join('\n  - ')); }
  return fail === 0;
}

let child;
(async () => {
  child = spawn('node', [path.join(__dirname, 'server.js')], { env: ENV, stdio: ['ignore', 'ignore', 'inherit'] });
  let good = false;
  try {
    await waitReady();
    good = await run();
  } catch (e) {
    console.error('TEST ERROR:', e.message);
  } finally {
    if (child) child.kill();
    try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch {}
    process.exit(good ? 0 : 1);
  }
})();
