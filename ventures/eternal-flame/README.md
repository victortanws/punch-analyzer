# The Eternal Flame

A quiet wall of animated candle flames, each remembering a person, a companion animal,
or something else worth remembering. $9 lights one permanently. No subscriptions at
launch, no upsells on the page, no exclamation marks anywhere.

**Psychology:** grief seeks permanence and public witness. Memorial spending is
famously price-insensitive — which is exactly why the site must never feel like it
knows that. Dignity is the product.

**Operating rule:** this one carries real emotional weight. Moderate fast, refund
generously on request despite the stated policy, and never A/B-test copy cynically.

## Mechanics
- `GET /api/state` — newest-first candles (last 800), count, price.
- `POST /api/checkout {forName, dedication, litBy, kind}` — blocklist check, $9 Stripe
  Checkout; candle appears on payment.
- Moderation: `POST /api/admin/remove {token, id}`.
- CSS flames use layered gradients + staggered keyframes; `prefers-reduced-motion`
  disables the flicker.

## Revenue levers
- `PRICE_CENTS` (900) in server.js.
- Later (tasteful only): anniversary re-lighting email ("one year since the flame was
  lit"), optional $3/mo "brighter flame," printed certificate.

## Run
`node server.js` — demo mode without `STRIPE_SECRET_KEY`. See `../GO-LIVE-PAYMENTS.md`.
