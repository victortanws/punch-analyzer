# CertMaker — Validation Report

**Status: PASS-WITH-FIXES**

Independent audit of `index.html` and `README.md` against the claimed spec. One real logic defect was found and fixed directly in the code; everything else checked out.

---

## What was verified

### 1. File integrity / portability
- Both `index.html` and `README.md` exist.
- No ES modules, no `fetch()`/`XMLHttpRequest`/`WebSocket`, no external URLs, no analytics/tracking scripts, no `console.log`/`debugger` cruft (only one intentional `console.warn` for malformed localStorage). The only `http://` string in the file is the SVG namespace attribute, which is not a network call.
- Logo upload uses `FileReader.readAsDataURL` (no `blob:`/`createObjectURL`), so it works correctly under `file://`.
- Confirmed by opening the file over a local static server and exercising it in a real browser.

### 2. Syntax
- Extracted the single inline `<script>` block to a temp file and ran `node --check` — passed with no errors, both before and after the fix.

### 3. Core logic trace
- **`{name}` substitution**: `bodyText.split("{name}").join(name)` — verified correct for zero, one, and multiple occurrences, and correctly case-sensitive (`{NAME}` is left alone, which is expected literal-token behavior, not a bug).
- **Bulk "Name, detail" parsing** — traced and tested in Node with edge cases: blank lines/whitespace-only lines (skipped correctly), trailing commas (`"Trailing, Comma,"` → name `"Trailing"`, detail `"Comma,"`), extra internal commas (only the *first* comma splits, rest stays in the detail — correct, matches the documented "not a full CSV parser" limitation), and leading/trailing whitespace (trimmed correctly).
- **Defect found and fixed**: a bulk line that parses to an *empty name* (e.g. a stray `,` or a line starting with a comma like `,LeadingComma` — plausible from a messy spreadsheet paste) was silently added to the recipient list as `{name:"", detail:"..."}`. This would count toward "N recipients loaded," survive into Print All, and produce a blank-name certificate buried in the middle of a batch of otherwise-correct certificates — the kind of defect a solo user printing 50 certs would only notice after handing them out. Fixed in `getRecipients()` (bulk branch) to skip any line whose parsed name is empty after trimming, mirroring the guard that single-recipient mode already had (`if(!name) return []`). Verified via Node unit tests and live in-browser (typed 5 lines including 3 garbage lines → "2 recipients loaded," correctly showing only the two valid names).
- **HTML escaping**: `escapeHtml()` is applied to every user-supplied string injected into certificate markup (name, detail, org, title, body text, date, signature name/role). Tested live with a recipient named `<b>Bob</b>, <img src=x onerror=alert(1)>` — rendered DOM showed literal `&lt;b&gt;Bob&lt;/b&gt;` and the `onerror` payload as escaped text; no alert fired, no console errors.
- **Print path**: `printCertificates()` builds exactly one `.print-page` div per recipient passed in (a simple, unconditional loop — no way for the page count to diverge from the recipient count). CSS: `@page{size:landscape;margin:0}`, `body *{visibility:hidden}` + `#printArea, #printArea *{visibility:visible}` (only the print area is shown), `.print-page{page-break-after:always}` with `.print-page:last-child{page-break-after:auto}` (prevents a trailing blank page). Verified visually by forcing the print CSS to apply outside of `@media print` in a sandboxed copy — full-bleed landscape layout, all app chrome (header, designer panel, footer) correctly hidden, cert content correctly positioned. This matches "N recipients → N pages, landscape, one cert per page" exactly.
- **localStorage robustness**: `loadState()` wraps `JSON.parse` in try/catch and merges onto `defaultSample()` via `Object.assign`. Tested with `null`, empty string, invalid JSON, `"42"`, a bare string, `"null"`, and `[]` — all cases degrade gracefully to the default sample with no crash (primitives/arrays contribute no usable properties via `Object.assign`, and the catch block handles unparseable JSON).
- **Preview navigation bounds**: `btnPrev`/`btnNext` correctly disable at index 0 and at the last recipient; clicking past either bound is a no-op (guarded by `if(currentIndex > 0)` / `if(currentIndex < count - 1)`). Verified by stepping through all recipients including first→prev and last→next.

