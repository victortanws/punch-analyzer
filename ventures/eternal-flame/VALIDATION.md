# The Eternal Flame — UI/UX Validation Report

Reviewed 2026-07-03. Method: full read of `server.js` and `public/index.html`; live testing in demo mode (Chromium at desktop and 375x812; full checkout → demo-pay → confirm flow; canceled-payment flow; empty wall; 300-candle wall; moderation probes via API; WCAG contrast computed from the palette).

## Verdict

**Ship after fixes.** The core concept, aesthetic, and most of the copy are genuinely dignified — this does not feel like a grief cash-grab, and the candle rendering is better than it has any right to be for pure CSS. But there are several defects that will directly wound the exact users this product serves (a grieving person scolded by the profanity filter over a cat named "Spice"; a canceled payment that eats their dedication in silence), one flat-out broken promise in the architecture (the 800-candle display cap vs. "burns for as long as this site exists"), and a placeholder contact email in the footer of a site asking for money. None require a rework; all are fixable in a day or two.

---

## Blocking issues

### B1. The moderation filter insults grieving people over innocent names (verified live)
`server.js` `blocked()` does substring matching after stripping non-letters, so it rejects:
- **"Spice"** (contains "spic") — a common pet name. Rejected.
- **"Grapes"** (contains "rape") — pet name. Rejected.
- **"Old Draper"** (contains "rape") — a surname. Rejected.
- **"Scunthorpe United"** — the canonical case. Rejected.

Worse, the rejection copy is: *"Please choose different words. This is a place of remembrance."* — on a memorial site this reads as an accusation that the mourner was being obscene about their own dead. This is the single most tone-destroying moment in the product and it fires on innocent input. Fix: word-boundary matching plus an allowlist, and rewrite the error to take the blame ("Some of those words are ones we can't display — this is our filter being cautious, not a judgment").

### B2. The filter blocks grandma but not the troll (verified live)
The blocklist is trivially evaded — `"fυck yоu аll"` (Greek/Cyrillic homoglyphs) and a dedication of `"Visit bit.ly/scam-site for cheap pills! Call 555-0199"` both passed and could be paid for. On a grief site the real risks are not swear words: they are (a) mock memorials for **living people** (harassment/bullying — "$9 to put a classmate's name on a death wall" is a genuine abuse vector), (b) spam/scam URLs sitting permanently between real memorials, (c) slurs the 10-word list doesn't cover. There is **no report mechanism** on any candle, and admin removal only exists if `ADMIN_TOKEN` is set. Minimum for launch: a discreet "report this flame" affordance on the detail modal, a queue/hold for review, URL/phone-number rejection in dedications, and an always-configured admin path.

### B3. The permanence promise is architecturally false at >800 candles
Footer: *"Flames burn for as long as this site exists."* But `publicState()` returns `db.candles.slice(-800)` — the moment candle 801 is lit, the oldest paid, "permanent" flame silently disappears from the wall with no other way to see it (no permalink, no search, no archive page). That is the product's one promise, broken by design, for the earliest and most loyal purchasers. Either paginate/lazy-load the full set or add per-candle permalinks + a way to find any flame.

### B4. Placeholder contact email on a site taking money
`<a href="mailto:hello@example.com">Write to the keepers</a>` — literally `example.com`. A purchaser with a problem (misspelled name, wrong dedication, refund request) has no working channel. Also no terms, no refund policy, no privacy note anywhere. For a $9 payment product this is a launch blocker on trust alone.

---

## Major issues

### M1. Canceled payment: total silence and lost words (verified live)
Return with `?canceled=1` shows nothing — no acknowledgment, no reassurance that nothing was charged, and because the page navigated away to Stripe, the name and dedication the user typed are gone. Picture the actual user: they wrote 240 careful words to their dead father, hesitated at the card form, came back — blank page, words erased. Persist the draft in `localStorage` and greet the return with something gentle ("Your flame was not lit and you were not charged. Your words are still here when you're ready.").

### M2. Dialogs are broken-positioned: pinned top-left, not centered (verified live)
The universal reset `* { margin: 0 }` wipes the UA's `dialog { margin: auto }`, so both modals render in the top-left corner of the viewport instead of centered (measured x≈46px in an 800px viewport). The light-a-flame dialog is also 590px tall with no `max-height`/`overflow-y: auto`, so on short viewports the submit button is unreachable. Add `dialog { margin: auto; max-height: 90vh; overflow-y: auto; }`.

### M3. The white flash: `background-attachment: fixed` fails when scrolled (verified live)
With the page scrolled, the body's fixed radial-gradient failed to paint the top of the viewport in Chromium capture, exposing the default **white** canvas — a stark white slab across a night-dark memorial. `background-attachment: fixed` is also long broken on iOS Safari. Belt-and-braces fix: `html { background: var(--night-2); }` and move the gradient to a fixed, `z-index: -1` pseudo-element (or just accept a scrolling gradient).

### M4. The 15-second poll rebuilds the entire wall (verified live)
`refresh()` → `render()` unconditionally does `wall.innerHTML = ''` every 15s even when nothing changed. Measured consequences: keyboard focus is dumped to `<body>` (a keyboard user loses their place every 15 seconds), every flame's CSS animation restarts in unison (the "wall breathes" stagger visibly resyncs — a subtle repeating glitch), and because the wall is `aria-live="polite"`, screen readers are invited to re-announce hundreds of candle names on every poll. Diff against the current candle list (compare newest id + total) and only touch the DOM when something changed; drop `aria-live` from the wall or scope it to a status line.

