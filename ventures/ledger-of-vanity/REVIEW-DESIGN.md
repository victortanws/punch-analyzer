# The Ledger of Vanity — Design & UX Review

_Reviewer: product design. Method: close read of `public/index.html`, `public/legal.html`, `server.js`, `seed/`, plus a live demo-mode run (`PORT=9772 DATA_DIR=$(mktemp -d) node server.js`) driving the full checkout → confirm → stack flows via the API. Contrast ratios computed from the actual CSS tokens._

---

## Verdict: **Ship after polish**

The craft is real. The voice is disciplined and consistent, the copy is genuinely funny, the moderation/stacking/refund logic is honest and technically sound, and the gold-on-black type mostly clears WCAG AA (better than most sites in this aesthetic). The product is _honest_, which is the whole joke and the whole press hook.

But two things stand between this and "ship": **(1) the core money loop — rivalry — is not actually built**, so the site converts a first payment and then goes quiet; and **(2) the celebrity seed is a launch-day liability the project's own attribution file tells you to remove.** Neither is deep; both are cheap to fix. Fix the blocking items, do a half-day of polish, and this ships.

---

## Blocking issues (fix before launch)

### B1. The rivalry loop — the thing that drives a _second_ payment — doesn't exist yet.
The README states the psychology plainly: _"every overtake invites a counter-payment."_ But there is no overtake. Nothing tells a patron they've been passed. There are no accounts, no emails captured, no "you were #3, now you're #5" moment. The only feedback a payer ever gets is the one-time success toast. `README.md` lists "overtake alerts by email" under **"Later:"** — i.e. the revenue engine is explicitly deferred. A pay-to-be-ranked site with no re-engagement mechanism is a one-shot novelty, not a viral loop. **This is the single highest-impact gap in the product.** At minimum for launch: capture an email at checkout ("we'll tell you if you're overtaken") and send that one email. Even a client-side "you've dropped to rank N" banner on return visits (store last-known rank in `localStorage`) is better than nothing and is an afternoon of work.

### B2. The Cristiano Ronaldo seed is a real legal/tonal liability, and your own repo says so.
`seed/ATTRIBUTION.md` already flags it: _"a celebrity's likeness on a commercial site raises publicity-rights questions beyond the CC photo licence itself... remove or replace this entry before any live launch."_ The CC BY-SA licence covers the _photo_, not Ronaldo's _right of publicity_ — using a global celebrity's face and name to sell a commercial product, unprompted, is exactly the impersonation/likeness problem the ToS spends three paragraphs disclaiming. It also undercuts the deadpan-honesty tone: the site's credibility rests on "we only sell a number," and the marquee example is a famous person who plainly didn't pay. `server.js` already handles this correctly in live mode (it archives `seededDemo` data and starts clean when `STRIPE_SECRET_KEY` is set), so the seed never reaches a real ledger — **but the demo, screenshots, and any press preview all lead with Ronaldo.** Swap the seed to a fictional-but-charming Patron Supreme (or inscribe yourself for $5 at launch, as the attribution file suggests) so the _showcased_ experience is the one you can defend.

### B3. The throne is trivially cheap to take, which makes "Patron Supreme" feel worthless.
Verified live: a single **$25** tribute instantly dethroned Ronaldo ($5) and became "Patron Supreme" with a same-day "First inscribed" date. Rank is _cumulative_, but with a seed field topping out under $5, the crown costs pocket change and the #1 slot will churn hourly at launch among people spending $25. That's bad on two fronts: (a) the throne reads as low-stakes, not opulent, when it's claimable for the price of lunch; (b) the "First inscribed [today]" line under a brand-new throne-holder is faintly absurd ("Patron Supreme, reigning since... 90 seconds ago"). This is partly a seed-economics problem (see B2 — real seeds should include one credible larger tribute) and partly a copy problem: the throne needs to _telegraph_ that it's contested and cheap-to-lose, turning churn into the feature ("Rank I has changed 14 times this week") rather than an embarrassment.

---

## Major issues

### M1. Too much in one modal, and the payment commitment isn't stated at the moment of payment.
The inscribe modal asks for name + declaration + 140-char counter + image upload + amount presets + custom field, then "Pay $25" — six decisions before payment. That's survivable (it's all optional except name+amount), but the bigger problem is **the word "final"/"non-refundable" appears everywhere _except_ next to the Pay button.** It's in the footer, the ledger note, the upload note, and the terms modal — but a stranger about to spend $25 sees "Pay $25" with no adjacent "tributes are final, non-refundable" microcopy. Add one faint line under the Pay button. This is a trust _and_ chargeback-prevention win for ~10 minutes of work.