### 4. Spec coverage / wiring
- Every button ID referenced in JS (`btnClearLogo`, `btnNext`, `btnPrev`, `btnPrintAll`, `btnPrintOne`, `btnResetSample`, `btnSaveTemplate`) has a matching element and a bound listener — no dead buttons.
- All spec items present: title/org/logo/body-with-`{name}`/date/1-2 signatures, 4 themes, single + bulk recipient modes, paginated preview with count, Print All / Print This One, template save/load/reset, preloaded 5-recipient boxing-academy sample.
- **Visual pass (the item the builder flagged as unverified)**: served the app and screenshotted all 4 themes live. All four are genuinely distinct in layout, not just palette — Classic Gold (cream, double gold border + inset outline, serif), Modern Minimal (white, dark left sidebar accent via `::before`, sans-serif, lighter title weight), Elegant Navy (navy gradient, gold trim, serif, glow on title), Playful Education (warm gradient, dashed rounded border, Comic Sans, wavy underline on name). No overlapping text, no broken borders, no contrast problems in any theme, at both single-cert preview size and full print-simulated full-bleed size. Both signature blocks render correctly side by side with visible names, lines, and roles.

### 5. README accuracy
- Read in full; cross-checked every testable claim against the code:
  - "No server, no build step, no account," "all data stays in your browser," "no accounts, no servers, no tracking" — confirmed, zero network calls anywhere in the file.
  - "$19 × 20 sales/month ≈ $350–380 net" after the stated 5–9% platform fee — checked the arithmetic, it's correct ($380 gross, $342–361 net across that fee range).
  - "Each theme changes layout details, not just color" — confirmed in CSS (border styles, corner radius, sidebar accent, outline offsets differ per theme, not just color swaps) and visually.
  - "PDF export is print-driven... not a built-in PDF export button" — confirmed, `printCertificates()` only calls `window.print()`.
  - "All user-supplied text is HTML-escaped" (Tech notes) — confirmed via `escapeHtml()` trace and live XSS test.
  - No factually false claims found. No edits were needed to README.md.

---

## Remaining limitations (documented, not defects — left as-is per instructions)

- Bulk parsing splits on the *first* comma only; a name that itself legitimately contains a comma will be mis-split. This is explicitly disclosed in the README ("Bulk parsing is comma-based... isn't a full CSV parser") and is a reasonable design trade-off for a paste-a-list tool, not a bug.
- No cloud sync / no way to share a saved template across devices except manual re-entry — disclosed in README, inherent to the single-file/localStorage architecture.
- No real certificate verification (ID/QR/registry) — disclosed prominently in README's "Honest limitations" section.
- Non-Latin scripts / very long names are not explicitly tested for overflow — disclosed in README.

## Fixes made

1. **`index.html`, `getRecipients()` bulk-parsing branch**: skip lines that parse to an empty name (stray comma, or a line starting with a comma) instead of silently adding a blank-name recipient to the batch. Minimal, targeted change; no other logic touched.

No other code or content changes were made. README.md was left unmodified — all claims checked out as accurate.

---

## Revenue-Readiness: 8/10

This is a genuinely sellable $19–$99 micro-tool today: it solves a real, specific, recurring pain (bulk certificates without Canva/mail-merge/SaaS subscriptions) for an identifiable buyer, the visual output is legitimately polished across all 4 themes, and the one-file/no-account/no-server pitch is fully true, which matters for trust with a skeptical solo-buyer audience. It loses points only because the bulk-paste flow (its main differentiator for the target "50 students" use case) had a silent-data-loss-shaped edge case until this pass fixed it, and because the monetization plan leans on the seller's own outreach hustle (Fiverr gigs, cold DMs) rather than the product selling itself — a normal, honest constraint for a solo entrepreneur, not a flaw in the code.
