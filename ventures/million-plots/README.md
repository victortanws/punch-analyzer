# A Million Plots

A virtual cemetery of 1,000,000 plots on a 1,000 × 1,000 grid — each plot is a single
pixel. Unclaimed plots are won at **timed ascending auction**; once paid for, a plot is
owned permanently and bears a memorial (name, dates, epitaph, headstone colour). No one
can ever auction a claimed plot.

**Psychology:** scarcity (a hard cap of one million), territorial permanence, and the
memorial impulse — combined with the competitive pull of an auction for the good spots.
Every auction has a winner and under-bidders, and every claimed plot is a small shareable
monument.

## Auction model
- The first qualifying bid (≥ floor, default $5) on an unclaimed plot **opens** an
  auction that runs `AUCTION_MS` (default 3 days).
- Each further bid must beat the top by `minNext()` = max($1, 5%). The current top bidder
  cannot bid against themselves.
- A bid inside the final `SNIPE_MS` (default 5 min) **extends** the close — anti-sniping.
- When time expires the auction enters **awaiting_claim**: the winner has `CLAIM_MS`
  (default 24 h) to pay their winning bid (Stripe) and submit the memorial. Payment ⇒
  owned, permanently.
- If the winner doesn't pay in time they forfeit; the **next-highest eligible bidder is
  promoted** with a fresh claim window. If none remain, the plot returns to unclaimed.
- Settlement is lazy + swept, idempotent, and anchored to the real auction end, so it is
  correct regardless of traffic or timing.

## Endpoints
- `GET /api/state` — palette, counts, and sparse arrays of owned/auction plots (for the canvas).
- `GET /api/plot?index=&token=` — one plot's full status (auction, memorial, your-bidder flags).
- `GET /api/mine?token=` — plots you're bidding on / have won and must claim / already own.
- `POST /api/bid {index, amountCents, bidderToken, displayName}` — bid or open an auction.
- `POST /api/claim {index, bidderToken, name, birth, death, epitaph, color}` — winner pays & memorializes.
- `GET /api/confirm?sid=` · `POST /webhook/stripe` — idempotent fulfillment (both paths).
- `POST /api/admin/remove {token, index}` — moderation.

## Tests
`node test.js` (or `npm test`) spawns the server with tiny timings and asserts the whole
state machine over HTTP — 51 assertions across floor/increment validation, anti-snipe
extension, timed close, pay-on-win, non-winner rejection, defaulted-winner promotion,
idempotent fulfillment, moderation, and ownership permanence. A parallel-bid stress check
confirms no state corruption under concurrency.

## Frontend
A single `<canvas>` renders all million plots (offscreen 1000×1000 ImageData blitted
with nearest-neighbour): pan (drag), zoom (wheel / pinch / buttons), click to select,
jump-to-coordinates, live countdowns, "your plots" strip, and per-status side panels
(open-auction / bid / claim-memorial / at-rest memorial).

## Revenue levers
- `FLOOR_CENTS`, `MIN_INCREMENT_CENTS`, `AUCTION_MS` in server.js / env.
- Later: premium central plots, family sections (adjacent plots), engraved-certificate
  and printed-map upsells, "reserve the plot next to a loved one" alerts.

## Run
`node server.js` — demo mode without `STRIPE_SECRET_KEY` (seeds a tended cluster of
memorials + live auctions). Port 8754. See `../GO-LIVE-PAYMENTS.md` and
`../DEPLOY-RAILWAY.md`.