### M2. The share toast gives the sharer nothing worth sharing.
The post-payment tweet reads: _"I hold rank [N] on The Ledger of Vanity. It confers nothing. [url]."_ For anyone below the top ~10 that's "I am rank 47 of a list that confers nothing" — self-deprecating, but not something people broadcast. There's no image, no OG card tuned to the entry, no bragging surface for the person who _just paid you._ The `twitter/intent` link also has no pre-filled hashtag or handle, and X's `summary` twitter-card (line 11) shows a generic site card, not the patron's inscription. Give winners something to flex: "I claimed Rank I 👑" for top ranks, a per-entry OG image, and a copy-link button (not everyone is on X). The moment right after payment is your only guaranteed-attention window and right now it's spent on a joke rather than a share.

### M3. No focus-visible indicator on text inputs — a real keyboard-a11y regression.
`input:focus, textarea:focus { outline: none; ... }` and the same on the search field remove the browser's focus ring and replace it with only a `border-color` change from `#2b2820` → gold. On a dark field that shift is subtle and, for the search input, the border is already faint. Removing `outline` without a robust replacement fails WCAG 2.4.7. The preset/upload/pager/ghost buttons keep the default outline (fine), so the fix is just: don't kill the outline on inputs, or add a `:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }`. The dialogs also lack `aria-labelledby` tying the heading to the dialog (native `<dialog>` gives focus-trap + Esc, so this is minor, but the labelling is a quick add).

### M4. The stacking rule is explained honestly but is still the most confusable thing on the site.
"Spell your name exactly to stack" + "your entry shows the name/declaration/image of your _largest single_ tribute" is a genuinely non-obvious two-part rule, and it's the one most likely to generate angry "I paid and my new message didn't show up!" emails. The logic itself is _correct and defensible_ (verified: a $1 troll payment cannot overwrite a $100 inscription; case-insensitive stacking works). But it's explained in dense prose in three places and demonstrated nowhere. Two cheap mitigations: (a) after a stack that _doesn't_ change the display, the success toast should say so ("Your tribute stacked to $X. Your display still reflects your largest tribute of $Y — pay $Z to change it."); (b) show a live "You're stacking onto an existing $X inscription" hint in the modal when the typed name matches an existing entry. Right now the only feedback is a rank number that may not move the way the payer expected.

---

## Minor polish

