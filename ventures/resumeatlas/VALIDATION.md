# ResumeAtlas — Validation Report

## Overall status: PASS-WITH-FIXES

One critical print-path defect was found and fixed in place. Everything else in the spec checklist passed independent testing (static analysis + live browser interaction) without further changes needed.

---

## Issues found and fixed

### 1. CRITICAL — Print output was completely blank (fixed)

**File:** `index.html`, `@media print` block (originally lines 620–654).

The print stylesheet hid `.preview-stage` with `display:none !important` to remove the on-screen zoom toolbar/grey backdrop from the printed page. However, `.preview-stage` is the DOM **ancestor** of `.page` (`#previewStage > #pageFrame > #resumePage.page`) — the element that holds the actual resume content. A `display:none` ancestor removes its entire subtree from the render tree; no descendant rule (including the `.page, .page * { visibility: visible }` rule already present) can override that. Net effect: printing or "Save as PDF" would have produced a **blank page** — the single most damaging possible defect for a resume-builder product, since the printed PDF is the entire deliverable.

I verified this two ways:
- Static reasoning from CSS cascade rules (an ancestor `display:none` always wins).
- Live reproduction: cloned the print rule set into a scoped, non-media-gated stylesheet and measured `getBoundingClientRect()` on `#resumePage` under the original rules — width collapsed to `0`. Under the fixed rules, the same measurement returns a full non-zero box (`display: block`, `visibility: visible`, `transform: none`).

**Fix:** Removed `.preview-stage` from the `display:none` hide-list and gave `.preview-stage` and `.page-frame` their own print rules (`all: unset; display:block;`) so they stay in the render tree but lose their screen-only chrome (grey backdrop, padding, fixed pixel footprint reserved for the zoomed preview, `overflow:auto` clipping). `.preview-toolbar` (the zoom buttons) is still correctly hidden since it's a sibling of `.preview-stage`, not a descendant of `.page`. Re-verified after the fix: `.page` renders at full size with `transform: none`, confirming the screen-preview zoom scale is correctly neutralized for print and the page is no longer clipped/hidden.

No other lines were touched — this was a 3-selector, ~15-line targeted change.

---

## Checklist items verified — no defects found

1. **file:// portability.** No `type="module"`, no `fetch()`/`XMLHttpRequest`, no external URLs, no `@import`/CDN references. All three template font-families use system stacks only (Georgia/Times, Segoe UI/Helvetica/Arial, Arial/Helvetica). Confirmed via `grep` across the full file.
2. **Inline script syntax.** Extracted the single inline `<script>` block to a temp file and ran `node --check` — no errors.
3. **Print path (beyond the fix above).** `@page { size: A4; margin: 14mm 15mm; }` is sane. `break-inside`/`page-break-inside: avoid` is present on `.r-section`, `.r-job`, `.r-edu-item`; `break-after: avoid` on `.r-heading` prevents an orphaned heading — this correctly satisfies "no heading orphaned from content." App chrome (topbar, left/middle columns, toolbar) is hidden in print via `display:none !important`; only the resume prints.
4. **JSON import validation.** Tested with (a) syntactically invalid JSON — caught, error toast shown ("...doesn't look like a valid ResumeAtlas export"), existing saved state left untouched, no crash; (b) valid JSON with wrong-typed fields (`experience: "not-an-array"`) — `Array.isArray` guards silently fell back to empty arrays instead of crashing, contact fields merged correctly. **localStorage load guard:** manually corrupted `localStorage["resumeatlas.v1"]` with invalid JSON and reloaded — `loadState()` caught the parse error, logged a `console.warn`, and fell back to sample data instead of throwing during boot.
5. **Experience reordering.** Move-up/move-down swap array entries correctly; up-arrow is disabled on the first entry and down-arrow on the last (verified via `.disabled` DOM property, not just CSS).
6. **Skills tag input.** Enter/comma adds a tag (dedup via `indexOf` check), backspace-on-empty pops the last tag, chip's `×` button removes that specific tag. All verified live (10 → 11 → 10 skills).
7. **Template switching.** All three template buttons correctly set `document.body.className` (`tpl-modern`/`tpl-classic`/`tpl-compact`) and toggle the `.active` class on the correct button.
8. **Button/handler wiring.** Cross-referenced every `id="..."` in the HTML against every `getElementById(...)` call in the script — full coverage, no dead buttons. Add/delete flows for Education, Certifications, and Links entries all verified live (add → count+1, delete → count-1).
9. **HTML escaping / XSS.** Injected `<img src=x onerror="...">` as a job title through the real input field and dispatched a real `input` event. The preview rendered it as literal escaped text (`&lt;img src=x onerror=...&gt;`); no `<img>` element was created in the DOM and the handler never fired. All fields that reach `innerHTML` (`renderPreview`, experience/education/cert/link form cards, skill chips) pass user values through the shared `escapeHtml()` helper.
10. **README factual accuracy.** Cross-checked "provably single-column and table-free" against the actual resume-content CSS/markup: no `<table>` elements anywhere, and the only CSS grid/multi-column rules in the file apply to app chrome (`.layout`, `.row2/.row3`, `.template-options`), never to `.page`/`.r-*`/`.tpl-*` resume-content classes — claim holds. The line "The app supplies correct `@page`/`break-inside` CSS" in the Honest Limitations section was **false at the time of writing** (the print bug above existed) but is accurate now that the defect is fixed, so no README wording change was needed. No other false or unsupported product claims found; monetization/business content left as-is per instructions.

## Remaining limitations (documented, not defects — left as-is)

- No true ATS parser simulation (disclosed in README; this is a design constraint, not testable in a static HTML file).
- No cloud sync / single-device localStorage only (disclosed).
- No spell-check or AI writing assistance (disclosed, out of scope by design).
- Payment/licensing gate is not implemented — app ships fully unlocked as a demo (disclosed, matches actual app behavior — no fake lock UI found).
- Print fidelity (font substitution, exact margins) will still vary slightly across browsers' print engines — inherent to browser printing, not fixable in CSS alone.
- No accessibility audit performed (disclosed).

## Revenue-Readiness score: 7.5 / 10

Before the fix this app would have scored 2/10 — a resume builder whose "Print / Save PDF" button produces a blank page is not sellable at any price, and that defect would have surfaced on a solo entrepreneur's very first customer support ticket. With the print path now verified working end-to-end (correct A4 sizing, zoom neutralized, page-break rules intact, escaping solid, import/export robust against bad input), the product does what its README promises and a solo operator could list it on Gumroad today with reasonable confidence; the remaining gap to a higher score is exclusively the disclosed, non-code business step of wiring up real payment/license-gating, which is explicitly scoped as follow-up work rather than a defect.
