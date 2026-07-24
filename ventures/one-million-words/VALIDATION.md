# VALIDATION — One Million Words

Reviewed 2026-07-03. Method: full code review of `server.js` and `public/index.html`, live server run in demo mode, API edge-case testing via curl (validation, moderation, rate limit, full checkout → demo-pay → confirm flow), and in-browser DOM measurement at desktop (1280×720) and mobile (375×812) viewports.

## Verdict: SHIP AFTER FIXES

The concept lands instantly, the desktop aesthetic is genuinely good, and the backend is more robust than most indie launches (signed webhooks, idempotent fulfillment, atomic writes, rate limiting, XSS-safe rendering). But the two emotional cores of the product — *seeing who wrote each word* and *seeing your own word in the story after paying* — are both broken on mobile, and a real-money product is shipping with a placeholder contact email and no terms. Fix the blockers; the rest can follow.

---

## Blocking issues

### B1. Word attribution is completely inaccessible on touch devices
The tooltip is driven exclusively by `mouseover` + `mousemove`. Measured behavior: `#tip` has `position: fixed` but no initial `top`/`left`, so it sits at its static layout position — **y ≈ 1609px, far below an 812px viewport**. On a tap (which fires `mouseover` without a preceding `mousemove` on iOS), the tooltip populates and fades in *off-screen*. The page even instructs "Hover any word to see who set it in ink" — a promise a phone user cannot redeem. Attribution is the product's soul ("your name in the book"), and the majority of $1-impulse traffic will be mobile. Needs a tap-to-show pattern (tap word → positioned popover, tap elsewhere → dismiss) or an inline treatment. Keyboard users are equally locked out (spans are unfocusable — see A11y below).

### B2. The fixed composer covers the newest words — including the buyer's just-purchased word
Measured at 375×812: the composer is **216px tall** (label + wrapped inputs + wrapped button + error row), while `main` reserves only `padding-bottom: 10rem` (160px). The last ~2 lines of the story — always the newest words, plus the blinking caret — sit permanently under the bar. Worse: after payment, `scrollIntoView({block:'center'})` cannot compensate when the story is short; I measured the highlighted purchased word at y=682–707, i.e. **hidden behind the composer (top = 596)** at the exact post-payment moment the product is supposed to celebrate. Fix: increase bottom padding to match real composer height (or measure it in JS), add `scroll-margin-bottom` to `.w`, and tighten the mobile composer (drop the label row or shrink it).

