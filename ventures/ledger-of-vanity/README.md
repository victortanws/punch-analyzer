# The Ledger of Vanity

A public list of names — each with an optional declaration and image — ranked purely by
cumulative amount paid. Nothing else is sold, and the site says so, repeatedly, in a
luxury register. The honesty is the joke; the joke is the press hook.

**Psychology:** pure status signaling (bar-tab economics). Whales fight for rank I;
everyone else pays $5 to exist on the list at all. Payments to the same name stack, so
every overtake invites a counter-payment.

## Mechanics
- `GET /api/state` — throne, totals, name count, `allowImages` flag.
- `GET /api/entries?page=&q=` — paginated (24/page), searchable roll; ranks preserved under search.
- `POST /api/checkout {name, motto, amountCents, image?}` — $1 min / $9,999 max per
  payment; two-tier profanity + spam/impersonation-lite filters on name+motto; optional
  browser-resized image (server validates magic bytes + scans for embedded markup);
  Stripe Checkout at the chosen amount. Images are OFF unless `ALLOW_IMAGES=1` (or demo).
- Aggregation is by case-insensitive name. **Display (spelling, declaration, image) uses
  the _largest single tribute_**, so a small payment can never deface a larger inscription.
  Rank ties break by earliest first inscription.
- Fulfillment records Stripe's authoritative `amount_total`; idempotent; webhook + confirm.
- Moderation: `POST /api/admin/remove {token, name}` removes ALL payments under a name;
  `POST /api/admin/censor {token, name, image?, motto?}` strips an image and/or message
  while keeping the paid rank. Both timing-safe, rate-limited, logged. Non-refunding.

## Security posture
CSP + `nosniff` + `X-Frame-Options` + HSTS on every response; external `/app.js` (no inline
script); path-traversal-safe image route; pre-payment image disk-fill capped + swept;
XFF-aware rate limiting. Run `npm run preflight` before going live.

## Revenue levers
- Presets in index.html ($5/$25/$100/custom).
- Later: "overtake alerts" by email (someone passed you — reclaim your rank), yearly
  engraved-certificate upsell, rank-milestone tweets.

## Run
`node server.js` — demo mode without `STRIPE_SECRET_KEY` (seeds a demo throne). Tests: none
automated for this app; see `REVIEW-*.md` / `DEPLOY-REVIEW-UX.md` for the pre-launch audits.
See `../GO-LIVE-PAYMENTS.md`, `../DEPLOY-RAILWAY.md`, and `.env.example`.
