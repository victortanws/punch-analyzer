# Go-Live Guide — The Attention-Economy Four

Applies to `last-word/`, `ledger-of-vanity/`, `eternal-flame/`, `one-million-words/`,
`million-plots/`.
Each is a zero-dependency Node app (no `npm install`, Node ≥ 18): one `server.js`, one
`public/index.html`, JSON storage in `data/`. Stripe is called over plain REST, so there
is no SDK to install and nothing to build.

## Run locally (demo mode)

```bash
node ventures/last-word/server.js           # http://localhost:8750
node ventures/ledger-of-vanity/server.js    # http://localhost:8751
node ventures/eternal-flame/server.js       # http://localhost:8752
node ventures/one-million-words/server.js   # http://localhost:8753
node ventures/million-plots/server.js       # http://localhost:8754
```

With no `STRIPE_SECRET_KEY` set, each site runs in **demo mode**: a banner is shown,
checkout is simulated (no card), and the database is seeded with demo content so the
page never looks empty. Delete `data/data.json` to reset a site.

## What only you can provide

1. **Stripe account** (stripe.com) — identity verification (SSN/EIN), business type
   (sole proprietor is fine), and a bank account for payouts. Stripe will not enable
   live charges without a support email and a business website/description; the site
   itself satisfies the website requirement.
2. **Domains** — one per site you launch. The name is the marketing.
3. **Hosting** — anywhere that runs Node with a persistent disk (Railway, Fly.io,
   Render, or any $5 VPS). Serverless platforms (Vercel/CF Workers) are NOT suitable
   as-is because storage is a local JSON file.
4. **Legal pages** — each footer links a contact email; replace `hello@example.com`
   and add ToS/privacy/refund pages before charging real cards.

## Environment variables (per site)

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | no | listen port (defaults 8750–8753) |
| `BASE_URL` | **yes in production** | public origin, e.g. `https://thelastword.example` — used for Stripe success/cancel redirects |
| `STRIPE_SECRET_KEY` | yes for live payments | `sk_test_...` first, then `sk_live_...`; absence = demo mode |
| `STRIPE_WEBHOOK_SECRET` | recommended | from the webhook endpoint you register (below) |
| `ADMIN_TOKEN` | recommended | enables the moderation endpoint |

## Stripe wiring (once per site)

1. Dashboard → Developers → API keys → copy the secret key into `STRIPE_SECRET_KEY`.
2. Dashboard → Developers → Webhooks → Add endpoint:
   `https://<your-domain>/webhook/stripe`, event `checkout.session.completed`.
   Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
3. Test end-to-end with `sk_test_...` and card `4242 4242 4242 4242`, then swap to
   live keys.

Fulfillment is belt-and-braces: the success redirect confirms the session against the
Stripe API, and the webhook fulfills independently; both paths are idempotent, so a
missed webhook or a closed browser tab cannot double-post or lose a purchase.

## Moderation

All four sites share a normalized blocklist (leet-speak folded) applied before checkout,
plus an after-the-fact removal endpoint:

```bash
curl -X POST https://<domain>/api/admin/remove \
  -H 'Content-Type: application/json' \
  -d '{"token":"<ADMIN_TOKEN>", ...}'   # see each README for the id field
```

Removals are deliberately non-refunding — state that in your ToS. The blocklist is a
floor, not a ceiling; expand it in `server.js` (`BLOCKLIST`) as real traffic teaches you.
One Million Words redacts rather than deletes, so word numbers are never reused.

## PayPal (optional, later)

These sites are Stripe-first. If buyers ask for PayPal: create a PayPal Business
account, get REST credentials at developer.paypal.com, and add Smart Buttons +
Orders API alongside the existing flow. Worse dispute tooling, faster buyer trust in
some markets. Not required for launch.

## Launch-order advice

Launch ONE site first (The Last Word has the strongest share loop — every dethroning
is a social event), get the Stripe account battle-tested, then roll the same account
across the other three. One Stripe account can serve all four sites; use metadata or
separate products to keep reporting clean.