### M5. "Lit N days ago" text fails contrast at 2.5:1 and 10.9px
`--ink-faint` (#565248) on the night background measures **2.47–2.59:1** — far below WCAG AA's 4.5:1 — at a rendered 10.88px italic. Same color carries the "N flames burn here" count and the "Lit by" line in the modal. This is the emotional metadata of the wall and it is near-invisible. `--ink-dim` (#9a948a, 6.4:1) passes; darken faint to roughly #7a746a or lift these elements to `--ink-dim`.

### M6. In live mode without a webhook, a payer can be charged and get nothing
Fulfillment happens only on return to the success URL (`/api/confirm`) or via the webhook — and the webhook no-ops unless `STRIPE_WEBHOOK_SECRET` is set (it is merely "recommended"). A user who pays and closes the tab is charged with no candle lit, and there's no email or reference to recover it. On a grief product, "we took the money and no flame appeared" is reputationally fatal. Make the webhook mandatory in live mode (refuse to start without it), and show the candle id/permalink on the confirmation.

### M7. No way to return to your own flame
After purchase you get a toast and your candle at the top — but no permalink, no highlight/scroll-to (the confirm response includes the id and the UI ignores it), no search. The entire emotional value proposition is "you can come back to this." Within weeks a purchaser cannot find their flame without scrolling hundreds of candles. Add `/?flame=c123`-style deep links (opening the detail modal) and print that link in the confirmation moment.

---

## Minor polish

1. **Empty-wall copy**: *"The first one waits for someone worth remembering"* — "worth remembering" implies a worthiness test for the dead, and the sentence functions as a sales nudge. Something like "No flames burn here yet. The first will be lit for someone loved." keeps the quiet.
2. **The kind selector is decorative**: the user is asked to classify their loss (Person / Companion / Something else) and the answer changes nothing — candles and detail modal render identically for all three. Either differentiate subtly (e.g., slightly different candle silhouette) or drop the question; asking a mourner for data you discard is mildly disrespectful.
3. **Dialog accessibility**: `#viewModal` has no accessible name (add `aria-labelledby="viewName"`); the "They were a" label isn't programmatically associated with the kind buttons (use a `fieldset`/`legend` or `role="radiogroup"`), and the kind buttons lack `aria-pressed`/`role="radio"` state.
4. **Candle `aria-label` drops information**: the label is only "Flame in memory of X" — it overrides the visible "lit N days ago", and nothing indicates a dedication exists until the button is activated. Minor, but easy to enrich.
5. **Toast timing**: 7s fixed, no dismiss, and the confirmation ("The flame is lit. It burns among the others now." — lovely line) can be missed entirely. Consider making the *candle itself* the confirmation: scroll to it and let its glow swell once.
6. **prefers-reduced-motion**: correctly kills `flame`/`glow` animations (good), but hover transitions and the toast slide remain; also fine to leave — just noting it was actually handled, which is rare.
7. **Backdrop click doesn't close dialogs**; Esc works (native). At minimum the view modal should close on backdrop click — it's a reading surface, not a form.
8. **Google Fonts dependency**: a third-party request (with privacy implications) on a memorial site; self-host EB Garamond, which also removes a FOUT on the most atmosphere-critical asset.
9. **Performance headroom**: 300 candles = 600 infinite animations plus `filter: blur(.4px)` per flame; fine on desktop Chromium, worth testing on a mid-tier Android before the wall grows. The `slice(-800)` cap suggests this was anticipated — pagination solves both this and B3.
10. **`.count` disappears entirely at zero** — intentional and correct, but "One flame burns here" → singular handling is already done; nice.
11. **Demo seeds set the tone users will imitate.** Most are pitch-perfect; *"He crossed an ocean so I could complain about wifi"* is warm-funny and arguably fine, but it's the one seed that flirts with jokey — watch whether real dedications drift that way.
12. **No Open Graph/social meta** — when someone shares their flame (they will; grief seeks witness), the link unfurls blank.

---

## What already works well

- **The copy is the product's strongest asset.** "A quiet place on the internet." / "For someone you carry with you." / "What you would say if they could read it" / "Your name, or no name at all" / "Not now" as the cancel label — restrained, second-person, never salesy. The $9 is stated once, plainly, without upsell, urgency, or tiers. This is how you ask for money next to grief.
- **The candles genuinely read as candlelight.** Layered glow + gradient flame + blue base + wick + wax, with staggered `nth-child` timing and varied heights so the wall flickers organically instead of blinking in unison. At 375px and at 300 candles it still looks like a wall of votives, not a grid of blobs.
- **Honest permanence framing in principle**: "Flames burn for as long as this site exists. We intend that to be a very long time." is the right, non-grandiose way to phrase it (the code just has to actually honor it — see B3).
- **Solid engineering fundamentals**: XSS-safe rendering (`esc()`/`textContent` everywhere user text lands), atomic file writes, idempotent fulfillment, Stripe webhook signature verification with timing-safe compare, rate limiting, input length caps, path-traversal guard on static serving.
- **Demo mode is clearly labeled** and the banner tone stays factual rather than promotional.
- **Small dignities**: newest flame appears first so a fresh purchaser sees theirs immediately; "Return to the wall" instead of "Close"; the price rendered from the server so display never lies about the charge.
