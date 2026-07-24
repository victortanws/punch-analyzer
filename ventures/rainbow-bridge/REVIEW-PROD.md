# Rainbow Bridge — Production Readiness / Security Review

Reviewer: production-readiness & security. Date: 2026-07-11.
Scope: `server.js`, `preflight.js`, `public/*`, config. Exercised live in DEMO and simulated‑LIVE modes
(started with a temp `DATA_DIR`, hit every endpoint, ran adversarial payloads, then torn down).

---

## VERDICT: **LAUNCH AFTER FIXES**

The security core is genuinely solid and the hardened sibling‑app pattern is reused **correctly** here:
payment integrity, the pay‑then‑review gate, atomic JSON writes, security headers/CSP, path‑traversal
defense, timing‑safe admin token, and Stripe webhook verification all hold up under test. There is **no**
RCE, auth bypass, payment bypass, or executable stored‑XSS.

What blocks a clean launch is **durability of paid data** and a **cheap, unauthenticated denial‑of‑service
against the paid photo feature** — both directly at odds with a paid product that sells *permanent* memorials.
Fix the two BLOCKERS and the MAJORs; the MINORs are hardening.

---

## BLOCKERS (launch‑gating for a paid, "eternal" service)

These are availability/durability blockers, not remote‑compromise bugs — but for a service taking real
money for *permanent* memorials they must be resolved before go‑live.

### B1. No backups / single‑file durability for paid, "permanent" data
- **Where:** `server.js:28-30` (`DATA_FILE = DATA_DIR/data.json`), `server.js:82-86` (`save()` rewrites the one file).
- **Problem:** Every paid memorial lives in a single `data.json` on one Railway volume. Atomic writes prevent
  *corruption*, but nothing prevents *loss*: a volume failure, an accidental volume detach, or a fat‑fingered
  redeploy erases every paid ($19/$29) "forever" memorial. The product literally sells permanence; there is no
  backup, no export, no replication.
- **Exploit / failure:** Operational — one bad deploy or volume incident = total data loss + mass refunds +
  reputational harm, with no recovery path.
- **Fix:** Add a periodic off‑volume backup of `data.json` **and** `images/` (e.g. nightly copy to object
  storage / a second volume), plus a one‑command restore. At minimum, keep the last N `save()` snapshots and
  document the restore procedure. Verify the Railway volume is actually mounted at `DATA_DIR` (preflight checks
  writability but not persistence).

### B2. Unauthenticated DoS of the paid photo feature (images written before payment + no runtime prune + spoofable rate limit)
- **Where:** images stored pre‑payment `server.js:287-292` (`storeImage()` before any Stripe session);
  pending expiry pruned **only at startup** `server.js:76-79`; the periodic timer sweeps orphan *files* but
  never prunes stale *pending entries* `server.js:202-203` + `sweepImages()` `server.js:87-92`;
  rate limit keyed on spoofable IP `server.js:42-45` + `server.js:197-201`.
- **Problem:** `POST /api/checkout` writes the uploaded photo to disk **before** a Stripe session even exists,
  and inserts a `pending` entry. The 60 MB pending‑image cap (`MAX_PENDING_IMAGE_BYTES`, `server.js:37`) is only
  *reclaimed* by the startup prune — the 5‑minute interval keeps every un‑expired pending image *referenced*, so
  it is **never freed at runtime**. Because the rate limiter keys off `X-Forwarded-For[0]` (client‑controlled),
  an attacker rotates the header to bypass the 20/min limit entirely.
- **Exploit (verified):** Rotating `X-Forwarded-For` I sent 25 checkouts with **zero** 429s (vs 5×429 from a
  fixed IP), and 5/5 unpaid image checkouts landed on disk. Scaled up, an attacker fills the 60 MB budget with
  unpaid photos → **every legitimate photo checkout then returns 503** (`server.js:290`) until the process
  restarts. Separately, 60 concurrent unpaid checkouts left **60 permanent `pending` entries** — `data.json`
  and every `save()` grow unbounded (O(n) full‑file rewrite each time) with no runtime reclaim.
