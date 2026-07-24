# QuoteCalc Builder — Validation Report

**Overall status: PASS-WITH-FIXES**

Audited independently against the claimed spec (two-pane builder/preview, branding, pricing config, four field types, live breakdown, mailto/WhatsApp lead CTA, standalone export + embed snippet, sample data + localStorage). The core architecture is sound and the generated `calculator.html` export is a genuinely working, self-contained artifact. Three real defects were found and fixed directly in `index.html`; no changes were needed to `README.md` (its claims, including the "Honest limitations" section, all check out against the code).

## Method

- Read `index.html` in full (1918 lines: ~690 lines CSS, ~1050 lines JS in one `<script>` block).
- Extracted the single inline `<script>` and ran `node --check` — passed.
- Extracted `buildStandaloneHtml()`, executed it in Node with the sample house-cleaning state to produce a real `calculator.html`, extracted its embedded `<script>`, and ran `node --check` on that too — passed both before and after fixes.
- Traced `computeQuote()` math by hand and confirmed with live DOM interaction in a running instance (number × unit price, dropdown option price, checkbox add-ons, range × per-step price, minimum-charge floor at both above/below/equal-to boundary).
- Verified `mailto:`/`wa.me` prefill encoding with `encodeURIComponent` against strings containing `&`, apostrophes, em-dashes, and newlines — correctly percent-encoded.
- Verified `localStorage` load path (`loadState()`): wrapped in try/catch, validates `parsed.fields` before accepting, falls back to `sampleState()` on any parse failure or missing key. Confirmed no other unguarded `JSON.parse` calls exist.
- Cross-checked every spec bullet against a specific code location (all 8 present) and every top-level and per-field button against a wired listener (none dead).
- Read `README.md` in full and checked each factual claim (feature list, "honest limitations" section) against the code.

## Issues found and fixed

1. **Embed snippet HTML-attribute injection** (`embedSnippet()`, was line ~1856). The business name was interpolated raw into the `title="..."` attribute of the generated `<iframe>` embed code without escaping. A business name containing a double quote (e.g. `Joe's "Best" Cleaning`) breaks out of the attribute, and unescaped `<`/`>` pass through unescaped. This is the exact snippet a freelancer copies and pastes onto a paying client's live website — a realistic business name easily triggers it. **Fixed** by wrapping the interpolation in the existing `esc()` helper. Verified the fix neutralizes both a quote-breakout and an embedded `<script>` tag.

2. **New Range Slider / Number fields render "undefined"** (`addField()`, was line ~1143). Adding a field via the "+" buttons pushed it into `state.fields` and re-rendered the preview, but never seeded `liveValues[newFieldId]`. `computeQuote()`'s math degraded safely (`clampNum(undefined, 0)` falls back to 0), but the range slider's visible value label (`<span class="big">` inserted as text, not an attribute) rendered the literal string `"undefined"` until the user first touched the slider — a visible, unprofessional bug in a tool being sold partly on live-demo polish. **Fixed** by factoring the per-field default logic out of `initLiveValues()` into a new `initLiveValueFor(f)` helper and calling it from `addField()` for the newly created field. Confirmed via live DOM test: after adding one of each field type, `calcShell.innerHTML.includes('undefined')` is `false` and the new slider's value defaults correctly to its `min`. (Note: this bug never affected exported `calculator.html` files, since exports always call `initLiveValues()` fresh before the first render — the defect was preview-only.)

3. **Logo preview thumbnail not escaped** (`renderLogoPreview()`, was line ~1030). The builder's own logo thumbnail set `innerHTML` with the raw `state.branding.logo` data URL, inconsistent with the equivalent line in `renderPreview()` which correctly calls `esc()`. Practically low-risk since this value only ever comes from `FileReader.readAsDataURL()`, not free-typed text, but fixed for defense-in-depth and consistency.

All three fixes were verified with `node --check` (syntax) and either a live DOM test in a running browser instance or a byte-for-byte Node reproduction of the exact escaping logic.

## Verified correct (no changes needed)

- No ES modules, `fetch()`, or external script/style/font URLs — confirmed to work over `file://`. Only external references are the runtime `wa.me` deep link (by design) and the documented `YOUR-HOSTED-URL` embed placeholder.
- Quote math: base price + Σ(number×unit) + Σ(range×unit) + dropdown option price + Σ(checked add-ons) is correct; minimum charge correctly applies only when the computed subtotal is strictly below it, not at/above.
- Exported `calculator.html` is a real, independently working file: full state JSON is embedded (with `<` escaped to `<` to prevent `</script>` breakout — verified against a business name containing an embedded `<script>` tag), and the generated file's own script parses and runs standalone.
- `localStorage` corruption/absence is handled gracefully (try/catch + shape validation + sample-data fallback); tested by writing malformed JSON directly into the storage key.
- Every button (top bar: reset/embed/export; per-field: move up/down/edit/delete; per-option: remove/add; tabs; radio pills; modal close/copy) has a wired listener — no dead buttons found.
- All 4 field types, add/edit/delete/reorder (both drag-and-drop and up/down buttons), live breakdown, CTA config, export, and localStorage persistence are all present and functioning per spec.
- README.md claims were all verified accurate, including the self-critical "Honest limitations" section (no backend/CRM, browser-local builder state, no payment collection, no server-side spam protection, simple linear pricing model, base64 logo bloat risk, untested accessibility, placeholder hosting URL in the embed snippet). No changes made to README.md.

## Remaining limitations (not fixed — judged as acceptable design tradeoffs, not defects)

- `state.cta.email` is inserted into the `mailto:` href without URL-encoding. A stray `&` or `?` in the email address would produce a malformed URL (extra bogus query params) rather than a security issue, since assignment goes through `window.location.href` (no HTML parsing involved). Low likelihood given email addresses rarely contain those characters and the field is set by the calculator's builder, not an anonymous visitor.
- The dropdown line-item visibility check in `computeQuote()` (`if (clampNum(opt.price,0) !== 0 || f.options.length)`) is tautological/dead logic — `f.options.length` is always truthy inside that branch — but harmless, since it always evaluates true and matches the exported version's unconditional behavior. Left as-is per instructions not to rewrite working code.
- Dynamically-generated field editor labels and calculator-preview `<label>` elements aren't programmatically associated via `for`/`id` (only the top-level builder form uses proper `<label for>`). This matches the README's own accessibility disclaimer and isn't a false claim.
- No `step` attribute on range/number inputs beyond browser defaults — acceptable given the sample data and UI copy treat all values as whole numbers.

## Revenue-Readiness score: 8/10

The exported deliverable — a standalone, brandable, self-contained quote calculator with working math, lead capture, and no runtime dependencies — is genuinely something a freelancer could sell to a local service business today for the $100–300 the README targets, and the one bug that would have visibly embarrassed a seller in a client-facing snippet (the embed HTML-attribute breakout) is now fixed. It loses points because it needed this validation pass to catch a real live-demo-visible bug (the "undefined" slider) and a real copy-paste-security bug before being safe to hand to non-technical resellers who won't audit the generated code themselves.
