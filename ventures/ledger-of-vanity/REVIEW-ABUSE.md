# The Ledger of Vanity — Pre-Launch Abuse & Trust Review

Two personas drove this review against a live demo instance (`PORT=9773`, Stripe in
DEMO mode): **(A)** a skeptical first-time buyer, and **(B)** a bad actor trying to
abuse or embarrass the site. Every claim below was reproduced against a running
server via the real checkout → pay → confirm flow and the moderation endpoints;
no source files were modified.

---

## Verdict: **HIGH-RISK — do not launch as-is.**

The scoring/display mechanics (largest-tribute rule, name normalization, magic-byte
image check, admin censor/remove) are actually well-built and do what the ToS says.
The problem is not the code you wrote to *stop the obvious deface* — that works. The
problem is the **product concept combined with a filter that only stops slurs, not
impersonation, defamation, ads, or images**. The single most damaging attack — putting
a real person or brand on the golden "Patron Supreme" throne with a scam or defamatory
declaration for **$6–$8** — sails through untouched, is live the instant Stripe clears,
and is only removable by the owner manually running `curl`. That is a reputational and
legal grenade with the pin already pulled. Fixable, but not in its current state.

---

## Buyer-trust gaps

The buyer story is, honestly, the *strongest* part of the site. It is unusually honest:
the masthead says "It confers nothing," the footer and two separate ToS surfaces say
tributes are final/non-refundable, and the largest-tribute rule is explained in three
places. A skeptical buyer who reads is unlikely to feel *tricked*. Remaining gaps:

