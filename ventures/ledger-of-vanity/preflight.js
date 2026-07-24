#!/usr/bin/env node
/**
 * Go-live preflight for The Ledger of Vanity.
 *   node preflight.js         # checks the current environment
 * Exits 0 if ready for LIVE, 1 if any blocker is found. Warnings don't fail.
 * In demo mode (no STRIPE_SECRET_KEY) it reports what's still needed for live.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const E = process.env;
const DATA_DIR = E.DATA_DIR || path.join(__dirname, 'data');
let blockers = 0, warns = 0;
const bad = m => { blockers++; console.log('  ✗ BLOCK  ' + m); };
const warn = m => { warns++; console.log('  ⚠ WARN   ' + m); };
const ok = m => console.log('  ✓ ' + m);

const live = !!E.STRIPE_SECRET_KEY;
// Things that are mandatory for LIVE but merely a to-do while still in demo.
const need = (condOk, msg) => { if (condOk) return true; if (live) bad(msg); else warn('For live: ' + msg); return false; };
console.log(`\nLedger of Vanity preflight — target mode: ${live ? 'LIVE (real payments)' : 'DEMO'}\n`);

// --- Stripe ---
if (!live) {
  warn('STRIPE_SECRET_KEY not set → DEMO mode (payments simulated, seed data shown). Set it for live.');
} else {
  if (/^sk_test_/.test(E.STRIPE_SECRET_KEY)) warn('STRIPE_SECRET_KEY is a TEST key — fine for staging, switch to sk_live_ for production.');
  else if (/^sk_live_/.test(E.STRIPE_SECRET_KEY)) ok('STRIPE_SECRET_KEY is a live key.');
  else bad('STRIPE_SECRET_KEY does not look like a Stripe secret key (sk_live_… / sk_test_…).');
  if (!E.STRIPE_WEBHOOK_SECRET) bad('STRIPE_WEBHOOK_SECRET missing — payments will only fulfill on the success redirect; a closed tab = lost purchase. Register /webhook/stripe and set it.');
  else if (!/^whsec_/.test(E.STRIPE_WEBHOOK_SECRET)) warn('STRIPE_WEBHOOK_SECRET does not start with whsec_ — double-check it.');
  else ok('STRIPE_WEBHOOK_SECRET present.');
}

// --- URLs / contact ---
if (need(!!E.BASE_URL, 'BASE_URL not set — Stripe redirects will point at localhost.') && E.BASE_URL) {
  if (live && !/^https:\/\//.test(E.BASE_URL)) bad('BASE_URL must be https in production (got ' + E.BASE_URL + ').');
  else if (/\/$/.test(E.BASE_URL)) warn('BASE_URL has a trailing slash — remove it to avoid double-slash redirect URLs.');
  else ok('BASE_URL = ' + E.BASE_URL);
}

need(!!E.CONTACT_EMAIL && !/example\.com$/.test(E.CONTACT_EMAIL),
  'CONTACT_EMAIL is unset or still a placeholder (example.com) — it shows in the footer, legal page, and refund/dispute path.')
  && ok('CONTACT_EMAIL = ' + E.CONTACT_EMAIL);

// --- Admin token ---
if (need(!!E.ADMIN_TOKEN, 'ADMIN_TOKEN not set — /api/admin/remove and /api/admin/censor are disabled, so you cannot take content down. Generate: openssl rand -hex 32') && E.ADMIN_TOKEN) {
  if (E.ADMIN_TOKEN.length < 24) warn('ADMIN_TOKEN is short (<24 chars) — use a long random value.');
  else ok('ADMIN_TOKEN set (' + E.ADMIN_TOKEN.length + ' chars).');
}

// --- Persistence ---
try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const probe = path.join(DATA_DIR, '.preflight-' + Date.now());
  fs.writeFileSync(probe, 'ok'); fs.unlinkSync(probe);
  ok('DATA_DIR is writable: ' + DATA_DIR);
  if (!path.isAbsolute(DATA_DIR)) warn('DATA_DIR is a relative path — on a host without a mounted volume here, data is wiped on redeploy. Point it at your persistent volume (e.g. /data).');
} catch (e) { bad('DATA_DIR not writable (' + DATA_DIR + '): ' + e.message); }

// --- Demo-data leak guard ---
const dataFile = path.join(DATA_DIR, 'data.json');
if (live && fs.existsSync(dataFile)) {
  try {
    const db = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    if (db.seededDemo) warn('data.json is demo-seeded (contains the Ronaldo sample). The server auto-archives it on first LIVE boot, but confirm the live ledger starts empty.');
    else ok('data.json exists and is not demo-seeded.');
  } catch { warn('data.json exists but could not be parsed.'); }
} else if (live) ok('No existing data.json — live ledger will start clean.');

// --- Celebrity seed reminder ---
if (fs.existsSync(path.join(__dirname, 'seed', 'ronaldo.jpg')) && live)
  warn('seed/ronaldo.jpg ships in the build. It only appears in DEMO mode, but replace/remove it before promoting the site publicly (celebrity likeness).');

console.log(`\n${blockers} blocker(s), ${warns} warning(s).`);
console.log(blockers === 0
  ? (live ? '→ READY for live launch.\n' : '→ Demo config is valid. Set Stripe + the vars above when you are ready for live.\n')
  : '→ NOT ready: resolve the blockers above first.\n');
process.exit(blockers === 0 ? 0 : 1);