- **`gold-dark` (#8a7440) fails AA for normal text (4.2:1).** It's used for ranks IV–X, the monogram fallback letter, and the custom-amount `$` glyph. Passes large-text (3:1), and ranks/monograms are large-ish serif, so it's borderline rather than broken — but nudging it one stop brighter (toward `--gold` #c9a961, 8.7:1) costs nothing and helps the small `$` glyph most.
- **No client-side guard on an empty custom amount.** Verified: with "Other" selected and the field blank, the button reads "Pay $—" but the submit handler still POSTs `amountCents: 0` and relies on the server's 400. The user gets a raw error instead of a disabled button. Disable the Pay button (or block submit) when `selectedCents < 100`.
- **"First inscribed [date]" on the throne is charming until the throne turns over fast** (see B3) — consider "Rank I since [date]" or dropping it when the holder is < 24h old.
- **Empty-ledger and no-results states are excellent** ("The Ledger awaits its first name. Immortality has never been cheaper." / "No inscription matches ""X"". A tribute would fix that.") — voice is consistent here, keep them.
- **The `alt=""` on roll thumbnails is correct** (decorative, name is adjacent text); the throne portrait correctly gets `alt="Image for [name]"`. Good a11y instincts already present.
- **Pager vs infinite scroll:** pagination (24/page) is the right call for a _ranked_ list — infinite scroll destroys the sense of position and makes "I'm on page 3" ungraspable. But at 10,000 entries, page 417 is unreachable in practice; add a "jump to my rank" affordance once the list is large. At 61 entries it's fine.
- **Search is discoverable** (visible field with placeholder + magnifier glyph), but the glyph `⌕` renders inconsistently across platforms; a proper SVG or the more common 🔍-style path is safer. Search correctly preserves _global_ rank in results (verified: matches showed ranks 7, 13, 40, 59 — not renumbered), which is exactly right.
- **`legal.html` still has `[Your legal name]` / `[your state/country]` placeholders and `hello@example.com`.** Expected pre-launch, but it's a hard blocker for _taking money_, so flag it on the go-live checklist. (`CONTACT_EMAIL` env var overrides the mailto at runtime; the legal-page placeholders do not auto-fill.)
- **`README.md` is stale on one point:** it says display uses "the most recent spelling and motto," but the code (correctly) uses the _largest tribute's_ spelling/motto. The code behavior is the right one; fix the README so it doesn't mislead a future maintainer.

---

## What already works well

- **The voice is the product, and it's consistently excellent** — masthead creed, empty states, error copy ("The Ledger records names, not advertisements."), the withdrawal toast ("The Ledger pretends not to judge."), the terms modal. Deadpan-luxury is sustained end to end. This is the hardest thing to get right and it's right.
- **The honesty is a genuine moat.** "We sell exactly one thing: a larger number beside a name" — stated on the page, in the modal, in terms, in legal — is both the joke and the chargeback defense. Refund policy is clear, fair, and legible.
- **Moderation is thoughtful and technically real:** homoglyph folding, word-boundary matching that dodges the Scunthorpe problem (verified: "Scunthorpe United" passes), collapsed-substring matching for spaced-out slurs, spam/URL blocking, plus admin `remove` _and_ `censor` (strip image/motto without refunding rank) that exactly match what the ToS reserves.
- **The money mechanics are sound:** largest-tribute-wins prevents griefing (verified live), case-insensitive stacking works, ties break by first-inscribed, the throne never shows demo payers on a live ledger (auto-archive on Stripe key present), idempotent fulfillment, real webhook signature verification, image magic-byte validation + size cap + orphan sweep. This is a well-built backend.
- **Contrast is better than the genre.** Body 15.9:1, dimmed 6.2:1, faint 5.4:1, gold labels 8.7:1 — all pass AA. Only `gold-dark` at small sizes is borderline.
- **Mobile (≤600px) layout is considered:** the roll regrid drops the rank/image/name to a row with the sum wrapping to `justify-self:end`, search goes full-width, amount presets go 2-up. It reflows sensibly.

---

## Top improvements, ranked by impact ÷ effort

| # | Change | Impact | Effort | Why |
|---|--------|--------|--------|-----|
| 1 | **Add a "you've been outranked" loop** — capture email at checkout, send one overtake email; or a return-visit "you dropped to rank N" banner via localStorage as a v0 | ⭐⭐⭐⭐⭐ | M | This _is_ the revenue engine; without it the site is a one-shot |
| 2 | **Swap the Ronaldo seed** for a fictional Patron Supreme (or self-inscribe $5) | ⭐⭐⭐⭐⭐ | S | Removes a real publicity-rights liability your own repo flags; protects the tone |
| 3 | **Add "final · non-refundable" microcopy under the Pay button** | ⭐⭐⭐⭐ | XS | Trust + chargeback defense, ~10 min |
| 4 | **Upgrade the share payload** — "Rank I 👑" for top ranks, per-entry OG image, copy-link button | ⭐⭐⭐⭐ | M | The post-payment moment is your only guaranteed attention; spend it on a flex, not a shrug |
| 5 | **Fix input focus-visible** (don't strip `outline` without a replacement) + dialog `aria-labelledby` | ⭐⭐⭐ | XS | Real keyboard-a11y regression, trivial fix |
| 6 | **Make stacking legible in-flow** — modal hint when name matches an existing entry; success toast that explains a no-op stack | ⭐⭐⭐ | S | Prevents the most likely angry-email category |
| 7 | **Guard empty custom amount client-side** (disable Pay when < $1) | ⭐⭐ | XS | Avoids a raw server error in a common path |
| 8 | **Brighten `gold-dark`** at small sizes; replace the `⌕` glyph with an SVG | ⭐⭐ | XS | AA compliance + cross-platform consistency |
| 9 | **Throne economics/copy** — seed one credible larger tribute; reframe "since [today]"; lean into "Rank I changed N times this week" | ⭐⭐⭐ | S | Makes the crown feel valuable and turns churn into a feature |
| 10 | **Pre-launch checklist:** fill `legal.html` placeholders, set `CONTACT_EMAIL`, fix stale README | ⭐⭐⭐ | XS | Hard blockers for taking real money |

_No files were modified during this review; the demo server and its temp data directory were torn down afterward._
