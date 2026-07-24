# Deploy to Railway

Each of the four sites is its own Railway **service**, with its own domain, its own Stripe
keys, and a small persistent **volume** for its JSON data. They share nothing at runtime,
so you can launch one and add the others later.

Files already in each site directory:
- `package.json` — `npm start` → `node server.js`, Node ≥ 18 (Railway's Nixpacks builder reads this)
- `railway.json` — start command + healthcheck on `/api/state`
- `.dockerignore` — keeps local `data/` out of builds

## One-time setup per site

Do this four times (or once, then repeat). Using `last-word` as the example.

### 1. Create the service
- Railway → **New Project** → **Deploy from GitHub repo** → pick this repo.
- In the service **Settings → Source**, set **Root Directory** to `ventures/last-word`.
  (This is what makes the four services independent within one monorepo.)
- Build/start are auto-detected from `package.json` + `railway.json`. No Dockerfile needed.

### 2. Add the persistent volume (critical)
The app stores everything in a JSON file. Without a volume, **every deploy wipes all
purchases.**
- Service → **Settings → Volumes → Add Volume**.
- Mount path: `/data`
- Then add an env var `DATA_DIR=/data` (step 3) so the app writes there.

### 3. Environment variables
Service → **Variables**:

| Variable | Value | Notes |
|---|---|---|
| `DATA_DIR` | `/data` | must match the volume mount path |
| `BASE_URL` | `https://<your-domain>` | set after step 4; no trailing slash |
| `CONTACT_EMAIL` | your real support email | shown in footer, legal page, error messages |
| `ADMIN_TOKEN` | a long random string | for the moderation endpoint |
| `STRIPE_SECRET_KEY` | `sk_test_...` then `sk_live_...` | omit entirely to run demo mode |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | from step 5 |

Railway sets `PORT` automatically — the app already reads it.

Leaving `STRIPE_SECRET_KEY` unset deploys a fully working **demo** (simulated payments,
seeded content) so you can share a live URL before Stripe is approved. The app archives
demo data automatically the first time it boots with a real key, so demo payers never
leak onto the live site.

### 4. Domain
- Service → **Settings → Networking → Generate Domain** (gives `*.up.railway.app`), or
  **Custom Domain** and point your DNS `CNAME` at the target Railway shows.
- Put the final URL in `BASE_URL` and redeploy. `BASE_URL` must be correct or Stripe's
  success/cancel redirects will break.

### 5. Stripe webhook
- Stripe Dashboard → **Developers → Webhooks → Add endpoint**:
  `https://<your-domain>/webhook/stripe`, event **`checkout.session.completed`**.
- Copy the signing secret into `STRIPE_WEBHOOK_SECRET`, redeploy.
- Fulfillment is idempotent and double-covered (webhook **and** the success-page
  confirmation), so a missed webhook or a closed tab never double-posts or loses a sale.

### 6. Ports reference (local only)
`last-word` 8750 · `ledger-of-vanity` 8751 · `eternal-flame` 8752 · `one-million-words` 8753 · `million-plots` 8754.
Railway assigns its own `PORT`; these matter only for `node server.js` on your machine.

## Go-live checklist per site
- [ ] Root Directory set to `ventures/<site>`
- [ ] Volume mounted at `/data`, `DATA_DIR=/data`
- [ ] `BASE_URL` matches the real domain
- [ ] `CONTACT_EMAIL` and `ADMIN_TOKEN` set
- [ ] Tested end-to-end with `sk_test_...` + card `4242 4242 4242 4242`
- [ ] Webhook endpoint added, `STRIPE_WEBHOOK_SECRET` set
- [ ] `legal.html` placeholders (`[Your legal name]`, `[your state/country]`) filled in
- [ ] Swapped to `sk_live_...`

## Backups
The state of the business lives in the **whole** `DATA_DIR` volume — `data.json` **and**
the `images/` directory (uploaded pictures are files, not rows in the JSON). Backing up
only `data.json` silently loses every image. Snapshot the whole volume, or:
`railway run tar czf - /data > ledger-backup-$(date +%F).tgz`. Do this on a schedule.