- **Fix:** (a) Move the stale‑pending prune (`server.js:76-79`) into the periodic interval so expired
  unfulfilled entries **and** their images are reclaimed at runtime, not just on boot. (b) Derive the client IP
  from the rightmost/trusted proxy hop (Railway appends the real IP) or a configured trusted‑proxy count instead
  of `xff.split(',')[0]`. (c) Consider deferring image write until the Stripe session is created, or scoping the
  cap per source IP.

---

## MAJOR

### M1. `X-Forwarded-For` is trusted from the left → rate limiting is bypassable and logs are spoofable
- **Where:** `server.js:42-45` (`clientIp` uses `xff.split(',')[0].trim()`).
- **Impact:** The *first* XFF value is whatever the client sends; a real proxy appends the true IP to the right.
  Taking the left value means every rate limit (checkout 20/min, admin 30/10) is trivially evaded and any future
  IP‑based logging/abuse handling keys off an attacker‑chosen value. Underpins B2.
- **Fix:** Trust only the hop your proxy inserts (rightmost, or `xff[len-1-trustedHops]`); make trusted‑proxy
  count explicit. Admin token is 64‑hex and timing‑safe so this is not an auth risk — but it is an abuse‑control risk.

### M2. `500` handler leaks raw exception text; malformed JSON returns 500 instead of 400
- **Where:** catch‑all `server.js:383` returns `e.message` to the client; `JSON.parse` on request bodies is
  unguarded at `server.js:274`, `:353`, `:364`.
- **Impact (verified):** A malformed body to `/api/checkout` or `/api/admin/approve` returns
  `500 {"error":"Expected property name or '}' in JSON at position 1 ..."}` — internal parser detail echoed to
  the caller, and the wrong status class for a client error. Low‑severity info leak; also means well‑behaved
  clients can't distinguish "my payload was bad" from "server broke."
- **Fix:** Wrap body parsing and return `400 {"error":"Invalid request."}`; in the catch‑all return a generic
  `"server error"` string and log the detail server‑side only.

---

## MINOR / hardening

- **Embedded‑markup image scan is partial (defense‑in‑depth gap).** `server.js:133-134` scans only the first
  4096 + last 2048 bytes. A valid JPEG with `<script>alert(document.cookie)</script>` at byte 5000 was **stored**
  (verified). This is **not exploitable** because `/img/:id` is served with `X-Content-Type-Options: nosniff`,
  an explicit `image/*` Content‑Type, and `Content-Disposition: inline` (all verified) — browsers will not
  interpret it as HTML. But the scan gives false assurance; consider scanning the full buffer or (ideal, but
  needs a dep) re‑encoding uploads. Since bytes are stored verbatim (zero‑dependency, no re‑encode), the nosniff
  header is the *actual* protection — keep it on every image response.
