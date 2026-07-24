# BioLink Studio — Validation Report

**Overall status: PASS-WITH-FIXES**

Audited independently against the claimed spec, the audit checklist, and live browser behavior (via a local static server). Three real defects were found and fixed directly in `index.html`. No wholesale rewrites were made; all fixes are small, targeted edits.

---

## Method

- Read `index.html` (1620+ lines) and `README.md` in full.
- Extracted the single inline `<script>` to a temp file and ran `node --check` — passed before and after fixes.
- Grepped for `fetch(`, `import(`, `type="module"`, `require(`, external `<script src>`/`<link href="http...">` — none found. All URLs in the file are either the SVG XML namespace, placeholder text, or the `https://` prefix literal used by `normalizeUrl()`.
- Installed `jsdom` in a scratch directory and drove the real `index.html` (unmodified logic, not a reimplementation): set a custom gradient background, switched theme, changed button shape, filled a social field, changed display name, and clicked "Download my page," capturing the Blob content passed to `URL.createObjectURL`.
- Also served the app on a real local HTTP server and drove it with a real browser (Chromium via the preview tool): toured all four tabs (Profile, Links, Socials, Theme), triggered Reset Sample, and clicked Download, confirming the "Saved" and "Downloaded bio.html" toasts and correct visual rendering at each step.
- Manually traced `loadState`, `buildBioPageHtml`, `buildStandaloneHtml`, `normalizeUrl`, and the social-icon conditional-rendering logic line by line.

---

## Issues found and fixed

### 1. Crash on malformed `links` array in localStorage (robustness bug — fixed)
`loadState()` guarded the top-level shape of saved state (non-object, missing fields, wrong types) but did not validate individual entries inside `parsed.links`. If the array contained a non-object entry (e.g. `null`, a string, a number — plausible from a hand-edited storage value, a future schema change, or third-party interference with `localStorage`), both `renderLinksList()` and `buildBioPageHtml()` would throw (`Cannot read properties of null (reading 'highlight')`) on the very first render after page load, breaking the entire app with no recovery path (this happens synchronously during `renderAll()` at init, before any error boundary).

**Fix:** added a `.map()` sanitize step in `loadState()` (index.html, inside `loadState()`, ~line 1011) that coerces every link entry into a well-formed `{id, title, url, emoji, highlight}` object, generating a fresh `id` via the existing `uid()` helper when missing. Verified with a standalone Node harness that malformed entries (`null`, `"str"`, `5`) no longer crash and are converted into safe empty-link placeholders, while well-formed entries pass through unchanged. Re-verified `node --check` passes and the live browser preview still loads/renders/exports correctly afterward.

### 2. Exported page missing "empty links" placeholder CSS (export completeness gap — fixed)
The builder's own stylesheet includes `.bio-page.empty-links .bio-links::after{content:"Add your first link to see it here";...}`, which shows a hint in the live preview when a profile has zero links. This rule was omitted from the CSS block generated inside `buildStandaloneHtml()` (the exported file's `<style>`), even though the `empty-links` class itself is applied to the exported markup. Result: a customer who exports (or a reseller testing the tool) with zero links would get a bare gap on the live page with no placeholder text, an inconsistency between what the preview shows and what actually ships.

**Fix:** added the equivalent CSS rule to the exported stylesheet in `buildStandaloneHtml()`. Verified via the jsdom harness: deleted all 5 sample links, exported, and confirmed the rule `.bio-page.empty-links .bio-links::after{content:'Add your first link to see it here';...}` is now present in the captured export output (it was absent before the fix).

### 3. Unescaped `state.photo` in exported/preview HTML (defense-in-depth hardening — fixed)
Every other user-controlled field going into `buildBioPageHtml()` (name, bio, link title/url, emoji, social URLs) was passed through `escapeHtml()`. The photo `src` attribute was the one exception — `state.photo` was concatenated directly into `<img src="...">` unescaped. In normal use this is populated only by `FileReader.readAsDataURL()` on a real image file (type-checked against `/^image\//`) or the built-in sample generator, so it isn't reachable via a text-input XSS path today. However, since this is a single-file tool whose state can be hand-edited via devtools/localStorage and whose export is meant to be handed to third parties or hosted publicly, leaving one field inconsistently unescaped was a latent risk (a crafted storage value containing a literal `"` could break out of the attribute). Escaping is free here — legitimate base64 data URLs contain none of the characters `escapeHtml` touches (`& < > " '`), so no visual or functional change for real photos.

**Fix:** wrapped `state.photo` in `escapeHtml()` at its one usage site in `buildBioPageHtml()`. Re-verified the exported sample photo (an inline SVG-as-dataURL) still renders correctly.

---

## Checklist results

| Check | Result |
|---|---|
| Both files exist (`index.html`, `README.md`) | Pass |
| Works via `file://` — no modules/fetch/external URLs | Pass |
| `node --check` on extracted script | Pass (before and after fixes) |
| Export is truly self-contained (theme CSS, custom bg, button shape, photo, social SVGs) | Pass (after fix #2) |
| localStorage load/save robust to malformed/absent state | Pass (after fix #1) |
| Link URL handling / normalization (bare domains, mailto, missing scheme) | Pass — `normalizeUrl()` correctly handles empty, `mailto:`, `http(s)://`, and bare-domain inputs; email social field has its own correct mailto-prefix special case |
| Conditional social icon rendering (hidden when empty) | Pass — verified live in browser: only filled fields (Instagram/TikTok/YouTube/Email in sample data) render icons; X and WhatsApp (empty) are correctly omitted |
| Every spec item present, every button/handler wired | Pass — cross-referenced every `id="..."` against `getElementById` usage and every `data-action`/`data-theme`/`data-shape`/`data-bgmode`/`data-emoji` attribute against its listener; no dead controls found |
| README factual accuracy | Pass — no false claims found; all feature claims verified true against code behavior; "Honest limitations" section already accurately discloses no-backend/no-analytics/localStorage-only constraints |

---

## Remaining limitations (by design, not defects — documented, not changed)

- **WhatsApp field expects a full URL, not a bare phone number.** If a user types just a phone number (e.g. `15551234567`) instead of `https://wa.me/15551234567`, `normalizeUrl()` will prepend `https://` and produce a broken link (`https://15551234567`). The placeholder text correctly shows the expected `wa.me/...` format, so this is a usability nuance rather than a bug — consistent with the URL field's documented behavior for every other link/social field.
- **No click analytics, no remote editing after export, no custom-domain handling** — all explicitly and accurately disclosed in the README's "Honest limitations" section already; not changed since they are intentional scope boundaries of a static-export tool, not defects.
- **Single inline `<script>`, ~1620-line single file** — appropriate for the stated "one file, zero build step" design goal; not a defect.

---

## Revenue-Readiness score: 8/10

The core loop (build a page, see it live, export a real self-contained `bio.html`) works end-to-end in a real browser with no crashes, and the one genuine robustness gap (a malformed-storage crash that could have caused a support headache for a non-technical solo seller) is now closed along with two smaller consistency/hardening gaps — this is now solid enough to hand to a paying customer today. It loses points against a 10 only because it's still a single-person-operated manual-delivery product with no in-app polish beyond what a solo seller would want for a professional handoff (e.g., no built-in "here's your file" onboarding screen or QR code for the exported link) — those are business-execution gaps, not code defects, and don't block the first sale.
