# The Last Word

One sentence rules the page until someone pays more to replace it. The price rises 25%
per takeover (tidy 25¢ steps, $1 floor). Dethroned sentences are struck through and kept
forever in "The Fallen."

**Psychology:** status competition + loss aversion. People pay more to avoid losing a
public position than to gain one, and every dethroning gives two people a reason to
share the link — the victor and the aggrieved.

## Mechanics
- `GET /api/state` — current word, next price, last 50 fallen.
- `POST /api/checkout {text, author}` — validates (≤140 chars, blocklist), creates a
  Stripe Checkout session at the current price, stores it pending.
- Fulfillment on webhook `checkout.session.completed` and/or success-redirect
  confirmation; both idempotent.
- Race note: two buyers can check out at the same price simultaneously; both are
  fulfilled in arrival order (both appear — one briefly reigns, then falls). Every payer
  is permanently visible, so nobody pays for nothing.
- Moderation: `POST /api/admin/remove {token, id}` — removing the current word restores
  the previous one.

## Revenue levers
- `ESCALATION` (1.25) and `BASE_PRICE_CENTS` in server.js.
- Later: "reign insurance" (pay 3× to lock 24h), reign-length leaderboard, daily
  screenshot bot for X/Instagram.

## Run
`node server.js` — demo mode without `STRIPE_SECRET_KEY`. See `../GO-LIVE-PAYMENTS.md`.
