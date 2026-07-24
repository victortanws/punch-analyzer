# Rainbow Bridge — Pre-launch Design & UX Review

_Reviewer: product design. Lens: this is a grief product — "conversion" means removing friction and
doubt for a hurting person, never applying pressure. Reviewed the running demo (seeded meadow),
drove the full checkout→confirm→admin flow via the API, and read `public/index.html`, `public/app.js`,
`public/admin.*`, `public/legal.html`, and `server.js` closely._

---

## Verdict: **Ship after polish**

The foundation is genuinely good and, more importantly, genuinely _kind_. The copy is gentle and free
of dark patterns; refunds are unusually humane; every memorial is review-gated; the security and
accessibility bones are solid. Nothing here is exploitative or broken enough to call for a rework.

But a handful of gaps sit right on the two things this product cannot afford to get wrong: **a grieving
payer feeling confused ("I paid — where is my pet?")** or **feeling mildly misled (paying $10 more for a
benefit that isn't delivered).** Those must be fixed before launch. The rest is polish.

---

## Blocking issues (fix before launch)

### B1. The $29 "eternal" tier promises "room for a longer story" it does not deliver
`index.html:308` sells the eternal tier as _"Everything above, plus a candle that always glows and room
for a longer story."_ But there is only one `words` textarea, capped at 280 characters for **both** tiers
(`index.html:280` `maxlength="280"`; server `MAX_WORDS = 280` at `server.js:36`), and no tier-dependent
logic anywhere in `app.js`. So the paid upgrade delivers the candle only — the "longer story" is copy for
a feature that isn't built. Charging a bereaved person $10 more for an undelivered benefit is exactly the
kind of thing that reads as grief-exploitative, even if unintended. **Fix:** either raise the limit for
eternal (e.g. 280 → 600+ and enforce it per-tier server-side) or delete the "room for a longer story"
clause and let the candle stand as the difference.

### B2. Post-payment reassurance is ephemeral, and there is no durable proof the memorial is safe
On return from checkout, the only confirmation is a toast that auto-dismisses after 20s
(`app.js:172`), and the `?sid=` is immediately stripped from the URL via
`history.replaceState(null,'','/')` (`app.js:174`). Because memorials are **review-gated** (they do not
appear immediately) and there are **no accounts**, a payer who glances away, then searches the meadow and
can't find their pet, has _nothing_ telling them it's coming. For a grief product this is the single
highest-risk path — it invites a "was I scammed?" spiral at the worst possible moment. **Fix:** replace
the toast with a persistent confirmation (a dedicated thank-you dialog/state that stays until dismissed),
and in live mode send an email receipt/confirmation that restates "in review, appears within a day, here's
how to reach us." Keep a way to re-reach the confirmation on reload.

### B3. Support email is a placeholder — and the entire trust model routes through it
`CONTACT_EMAIL` defaults to `hello@example.com` (`server.js:22`), surfaced in the footer "Write to us"
and throughout `legal.html`. The refund promise, corrections, takedowns, and the B2 reassurance all depend
on "write to us." Launching with a dead address breaks the promise the whole product is built on. This is
config, not code — but it is a hard launch-checklist blocker. Set a real, monitored address (`preflight.js`
should assert it).

---

## Major issues

### M1. The recurring-engagement value prop is quietly broken by the form's own date placeholders
"Today we remember" (`server.js:210` `isAnniversaryToday`) and the planned yearly remembrance email both
require a passing date with a real month **and** day. But the form's date fields are labelled "Born/Passed"
with placeholders `2011` / `2024` (`index.html:275-276`) — year only — so most people will enter just a
year, and the anniversary features will **never fire** for them. I confirmed this: the seeded meadow (all
bare years) shows an empty "today" strip; only a memorial I created with `2020-07-11` appeared under "Today
we remember." The site's stated retention engine (README: anniversary email + "today we remember") is
undercut by its own input design. **Fix:** invite an optional full date (or month+day) gently — e.g. a
"Date they passed (optional)" field with a real date affordance — without ever pressuring exact dates on a
grieving person.

### M2. Photo-less memorials fall back to full-color system emoji — under-dignified, and many will land here
When there's no photo, the locket renders a species emoji (🐕🐈🐦🐇🐎🐾) at 2.6rem (`app.js:28`,
`index.html:107`). Against the somber twilight palette and beside real photographs, the stock color emoji
read as slightly cartoonish/childlike for a memorial. This matters _a lot_ because two forces push many
memorials into the fallback: (a) plenty of users won't upload a photo, and (b) **HEIC** — the iPhone
default — is rejected (see M3), routing exactly the bereaved-owner-on-a-phone demographic to the emoji.
**Fix:** replace the emoji with muted, monochrome line silhouettes per species, tinted to `--gold-soft`/
`--ink-dim`, matching the serif/twilight aesthetic. Inline SVG keeps it CSP-safe and consistent.

