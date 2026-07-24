# Rainbow Bridge

A gentle, permanent memorial meadow for companion animals — the #1-ranked concept from the
30-idea review (33/40, the only idea all four expert lenses scored 8+). $19 places a pet on
the hillside forever; $29 "eternal light" adds a candle and room for a longer story.

**Why it won the debate:** grief is the least price-sensitive spend humans make and it
*renews* (per pet across a lifetime, plus the annual anniversary); pet photos carry none of
the CSAM/likeness/defamation exposure that sinks human-image ideas; the permanent memorial is
a durable anti-chargeback deliverable; and vet/cremation referral is a real, free channel.

## How it works
- `GET /api/state` — counts, prices, species, and "today we remember" (pets whose passing
  anniversary is today).
- `GET /api/meadow?page=&q=` — paginated, searchable meadow of approved memorials.
- `GET /api/memorial?id=` — one memorial.
- `POST /api/checkout {petName, species, birth, passing, words, litBy, ownerEmail, tier, image}`
  — gentle text moderation, optional browser-resized photo (validated + content-scanned),
  Stripe Checkout ($19 place / $29 eternal).
- Every new memorial is **held for review** and appears only after a human approves it at
  **`/admin.html`** (the Groundskeeper's Desk). Fulfillment is idempotent (webhook + confirm).

## Safety posture
Pay-then-review on every memorial (photo included); security headers + CSP with external JS;
path-traversal-safe image route; image disk-fill cap + sweep; timing-safe admin, XFF-aware
rate limiting, clean 413s. Photos are ON here (reviewed), unlike the text-only sites.
Run `npm run preflight` before going live.

## Not yet built (fast-follow)
The annual anniversary email uses the captured `ownerEmail` — the data is collected now, but
sending needs an email provider (Resend/Postmark/SES). Until then, the site surfaces "today we
remember" publicly. Print-on-demand keepsakes are the natural upsell after launch.

## Before real money (operator notes — not shown to users)
- Have `public/legal.html` skimmed by a lawyer. The public page reads as a confident, caring
  policy on purpose (a grieving reader shouldn't see "unreviewed draft"); the review is yours to do.
- **Back up the volume off-site on a schedule.** These memorials are sold as "forever," and the
  business state is the whole `DATA_DIR` (JSON + `images/`). The app keeps rotating on-volume
  backups (`data.backup-*.json`, last 12) as a recovery point, but that does not survive volume
  loss — snapshot it elsewhere: `railway run tar czf - /data > rb-backup-$(date +%F).tgz`.

## Run
`node server.js` → http://localhost:8755 in demo mode (seeded with a tasteful demo meadow).
Delete `data/data.json` to reset. See `.env.example`; deploy per `../DEPLOY-RAILWAY.md`.
