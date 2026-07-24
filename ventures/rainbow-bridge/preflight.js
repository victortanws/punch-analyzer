#!/usr/bin/env node
/* Rainbow Bridge preflight — blocks a careless live launch. Run: node preflight.js */
'use strict';
const fs = require('node:fs'), path = require('node:path');
const E = process.env;
const live = !!E.STRIPE_SECRET_KEY;
let blockers = 0, warns = 0;
const ok = m => console.log('    \x1b[32m✓\x1b[0m ' + m);
const warn = m => { warns++; console.log('    \x1b[33m⚠ WARN\x1b[0m   ' + m); };
const block = m => { blockers++; console.log('    \x1b[31m✗ BLOCK\x1b[0m  ' + m); };

console.log('\n  Rainbow Bridge preflight — target mode: ' + (live ? 'LIVE' : 'DEMO') + '\n');

if (!live) warn('STRIPE_SECRET_KEY not set → DEMO mode (payments simulated, seed data shown). Set it for live.');
else {
  if (/^sk_test_/.test(E.STRIPE_SECRET_KEY)) warn('Using a TEST Stripe key — fine for rehearsal; swap to sk_live_ for real payments.');
  else if (!/^sk_live_/.test(E.STRIPE_SECRET_KEY)) block('STRIPE_SECRET_KEY is set but not an sk_test_/sk_live_ key.');
  if (!E.STRIPE_WEBHOOK_SECRET) block('STRIPE_WEBHOOK_SECRET missing — paid memorials may never appear if a browser closes after payment.');
  else ok('Stripe webhook secret set.');
  if (!E.BASE_URL || !/^https:\/\//.test(E.BASE_URL)) block('BASE_URL must be your https:// domain, or Stripe redirects break.');
  else ok('BASE_URL = ' + E.BASE_URL);
  if (!E.CONTACT_EMAIL || /example\.com/.test(E.CONTACT_EMAIL)) block('CONTACT_EMAIL is unset or a placeholder — it is the refund/removal channel.');
  else ok('CONTACT_EMAIL = ' + E.CONTACT_EMAIL);
}

const chk = live ? (E.ADMIN_TOKEN ? (E.ADMIN_TOKEN.length >= 24 ? ok : warn) : block) : warn;
chk(E.ADMIN_TOKEN && E.ADMIN_TOKEN.length >= 24
  ? 'ADMIN_TOKEN set (' + E.ADMIN_TOKEN.length + ' chars) — the review queue is usable.'
  : 'ADMIN_TOKEN unset/short — without it you cannot approve memorials, so NOTHING ever appears live. Generate: openssl rand -hex 32');

const dir = E.DATA_DIR || path.join(__dirname, 'data');
try { fs.mkdirSync(dir, { recursive: true }); fs.accessSync(dir, fs.constants.W_OK); ok('DATA_DIR is writable: ' + dir); }
catch { block('DATA_DIR not writable: ' + dir + ' — mount a persistent volume there on Railway.'); }

console.log('\n  ' + blockers + ' blocker(s), ' + warns + ' warning(s).');
if (blockers) { console.log('  \x1b[31m→ NOT READY for live. Resolve the blockers above.\x1b[0m\n'); process.exit(1); }
console.log(live ? '  \x1b[32m→ READY for live.\x1b[0m\n' : '  → Demo config is valid. Set Stripe + the vars above when ready for live.\n');