### M3. HEIC photos (iPhone default) are rejected with no path forward
Upload accepts `image/jpeg,image/png,image/webp` only (`index.html:289`); a HEIC file trips
`im.onerror` → _"We couldn't read that photo (HEIC isn't supported…)"_ (`app.js:138`). The error is
graceful, but a grieving owner's best photo of their pet is very often HEIC, and the message offers no way
to succeed. **Fix:** at minimum, add actionable guidance ("On iPhone: open the photo, tap Share →
'Save as JPEG', or take a screenshot"). Better: attempt client-side HEIC handling, or clearly note that
picking from the iOS Photos picker usually auto-converts.

### M4. Contrast: `--ink-faint` (#8a8578) fails WCAG AA on the meadow background
Computed ratios against the gradient's green base (`--meadow-1/2`):
- Years under each locket (`.plot .yr`, ~11.8px): **2.74–3.23:1** — **fails** AA (needs 4.5:1).
- Pager "Page 1 of 2" (`.pager .where`) and footer text: **~2.74:1** at the bottom of the gradient — fail.
- (For reference, body `--ink` is 8.6–14.3:1 and `--gold` links 8.9–11.1:1 — those are fine.)

The failing text is meaningful (a pet's lifespan) or navigational. **Fix:** lighten the token (or use
`--ink-dim` #b9b3a6, which passes at ~5.7:1) for these on-meadow labels, or only use `--ink-faint` on the
darker panels/inputs where it does pass.

### M5. Thin above-the-fold trust for a card-and-photo ask
A grieving, scam-wary visitor is asked for a credit card and a precious photo, yet the homepage carries no
human name, face, or "why we made this" — that lives only in the About modal and `legal.html`. It's also
never made explicit before paying that the memorial is **publicly listed and searchable**. **Fix:** add a
short, honest note of who runs this and why (the operator is already named in legal — surface a human line
on the page), and state the public + permanent nature plainly near the CTA/form.

### M6. Tier selector is not a semantic radio group
The two tiers are `<button>`s toggling a visual `.sel` class only (`app.js:120-123`); there's no
`role="radiogroup"`/`radio`, no `aria-checked`/`aria-pressed`. Screen-reader users can't tell which
memorial they're about to buy. **Fix:** make it a proper radiogroup (or native radios) with checked state.

---

## Minor polish

- **"Final once placed" adds doubt at the pay button.** The pay-note (`index.html:318`) leads with
  finality, and "see our refund promise" isn't a link. Given how generous refunds actually are, lead with
  the safety net ("Change your mind anytime — we'll refund, no questions") and make the refund reference a
  real link (new tab, so the form isn't lost).
- **Inputs drop the focus ring.** `input:focus{outline:none;…}` (`index.html:156`, plus the search input
  `index.html:97`) removes the outline for keyboard focus too, leaving only a subtle border-color change.
  Restore a visible focus indicator for keyboard users (the global `:focus-visible` gold outline is good —
  don't override it on inputs).
- **Form error isn't brought into view.** On submit failure the error text is set (`app.js:161`) but not
  focused/scrolled; on a tall dialog it can sit off-screen above the sticky footer. Move focus (or scroll)
  to it.
- **Rate-limit bucket is shared across all endpoints per IP.** `rateLimited` uses one per-IP counter for
  checkout (20/min), approve (30/min) and remove (10/min) alike (`server.js:197`). I hit this in testing:
  a normal burst of admin approvals started returning 429 because earlier checkout calls had already
  filled the shared bucket. Scope buckets per action (or per-IP-per-endpoint).
- **View/About dialogs don't close on backdrop click** (native `<dialog>` only closes on Esc/button) — a
  mild expectation mismatch. Add a lightweight backdrop-click-to-close.
- **Row of three date/species fields is tight at 375px.** `.row2` stays a 3-across flex on mobile
  (no wrap); it's usable but cramped. Consider wrapping species onto its own row on narrow screens.
- **Email captured for a feature that doesn't send yet.** The yearly-remembrance email isn't built
  (README), but the form collects the address now. Fine if launch is close; just be sure the promise
  ("we'll only write on their anniversary") is honored soon.

---

## What works well (keep these)

- **Tone is genuinely gentle and non-manipulative.** No countdowns, no fake "X people viewing," no
  urgency, no upsell nagging. The whole thing respects the reader. This is the hardest part and it's right.
- **Refund policy is humane and plainly worded** (`legal.html:58-62`) — "grief is not a moment for fine
  print." Rare and correct for this category.
- **Review-before-it-appears is set up front** (hero CTA note `index.html:207`) and reinforced in legal
  and the post-pay message — the expectation is established before payment.
- **Canceled-checkout draft restore is excellent** (`app.js:179-191`): every field _including the photo_
  is restored with a reassuring "nothing was charged" note. This is thoughtful and uncommon.
- **Solid a11y/security bones:** native `<dialog>` with focus trap + `aria-labelledby`; reduced-motion
  disables the candle flame (`index.html:117`); lazy-loaded lockets with alt text; decorative emoji marked
  `aria-hidden`; CSP with external JS; timing-safe admin token; path-traversal-safe image route; browser-
  side resize + server-side magic-byte validation and content scan.
- **Permanence promise is clear and repeated**, and honestly hedged ("we can't promise the internet is
  forever") rather than over-claimed.
- **Thoughtful empty/quiet states** ("The meadow is quiet, for now") and the anniversary strip hides itself
  when empty rather than showing an awkward blank.
- **Idempotent fulfillment** (webhook + confirm), pending-image disk caps + sweep, clean pagination
  (verified: 26 memorials → 2 pages, page clamp on overflow), and gentle-but-real text moderation.

---

## Ranked top improvements (impact ÷ effort)

| # | Improvement | Impact | Effort | Notes |
|---|-------------|--------|--------|-------|
| 1 | Fix the $29 "longer story" mismatch (B1) — deliver a longer limit per tier, or remove the claim | High | Low | Trust/honesty; a few lines |
| 2 | Set a real support email + `preflight` assertion (B3) | High | Low | Config; the trust model depends on it |
| 3 | Persistent post-payment confirmation + live email (B2) | High | Med | Prevents the "where is my pet?" panic |
| 4 | Darken `--ink-faint` on-meadow (years/pager/footer) to pass AA (M4) | Med | Low | One-token change |
| 5 | Reword "Final once placed" → lead with the refund safety net; link it (Minor) | Med | Low | Removes doubt at the button |
| 6 | Replace cartoon emoji fallback with muted line silhouettes (M2) | Med | Med | Dignity; affects many lockets |
| 7 | HEIC guidance / handling (M3) | Med | Med | Unblocks iPhone users' best photos |
| 8 | Invite an optional full passing date so anniversary features actually fire (M1) | Med | Low-Med | Unlocks the retention engine |
| 9 | Tier selector as a radiogroup + restore input focus rings (M6, Minor) | Med | Low | A11y correctness |
| 10 | Add a human/"why" line + explicit public+permanent notice near the CTA (M5) | Med | Low-Med | Trust for card-shy visitors |

**No grief-exploitative pressure tactics were found** — and none should be added. The two items that lean
closest to feeling extractive are unintentional (B1's undelivered upgrade, and collecting emails for an
unbuilt feature); fixing B1 and shipping the anniversary email keep the product on the right side of the line.