### B3. Placeholder contact email and zero legal/trust scaffolding on a paid product
The footer links `mailto:hello@example.com`. That is a trust-killer for a stranger deciding whether to hand over a dollar — and it means no working support channel for payment disputes. There are also no terms of service, no privacy note, and the refund position ("redacted without refund") exists only as one italic footer line. Stripe live mode effectively requires a real support contact and refund/dispute policy. Minimum fix: real email, a short terms page (what you're buying, no refunds, moderation policy, book logistics), linked from the footer and ideally from Stripe checkout.

---

## Major issues

### M1. Canceled checkout throws away the user's word
On `?canceled=1` the toast reads "The word went unwritten. The story waits." (lovely) — but the composer is empty because the page did a full navigation to Stripe and back. The user who hesitated at the payment screen returns to a blank input and must retype and recommit. This is the highest-intent user you have. Stash the word/signature in `localStorage` before redirecting and restore them on cancel.

### M2. Contrast failures on supporting copy (WCAG AA)
`--ink-faint` (#8f8672) on parchment (#f6f1e6) computes to **~3.2:1**, below the 4.5:1 AA threshold — and it's used for small text everywhere it matters: the progress label (11.5px uppercase), the composer's only label, the story-note instructions, and the footer's permanence/redaction policy. The policy text you most need people to read is the hardest to read. `--ink-soft` (7.1:1) and `--accent` (7.3:1) both pass; darken `--ink-faint` to roughly #6e6650 territory.

### M3. `aria-live="polite"` on a story that fully re-renders every 8 seconds
`render()` wipes and rebuilds all word spans on every poll, even when nothing changed. With `aria-live` on the container, screen readers will re-announce the entire story every 8 seconds — thousands of words of spam. The rebuild also destroys any text selection every 8s (try copying a passage) and orphans an open tooltip. Fix: diff-append new words only; put `aria-live` on a small status region ("Word 65 added by Mara V."). Meanwhile the *error* message (`#composerError`) has no `aria-live` at all, so invalid-word feedback is silent to screen readers.

### M4. The story becomes unreadable past word 5,000 — undermining the premise
`publicState()` returns only `words.slice(-5000)`. Once the story passes 5,000 words (i.e., after just 0.5% of the journey), "Once upon a time," disappears, the drop cap lands on an arbitrary mid-sentence word, and there is no way to read earlier text — no pagination, no archive. For a product whose promise is a single permanent monument ("It appears in the story instantly and permanently"), the front page silently discards the beginning. Latent today, structural tomorrow.

### M5. No finale state at word 1,000,000
The server correctly refuses word 1,000,001 with charming copy ("It is finished."), but the front end has no completion treatment: the composer bar remains, the button still says "Set it in ink — $1", and the only signal is a small italic error line. The most important moment in the product's life renders as a form validation failure. Also there's no "how do authors get/buy the book" answer anywhere — the promise ends at "crediting every author" with no logistics (do contributors receive a copy? at what cost? roughly when?). A one-line answer in the How section would close the loop honestly.

### M6. The progress bar is a 2px sliver that reads as "broken," and there's no share loop
Measured: 2px of fill on a 544px track. At 0.006% the bar communicates futility, not momentum. Either reframe progress around momentum ("word 64 · 12 authors · 9 words this week") or milestone chunks ("64 / 1,000 to the first milestone"), and keep the millionth-word framing in copy. Separately: the post-payment toast vanishes after 7 seconds and there is no permalink to your word, no share card, no OG/Twitter meta tags at all. A product that depends on strangers arriving has no mechanism for one buyer to summon the next.

---

## Minor polish

- **Enter in the signature field does nothing** — only `#wordInput` has the Enter handler. Wrap the composer in a `<form>` and submit on Enter from either field (also fixes the button being `type=button` semantics).
- **Double-submit guard missing**: `submit()` never checks `payBtn.disabled`, so mashing Enter fires multiple `/api/checkout` POSTs, littering pending sessions and burning the rate limit (15/min is easy to hit accidentally this way).
- **Signature field has no `<label>`** — placeholder-only labeling fails once text is typed and is weak for screen readers.
- **Toast overlaps the composer inputs on mobile** (measured toast at y=618–692 over inputs at y=656–706) and has no explicit `z-index`.
- **Pending sessions never expire** — every abandoned/canceled checkout lives in `data.json` forever. Sweep entries older than ~24h.
- **Scunthorpe false positives in moderation**: substring matching blocks legitimate author names (e.g. "Matsushita" contains a blocklisted substring). Word-boundary or whole-token matching for author names would be kinder.
- **No favicon** (404 noise) and no `og:`/`twitter:` meta (covered in M6).
- **First paint is an empty page** until `/api/state` returns — a brief flash with no loading state; the drop cap pops in late.
- **7s toast is the only receipt** — after it fades, the highlight survives until reload but nothing else records "you own word #65." Even a persistent small line under the progress label would help.
- **Demo-pay skips any simulated checkout page** — the "payment" is an instant redirect, so demo mode never demonstrates the Stripe step it's simulating. Acceptable, but a one-screen fake checkout would make demos more convincing.

## What already works well

- **The pitch is instantly graspable.** Title, subtitle, "Continue the story — one word, one dollar," and "Set it in ink — $1" form a complete, honest funnel in four lines. Nothing to explain.
- **The literary register is consistent and genuinely charming**, including error states: "The story needs a word." / "Not that word. The story deserves better." / "One word at a time, wordsmith." / "The word went unwritten. The story waits." All verified live; not one line breaks voice.
- **Desktop visual design is strong**: the parchment palette, EB Garamond, drop cap, justified hyphenated text, and the blinking caret at the story's edge (a quiet, brilliant invitation) look like a real object, not a template.
- **Validation and moderation are tight and well-messaged** (tested: multi-word, numbers, emoji, leetspeak, 25-char, profane word and profane signature all rejected with correct, in-voice errors).
- **Backend fundamentals exceed the bar for a launch this size**: signed Stripe webhooks with timing-safe comparison, idempotent fulfillment (webhook + confirm race is safe), atomic file writes, path-traversal guard on static serving, `textContent`/escaping everywhere user text renders (XSS-checked), body size limits, per-IP rate limiting.
- **The redaction policy is the right design** ("redacted, never renumbered" — word numbers as permanent addresses) and the footer states it plainly; it just needs to be more readable (M2) and backed by real terms (B3).
- **`env(safe-area-inset-bottom)` on the composer, ≥16px inputs (no iOS focus-zoom), and left-aligned story text on small screens** show real mobile care in the CSS — which is why the mobile-breaking issues above are fixable rather than structural.
