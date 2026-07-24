# Production-Readiness & Security Review — The Ledger of Vanity

Reviewer pass on `server.js`, `public/index.html`, `public/legal.html`, `railway.json`,
and the Railway/Stripe deploy docs. Tested in demo mode against a live instance
(path traversal, SVG/polyglot upload, size caps, concurrency, fulfillment idempotency,
response headers). No files were modified.

---

## VERDICT: **LAUNCH AFTER FIXES**

The core money path is sound: Stripe sessions are created server-side (so the charged
amount can't be tampered), the webhook signature is verified with a timing-safe HMAC
compare and a 5-minute replay window, and fulfillment is idempotent and double-covered
(webhook + success-page confirm). Path traversal on `/img/` is blocked, SVG is rejected,
the decoded-image cap is enforced, and user text is HTML-escaped on render.

But there are **three genuine blockers** that must be fixed before real cards and real
user images go live: a stored-content sniffing/XSS gap on the image route, an
unauthenticated pre-payment disk-fill DoS, and a missing hard content-type/security-header
posture. None are exotic; all are cheap to fix.

---

## BLOCKERS — must fix before live

### B1. `/img/:id` serves attacker-controlled bytes with no `nosniff` → stored HTML/JS execution & content sniffing
- **Where:** `server.js:112-127` (`storeImage`) and `server.js:268-276` (`/img/` route).
- **Failure:** The magic-byte check only inspects the **first 3-4 bytes**. Everything after
  the SOI/PNG/RIFF header is written to disk **verbatim** — the server has no image library
  and never re-encodes. Verified: a payload of `FF D8 FF E0` + `<html><script>alert(document.domain)</script></html>`
  passed validation, was stored, and was served back byte-for-byte as
  `Content-Type: image/jpeg` with **no `X-Content-Type-Options: nosniff`** header (confirmed
  on the live `/img/` response — only `Content-Type` and `Cache-Control` are set). A
  crafted GIF/JPEG polyglot, or an old browser / a victim who saves-and-opens the file, can
  get the embedded markup interpreted as HTML in the site's own origin. Because `/img/` is
  same-origin with the app, that is a stored-XSS primitive against every visitor who loads
  the ledger.
- **Fix (do all three):**
  1. Add `X-Content-Type-Options: nosniff` to the `/img/` response (and ideally all
     responses).
  2. Set `Content-Disposition: inline` plus a strict CSP (see B3) so the image origin can't
     execute script.
  3. Best: actually validate the image is a real image beyond byte 0 — either parse
     the full structure or shell out to re-encode. At minimum, reject files whose body
     contains `<script`, `<html`, `<svg`, or `<?php` after decode. The current "first
     bytes match" check is not a real content check.

### B2. Unauthenticated, pre-payment disk-fill DoS (images written before any payment)
- **Where:** `server.js:289-293` — `storeImage()` runs during `/api/checkout`, **before** the
  Stripe session exists and **before** anyone has paid. Orphans are only reclaimed in
  `load()` at process **restart** (`server.js:61-67`), never during runtime.
- **Failure:** Each accepted checkout writes up to `MAX_IMAGE_BYTES` (600 KB) to the Railway
  volume with no payment required. Rate limit is 20/min/IP (`server.js:213`), and it is
  **keyed on `req.socket.remoteAddress`** — behind Railway's proxy that may be a single
  upstream IP (see M3) or trivially rotated across IPs. 20 req/min × 600 KB ≈ 720 MB/hr per
  IP; a handful of IPs fills a small volume in minutes. A full volume means failed
  `save()` writes and, in the worst case, a corrupt/half-written ledger — i.e. the entire
  business state. This is a paid product whose free, unauthenticated endpoint writes
  unbounded disk.
- **Fix:** Don't persist the image until payment is confirmed. Options: (a) keep the image
  bytes only in the `pending` record in memory / a temp file namespaced by session and
  written to `IMG_DIR` only inside `fulfill()`; or (b) add a runtime sweep of orphaned
  pending images on a timer and a global cap on total image bytes + pending count. Also
  cap concurrent pending checkouts per IP and enforce a hard disk quota check before write.

### B3. No Content-Security-Policy and no baseline security headers on any response
- **Where:** all response paths — `server.js:220` (`json`), `server.js:272` (`/img/`),
  `server.js:380` (static). Confirmed live: `GET /` returns only `Content-Type: text/html`;
  no CSP, `X-Frame-Options`, `X-Content-Type-Options`, or HSTS anywhere.
- **Failure:** The page renders **user-supplied names, declarations, and images**. Escaping
  in `index.html` (`esc()`, `textContent`) is currently correct, but with zero CSP a single
  future escaping regression, or the B1 sniffing gap, becomes full account-less stored XSS
  with no defense-in-depth. No `X-Frame-Options`/`frame-ancestors` means the paid site can
  be framed for clickjacking on the checkout button. No HSTS.
- **Fix:** Send on every response: `Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self' https://checkout.stripe.com`
  (adjust for the inline `<script>`/`<style>` — either hash them or move to files),
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`,
  and `Strict-Transport-Security: max-age=31536000` (Railway terminates TLS, so HSTS is
  safe). Note the inline `<style>`/`<script>` and Google Fonts links in `index.html` mean a
  strict `script-src`/`style-src` needs hashes or a nonce — plan for that.

---

## MAJOR — fix soon after launch

### M1. Admin endpoints: non-timing-safe token compare, no rate limit, no lockout
- **Where:** `server.js:352` and `server.js:363` — `body.token !== ADMIN_TOKEN`.
- Plain `!==` is not constant-time, and `/api/admin/remove` / `/api/admin/censor` are **not**
  passed through `rateLimited()`, so the token is brute-forceable with unlimited attempts.
  With a long random `ADMIN_TOKEN` the timing channel is mostly theoretical, but the
  no-rate-limit + no-lockout posture on a destructive endpoint (it can delete any/all
  inscriptions) is a real weakness.
- **Fix:** Use `crypto.timingSafeEqual` on equal-length buffers (guard against length
  mismatch), rate-limit these routes, and refuse to boot / disable the routes if
  `ADMIN_TOKEN` is unset or short. Currently `/api/admin/*` with an empty `ADMIN_TOKEN`
  returns 403 (safe), but that's the only guard.

### M2. Oversized request body drops the connection instead of returning 413
- **Where:** `server.js:223-229` (`readBody`) — on overflow it calls `reject()` **and**
  `req.destroy()`. Verified: a 1.8 MB POST to `/api/checkout` returns `HTTP 000` (reset),
  not a clean 413. The reject bubbles to the `catch` at `server.js:385` returning 500, but
  the socket is often already destroyed so the client sees a connection error.
- **Fix:** On overflow, stop reading, respond `413 Payload Too Large` with a JSON body, then
  end the response cleanly; don't `req.destroy()` before responding.

### M3. Rate limiting / client IP is unreliable behind Railway's proxy; buckets never evicted
- **Where:** `server.js:208-214`, `server.js:247` (`req.socket.remoteAddress`).
- Behind Railway's reverse proxy the socket address is the proxy, not the client, so
  per-IP limiting may lump all users together (over-blocking) or, if it's a shared egress,
  be ineffective. `X-Forwarded-For` is not consulted. Also `buckets` is an unbounded `Map`
  that is never pruned — a slow memory leak under IP churn.
- **Fix:** Read the client IP from `X-Forwarded-For` (leftmost, trusting only Railway's
  proxy hop), and periodically evict stale buckets. Reconsider limits given B2.

### M4. Fulfillment trusts the stored pending amount; never reconciles against `amount_total`
- **Where:** `server.js:198-204` (`fulfill`) records `p.amountCents`; the webhook
  (`server.js:346`) and confirm (`server.js:333-335`) never compare against
  `event.data.object.amount_total` / the retrieved session's `amount_total`.
- In the current flow this is **safe** because the session's `unit_amount` is set
  server-side from the same `amountCents`, so charged == pending. But it's fragile: any
  future change (coupons, adjustable quantity, tax) would silently record the wrong number.
  Since "the number" is literally the product, reconciling is cheap insurance.
- **Fix:** In `fulfill`, when live, record the Stripe-reported `amount_total` (in the
  webhook payload / retrieved session) rather than the client-derived `p.amountCents`.

### M5. Backups miss the images directory
- **Where:** deploy doc `DEPLOY-RAILWAY.md:75-78` says "everything lives in
  `/data/data.json`." It doesn't — user images live in `/data/images/`. The suggested
  `cat /data/data.json > backup.json` backup silently loses every uploaded image.
- **Fix:** Update the runbook to back up the whole `DATA_DIR` (tar `/data`), and mention
  images explicitly.

---

## MINOR

- **M/EXIF privacy:** the server never strips EXIF (`server.js:125` writes bytes verbatim).
  The browser canvas re-encode drops EXIF, but a **direct API POST bypasses the client**, so
  GPS/EXIF in an uploaded JPEG is stored and served. Combined with B1, uploads are trusted
  too much. Strip metadata on ingest (re-encode) — same fix as B1.
- **HEAD requests unsupported:** only `GET`/`POST` are handled; `HEAD /` returns 000/nothing.
  Harmless but odd for a public URL; some link-preview/monitoring bots use HEAD.
- **`legal.html` placeholders unfilled:** `[Your legal name or business entity]` and
  `[your state/country]` (`legal.html:33-34`) are still present. The go-live checklist flags
  this, but shipping with them is a legal blocker in practice.
- **`CONTACT_EMAIL` default is `hello@example.com`** (`server.js:24`) and appears in the
  footer, legal page, and error messages if unset. Must be a real, monitored inbox before
  launch — it is the sole channel for DMCA / impersonation / right-to-erasure requests.
- **Seed Ronaldo entry** (`server.js:74-86`, `seed/ATTRIBUTION.md`): demo-only and correctly
  purged when a live key is first seen (`server.js:46-49`, verified logic), but the
  attribution file itself warns not to ship a celebrity likeness live — worth an explicit
  confirmation that live boots with `STRIPE_SECRET_KEY` set never seed it. (Confirmed: seed
  only runs when `DEMO`, and any prior demo `data.json` is renamed to a `.demo-backup-*` file
  on first live boot.)
- **`.demo-backup-*.json` files** accumulate in `DATA_DIR` on repeated toggles; trivial, but
  they contain old (demo) data on the same volume.
- **No structured logging / audit trail** for admin remove/censor actions — for a moderation
  workflow with legal exposure you want a record of what was removed, when, and why.
- **Search is O(n) full-scan per request** (`server.js:254-258` rebuilds `ledger()` and
  filters on every `/api/entries` call). Fine at small scale; will get slow as the ledger
  grows into the thousands, and there's no caching.

---

## WHAT'S ALREADY DONE RIGHT

- **Amount integrity:** the Stripe session is built server-side from the validated
  `amountCents` (`server.js:301-312`); the client cannot pay less than the server-set price.
  Min/max bounds enforced (`server.js:284-285`).
- **Webhook verification is real:** HMAC-SHA256 over `t.payload`, `timingSafeEqual` compare,
  5-minute timestamp replay window, supports multiple `v1` signatures
  (`server.js:188-195`). Rejects when secret or header missing.
- **Idempotent, double-covered fulfillment:** `fulfill()` guards on `p.fulfilled`
  (`server.js:198-204`); webhook and success-confirm both call it; verified that hammering
  demo-pay 20× concurrently yields exactly one payment record.
- **No lost writes in the demo path under concurrency:** 60 concurrent checkouts all
  persisted (Node's single thread serializes the synchronous `save()` since there's no
  `await` between mutation and write in demo mode). `save()` uses write-tmp-then-rename for
  atomicity (`server.js:69-73`). *(Caveat: in the LIVE path there **is** an `await stripePost`
  before the pending write and the tmp filename is a constant — see note below.)*
- **Path traversal blocked** on `/img/` by a strict `IMG_ID_RE` allowlist
  (`server.js:128`, `271`) and on static files by normalize + `startsWith(PUBLIC_DIR)`
  (`server.js:377-379`); verified `../data.json`, encoded traversal, and `/etc/passwd`
  attempts all 404.
- **SVG rejected** (regex allows only jpeg/png/webp data URLs, `server.js:113`); decoded-size
  cap enforced on the actual bytes, not the base64 (`server.js:117`); empty/oversized bodies
  bounded (`readBody` limits).
- **Demo→live purge** archives seeded demo data on first live boot so fictional payers never
  appear on a real ledger (`server.js:45-49`).
- **User text is escaped** on render (`esc()` / `textContent` in `index.html`), and pending
  images are protected from the restart sweep (both payments and pending are in the
  `referenced` set, `server.js:62-64`).
- **Largest-tribute display rule** is deterministic and can't be defaced by a cheap payment
  (`server.js:143-146`): a $1 tribute never overrides a larger one's name/message/image.
- **Sensible ToS/legal scaffolding**: refunds-are-final, unconditional censor right,
  impersonation/DMCA contact path, likeness-rights warranty — all present in `legal.html`.

---

### One caveat on concurrency to re-verify under live load
In LIVE mode `/api/checkout` does `await stripePost(...)` **between** reading the body and
`db.pending[session.id] = ...; save()` (`server.js:312-314`). Two overlapping live checkouts
can therefore interleave: both hold a reference to the same `db`, and `save()` uses a single
constant tmp path (`DATA_FILE + '.tmp'`, `server.js:70`). The in-memory object is shared so a
`push`/assign isn't lost, but two concurrent `writeFileSync(tmp)` + `renameSync` sequences can
race on the tmp file. Low probability at low volume, but under a burst of live traffic it's a
real correctness risk. **Fix:** serialize writes through a single async mutex/queue, or use a
per-write unique tmp filename before rename.