- **`ownerEmail` is collected but never surfaced.** `pubMemorial` (`server.js:206-207`) omits it and the admin
  queue uses `pubMemorial` (`server.js:347`), so the buyer email that the refund/removal workflow depends on is
  effectively write‑only (recoverable only by grepping `data.json`). Either show it in the admin card or stop
  collecting it. (Note: omitting it from public views is *correct* — it prevents PII leak; the gap is that admin
  can't see it either.)
- **`toast()` builds `innerHTML` from `location.href`.** `public/app.js:176,178`. Not exploitable — browsers
  percent‑encode `<>"` in `location.href`, and CSP `script-src 'self'` blocks any injected inline handler — but
  prefer building the link with `textContent`/DOM nodes rather than string‑concatenating the URL into markup.
- **`Content-Disposition: inline` on `/img/`** (`server.js:266`) is fine for images given nosniff; `attachment`
  would be marginally stricter but hurts the intended inline display. Acceptable as‑is.
- **CSP uses `style-src 'unsafe-inline'`** (`server.js:53`) — required by the inline `style="…"` attributes in
  `index.html`/`admin.html`. Mild weakening (style injection only, no script). Acceptable; could be tightened by
  moving inline styles to classes.
- **MIME map is small** (`server.js:226`): unknown static types fall back to `application/octet-stream`; with
  nosniff this is safe (download, not execute).

---

## WHAT'S ALREADY CORRECT (verified live)

**Image pipeline**
- Path traversal on `/img/:id` blocked by `IMG_ID_RE = /^[a-z0-9-]+\.(jpg|png|webp)$/` — `../data.json`,
  `..%2f..%2fdata.json`, `%2e%2e/…`, `../../etc/passwd` all → 404. No `/` or `..` can pass.
- Magic‑byte validation + declared‑type match: a GIF claiming `image/jpeg` and mismatched headers are rejected;
  `<script>` / `<svg>` in head/tail rejected (400 "not a valid photo").
- `ALLOW_IMAGES` gate honored; empty (<64 B) and >700 KB decoded buffers rejected; 60 MB pending cap **checked
  before** storing; body cap 1.6 MB.
- Served with `nosniff` + explicit image Content‑Type + `Content-Disposition: inline` + `Cache-Control` — so
  stored bytes cannot be sniffed into HTML/JS.

**Stripe correctness**
- Webhook HMAC‑SHA256 verify with ±300s timestamp window and timing‑safe compare (`server.js:174-181`);
  no‑signature and bad‑signature both → 400 (verified).
- Amount is **server‑set** from tier (`server.js:281,303`); client `amountCents`/`price` in the body are ignored
  (verified — underpay attempt still priced by server).
- `/api/confirm` re‑verifies `payment_status==='paid'` via Stripe before fulfilling (`server.js:328-330`);
  fulfillment is **idempotent** via the `p.fulfilled` flag, shared by webhook + confirm (`server.js:184-193`).
- **Demo→live seed purge verified:** booting live over a `seededDemo` DB renamed it to
  `data.demo-backup-*.json`, reset to empty (`total:0`, `demo:false`), and `sweepImages()` cleared all orphan
  images to 0. `/api/demo-pay` returns 404 in live; HSTS present in live, absent in demo (correct).

**Review queue / state integrity**
- `approved:false` memorials stay **off** `/api/meadow`, `/api/memorial`, and `/api/state` totals + `today`
  (verified pre/post approve: meadow 10→11 only after approve; state total unchanged until approve).
- Atomic writes: `save()` uses a unique tmp name (`crypto.randomBytes(6)`) + `rename` (`server.js:82-86`).
  60 concurrent checkouts → `data.json` stayed valid JSON, all 60 recorded, **no** stray `.tmp` files.
- `pubMemorial` omits `ownerEmail`/`amountCents` → no PII/price leak to public.
- `isAnniversaryToday` is robust: regex guard + `isNaN(new Date(...))` guard — no throw on `2024`, malformed, or
  garbage dates (`server.js:210-217`).

**Admin**
- Timing‑safe token (length check + `crypto.timingSafeEqual`, `server.js:46-51`); wrong/absent token → 403.
- Token required on every admin op (in body for POST) — not cookie‑based, so no CSRF surface.
- Destructive endpoints rate‑limited (approve/reject 30, remove 10) and every action `console.log`‑ged with id +
  timestamp. Reject/remove unlink the image; `sweepImages()` is a backstop.

**Headers / CSP / static**
- Every response (JSON, image, 404, HEAD) carries `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer`, and the full CSP; HSTS added in live only.
- CSP is coherent: **no inline `<script>` anywhere** (index/admin/legal all load external `*.js`), no inline
  event handlers, `script-src 'self'`, all app fetches same‑origin, and every external resource (Google Fonts
  css/gstatic fonts, data: favicon, inline styles) is whitelisted. `frame-ancestors 'none'` + `base-uri 'none'`.
- Static traversal blocked (`path.normalize` + `startsWith(PUBLIC_DIR)`); HEAD supported (200, empty body,
  headers present); oversize bodies → 413 (streaming cap drops chunks early).

**Persistence/ops**
- Both `data.json` and `images/` live under `DATA_DIR` → a Railway volume mounted there survives redeploys.
- `preflight.js` blocks live launch on missing webhook secret, non‑https `BASE_URL`, placeholder
  `CONTACT_EMAIL`, missing/short `ADMIN_TOKEN`, or non‑writable `DATA_DIR`.

---

## Fix checklist (in priority order)
1. **B1** — off‑volume backups + restore for `data.json` and `images/`.
2. **B2 / M1** — move stale‑pending prune into the runtime interval; fix `clientIp` to trust the correct XFF hop.
3. **M2** — guard `JSON.parse` → 400; stop echoing raw exception messages.
4. MINORs — email visibility in admin, avoid `innerHTML` of `location.href`, optional full‑buffer image scan.