- **"I paid and got nothing" is baked into the premise.** The product *is* "a larger
  number beside your name." Even with clear disclosure, a non-trivial share of buyers
  will feel post-purchase regret and reach for a chargeback, because there is no
  tangible deliverable, no email receipt from *you* (only Stripe's), and no persistent
  "here is your inscription" account page. The confirmation is a **toast that vanishes
  and a `history.replaceState` back to `/`** — reload and the "you are rank N" proof is
  gone. Add a durable receipt/permalink (e.g. `/?sid=` that keeps working, or an emailed
  confirmation) so a buyer can always *see what they bought*.
- **The celebrity seed reads as sketchy, not reassuring, on a live site.** "Cristiano
  Ronaldo — $5 — 'best footballer of all time'" with a portrait is obviously not the
  real Ronaldo. To a skeptic this signals "this site fakes entries," which *undercuts*
  trust in every other name on the board and invites "is any of this real?" It's a fine
  demo seed but it must not appear on the live ledger. Good news: the code already
  archives the seed when `!DEMO` (`load()`), **but only if `db.seededDemo` is set from a
  prior demo run in the same data dir** — a fresh live deploy never seeds, which is
  correct. Just make sure production never inherits a demo `data.json`.
- **Unanswered questions a buyer will have:** Who runs this? (ToS operator field is a
  literal `[Your legal name]` placeholder and contact is `hello@example.com`.) What
  stops someone paying under *my* name? How do I get *removed*? Is my payment public
  (name yes, but is my email/IP shown)? None are answered on the main page.
- **Placeholder legal + contact will read as "scam" to the wary.** `hello@example.com`
  and bracketed `[your state/country]` in the terms are trust-killers. Fill these before
  launch or a skeptic bounces.

**Mitigations:** durable per-buyer receipt/permalink; real operator identity + working
support email; a one-line "someone used your name? email us" on the main page, not just
buried in ToS; drop or clearly label the celebrity seed on production.

---

## Abuse vectors that work

Tested live. "PASS" = accepted and published.

### 1. Impersonation of real people and brands — **completely unfiltered** (critical)
The blocklist only screens profanity/slurs. Names and messages naming real people or
brands pass with zero friction:
- `name = "Elon Musk"` → **PASS**, took the throne for **$7**.
- `name = "Official Stripe"`, `"IRS Refund Dept"` → **PASS** (payment-brand phishing framing).
- `motto = "This is really me, send DOGE / DM for a free Tesla giveaway"` → **PASS**.

Because name normalization merges case/whitespace variants, an abuser can reliably
**stack tributes onto an impersonated identity** to hold the throne.

### 2. Buy the #1 throne cheaply to embarrass site-wide — **works** (critical)
Rank 1 is by *total*, and the demo throne sits at **$5**. A single **$6–$8** payment
takes "Patron Supreme," which renders a large gold name, a 148px portrait, and the
attacker's italic declaration at the very top of the page **and** in the OpenGraph/
Twitter share card. Reproduced: `"Elon Musk"` on the throne for $7 with a crypto-scam
motto; `"TOTAL SCAM DO NOT PAY — the #1 patron"` as a self-defeating declaration.
The site's own outrage-bait framing guarantees this gets screenshotted.

### 3. Defamation as a fresh entry — **works** (critical)
`name = "John Smith of Ohio"`, `motto = "…is a convicted fraudster"` → **PASS** for $1.
`"Tom Hanks is a criminal"` → **PASS**. Any real (especially non-famous) person can be
publicly accused for a dollar.

### 4. Forced ranking / involuntary association — **works**
Paid **$50 as an existing name** ("Marge from accounting") and shot that identity to
**rank 1** unwillingly. An attacker can hoist any named person to the top of a site
literally titled *Vanity*, associating them with it against their will.

### 5. Profanity / harassment filter is porous (slurs are OK, everything else leaks)
The `SLUR_SUBSTRINGS` path (collapsed-substring + homoglyph fold) is genuinely
solid — spaced, cyrillic-homoglyph, and unicode-styled slurs were all **BLOCKED**, and
"Scunthorpe"/"Penistone"/"Cassandra" correctly **PASS**. But the general `BAD_TOKENS`/
`BAD_PREFIXES` word-boundary path is trivially evaded:
| Attempt | Result |
|---|---|
| `fuck this` | BLOCKED |
| `f u c k this` / `f.u.c.k` | **PASS** (separators split into 1-char tokens) |
| `f😀u😀c😀k` | **PASS** |
| `motherfucker`, `clusterfuck`, `assfuck` | **PASS** (not at token start) |
| `shitshow`, `fuckington` | **PASS** (>3 trailing chars after prefix) |
| `𝓯𝓾𝓬𝓴`, `ⓕⓤⓒⓚ` | BLOCKED (NFKD fold catches these) |
So harassment like `"you are a f u c k i n g loser and everyone hates you"` publishes fine.

### 6. Advertising / contact-info evasion — **works**
`spammy()` only catches literal `http(s)://`, `www.`, and a *fixed TLD list*
(`com|net|org|io|xyz|ru|info`). Evaded by:
- `"buy at spam dot com"` → PASS
- `.co`, `.ai`, `.shop`, `.gg`, `.app`, `.link` domains → PASS
- Phone numbers, `@telegram_handle`, and raw crypto wallet addresses → PASS
The ledger becomes a cheap classified-ad / crypto-shill board.

### 7. Image content is unseen — magic-byte check is not image validation
The check reads only the first bytes. A file that **starts with a valid JPEG/PNG/WebP
header followed by arbitrary bytes is accepted and stored** (reproduced: `FF D8 FF E0`
+ HTML payload → PASS). More importantly, because the server never re-decodes or
re-resizes, an abuser who bypasses the browser (curl, as done here) can upload **any
real image up to 600 KB**: a celebrity's actual photo, a brand logo, a QR code pointing
to a scam, or shock content. Filters cannot see any of it. Served with an `image/*`
Content-Type, so it won't XSS in a browser — but as *displayed content* it is wide open.
(SVG-labeled-as-PNG and `svg+xml` were correctly rejected — no stored-XSS via image.)

**Mitigations:** a name/impersonation policy is meaningless without *some* gate — at
minimum a denylist of high-profile names/brands + a "claim your own name" verification
path, and treat every entry as impersonation-until-reported for public figures; move
throne/new entries behind a short **hold-for-review queue** rather than instant publish;
switch profanity matching to the same collapsed-substring approach the slur list uses,
and strip separators before tokenizing; expand `spammy()` to a general TLD/`dot`/phone/
`@handle`/wallet heuristic; **server-side re-encode every uploaded image** (decode →
resize → re-emit) so only real, sanitized pixels are stored.

---

## Chargeback / payment risk

- **The product structurally invites "item not received" disputes.** There is no
  tangible good and no durable proof-of-purchase surfaced to the buyer (the "you are
  rank N" confirmation is an ephemeral toast). Stripe's dispute reason codes have no
  natural home for "I bought a number and regret it," so buyers will file *product not
  received* or *not as described* — the two you'll actually lose.
- **Impulse + vanity + alcohol + public embarrassment** is a chargeback-prone buyer
  profile. Expect an elevated dispute rate relative to normal e-commerce. A dispute
  rate above ~0.65–0.9% puts the Stripe account into monitoring programs and, if
  sustained, at risk of termination — which for a one-product site is existential.
- **Refunds-are-impossible policy amplifies disputes.** When you *can't* refund a
  regretful buyer, their only lever is a chargeback. A discretionary "we'll refund if
  you email within 24h and we remove your entry" valve would convert many disputes into
  cheap refunds and protect the Stripe account, even though the ToS reserves the right
  to refuse.
- **Fraud-funded tributes create removal-without-refund liability.** If a stolen card
  funds a throne entry, you'll eat the chargeback *and* the fee even after you remove
  the content — and the content was live in the meantime.
- **Good hygiene already present:** webhook signature verification with timestamp
  window and constant-time compare; fulfillment is idempotent (`fulfilled` flag);
  amount is authoritative server-side (client can't understate the charge). Keep these.

**Mitigations:** durable receipt + emailed confirmation to reduce "not received";
Stripe Radar rules and a per-card/velocity cap; a narrow goodwill-refund path to divert
disputes; consider requiring a minimum tribute for the throne to raise the cost of a
one-off embarrassment.

---

## Reputational & legal landmines

**The screenshot that ends up on social media:** the golden "Patron Supreme" throne
displaying **"Elon Musk"** (or a journalist, a competitor, a local official) with a
portrait and a declaration like *"This is really me — send DOGE"* or something
defamatory/obscene — bought for the price of a sandwich, sitting at the top of a site
called *The Ledger of Vanity*, complete with a ready-made "Announce it on Twitter"
share button the app generates on checkout. That image, plus the caption "you can buy a
celebrity onto this scam site for $7," is the launch-day worst case.

**What forces an emergency takedown, and can the tooling keep up?**
- Triggers: impersonation of a public figure who notices; a defamatory entry about a
  named private person; illegal imagery; a brand logo used deceptively.
- Tooling reality: `/api/admin/remove` and `/api/admin/censor` **work correctly**
  (verified: censor strips motto+image but keeps rank per the ToS; remove deletes the
  name; wrong/absent token → 403). **But** they are `curl`-only, keyed on exact name,
  single-operator, with **no admin UI, no alerting, no report inbox wired up, and no
  pre-publication review**. Content is live the instant payment clears. So takedown
  speed = "however long until the owner personally notices and SSHes in." For a site
  engineered to attract outrage, reactive-only moderation is **not** fast enough.
- **Single-process fragility:** the whole site is one Node process with no supervisor;
  any uncaught exception takes the entire ledger offline until a human restarts it. (I
  hit repeated hard-down states during testing — root-caused to port/PID collisions from
  overlapping runs rather than a payload exploit, but it underscores there is no crash
  recovery.) Run under a process manager with auto-restart.

**Legal exposure the owner is underestimating:**
- **Impersonation & the celebrity seed.** Seeding a real, identifiable person
  (Cristiano Ronaldo) with a fabricated quote and his likeness — even as a demo — is
  itself a right-of-publicity / false-endorsement exposure if it ever ships live. And
  the platform *invites* users to impersonate anyone. "We remove on report" is a
  DMCA-style safe-harbor mindset that **does not cleanly apply to right-of-publicity,
  defamation, or trademark** claims; those can attach to the platform for *displaying*
  the content, not just the uploader.
- **Defamation.** Publishing "X is a fraudster/criminal" about a named private
  individual for $1, with the platform choosing to display it, is a plaintiff-friendly
  fact pattern. Putting responsibility on the uploader in the ToS does not immunize the
  publisher.
- **Copyright on uploaded images.** The "you must hold the rights" clause shifts the
  contractual burden but does not stop takedown/DMCA exposure for infringing logos or
  photos you host and display. You need a real DMCA agent + notice-and-takedown process,
  not just a mailto.
- **Illegal imagery & reporting duties.** You accept arbitrary image bytes with no
  content scanning. If CSAM or other illegal content is uploaded, you have **mandatory
  reporting and preservation obligations** (e.g. to NCMEC in the US) and cannot simply
  delete it. There is currently no hashing/scanning, no preservation path, and no
  documented reporting procedure. This is the single most serious legal gap.
- **Placeholders in the live ToS.** `[Your legal name]`, `[your state/country]`, and
  `hello@example.com` mean the "broad censorship rights" you're relying on are, as
  written, unsigned by any identifiable operator. Fill them and have a lawyer review
  before taking a cent.

**Mitigations:** pre-publication hold/review for the throne and for image uploads;
a real report inbox + DMCA agent + documented takedown SLA; automated known-CSAM
hash scanning (e.g. PhotoDNA/hash-matching) with a preservation-and-report workflow;
a public-figure/brand denylist; remove the real-celebrity seed from any live path;
complete and lawyer-review the ToS placeholders; run under an auto-restarting supervisor.

---

## What's genuinely good (keep it)

- Largest-single-tribute display rule **works**: a $1 payment cannot overwrite a larger
  inscription's name/motto/image (verified) — the core "small-payment deface" is closed.
- Name normalization merges case/whitespace variants into one entry (verified).
- Slur filter (collapsed-substring + homoglyph/NFKD fold) resists spacing, cyrillic,
  and styled-unicode evasion while passing "Scunthorpe" (verified).
- Magic-byte check blocks SVG/`svg+xml` payloads, preventing stored-XSS via image.
- Stripe integration hygiene: signed webhooks, idempotent fulfillment, server-authoritative
  amounts, `noindex` on the legal page.
- The buyer-facing honesty ("it confers nothing," non-refundable stated repeatedly) is
  a real trust asset and a partial chargeback defense.
