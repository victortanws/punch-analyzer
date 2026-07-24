# QR Menu Studio — Validation Report

**Status: PASS-WITH-FIXES**

Independent audit of `index.html` (single self-contained app) and `README.md`
(monetization playbook), against the claimed spec. One real robustness defect was
found and fixed directly in the code. Everything else — export fidelity, escaping,
print-area targeting, QR fallback, button wiring, and README factual claims —
checked out on first pass.

---

## Method

- Read the full 1754-line (now 1797-line) `index.html` source directly.
- Extracted the inline `<script>` block to a temp file and ran `node --check` — both
  before and after the fix — to confirm valid syntax.
- Grepped for `fetch(`, `type="module"`, `import`, and every `src=`/`href=` to confirm
  the only external resource is the qrcodejs CDN script, with no other network or
  module dependency that would break under `file://`.
- Ran the app live in a browser (via the existing `qrmenu-studio` launch config),
  exercising: sample-data load, live preview, XSS-style field injection, Blob export
  capture (read the actual downloaded HTML via a monkey-patched `URL.createObjectURL`),
  localStorage corruption scenarios (reload with malformed state), QR generation via
  the live CDN, print-menu and print-cards triggers, and section/item add/reorder/delete.
- Wrote small standalone Node scripts to unit-test `formatPrice()` and the QR
  offline-fallback branch in isolation.
- Cross-checked every `id="..."` in the HTML against `getElementById(...)` usage to
  confirm no dead buttons.
- Verified sample-data counts (3 sections, 11 items, 6 print cards, 5 dietary tags)
  against the corresponding README claims.

## Issue found and fixed

**localStorage load did not validate shape — malformed/tampered state could crash the app.**

`loadState()` previously only checked that `JSON.parse` succeeded and that
`parsed.sections` was truthy, then returned the parsed object as-is. If `sections`
was present but not an array (e.g. `{}` or a string), or a section was missing
`items`, or an item was missing `tags`, the app would throw an uncaught `TypeError`
on the very first render (`state.sections.forEach`, `section.items.length`,
`item.tags.indexOf`, etc.), leaving a blank, broken page with no recovery path
short of manually clearing browser storage via devtools. This is a real risk for a
non-technical restaurant-owner audience over months of usage (browser extensions
touching storage, partial writes from a crashed tab, future hand-edits, copy-pasted
state between devices).

**Fix (index.html, `normalizeState()` + `loadState()`, ~line 946):** added a
defensive normalizer that coerces any parsed value into a well-formed state object —
wrong-typed top-level fields fall back to safe defaults, `theme` is checked against
the real `THEMES` list, `accent` is checked against a hex-color pattern, `sections`
is force-mapped into an array of well-formed section objects (each with a string
`name` and an `items` array), and each item is force-mapped into a well-formed
object with string `name`/`desc`, a valid `price`, and a string-array `tags`.
`loadState()` now calls `normalizeState(parsed)` instead of returning `parsed`
directly.

**Verified fixed:** reloaded the page with `localStorage` set to
`{sections: "not-an-array", restName: 123, accent: "javascript:alert(1)"}` — app now
renders a clean empty state instead of crashing. Reloaded again with a section
missing `items` and an item with `tags: "spicy"` (a string, not array) — app
correctly renders the valid items and silently drops the malformed ones, with zero
console errors in both cases. Re-ran `node --check` on the extracted script after
the edit — syntax is valid.

## Checklist results

1. **File integrity / offline compatibility — PASS.** Only `index.html` and
   `README.md` exist. No ES modules, no `fetch()`, no relative-path assets. The only
   external resource is the qrcodejs CDN `<script src="https://cdnjs.cloudflare.com/...">`
   tag, loaded synchronously in `<head>` before the inline script runs, so
   `qrLibAvailable = typeof window.QRCode === "function"` is evaluated only after the
   CDN script has either succeeded or failed — no race condition. Verified the
   fallback path in isolation with a Node script: if `window.QRCode` is undefined,
   `renderQrCode()`/`renderCardsPreview()`/`buildPrintCardsSheet()` all render an
   escaped plain-text link (`.qr-fallback`) instead of throwing.

2. **Syntax check — PASS.** Extracted the inline script to a temp file and ran
   `node --check` both before and after the fix; both passed cleanly.

3. **Core logic trace — PASS.**
   - **Export fidelity:** `buildStandaloneMenuHtml()` embeds `state.theme` via
     `data-theme`, the accent color inline per-element (from a `<input type=color>`
     or fixed presets, never free text), the logo as a `data:` URI directly in an
     `<img src>`, the full `EXPORT_CSS` string inline, and all sections/items/tags
     via `buildMenuInnerHtml()` — no `<script>` tags and no external references at
     all. Confirmed by actually triggering the download button and reading the
     captured Blob content in-browser: the exported file is a complete, valid,
     self-contained HTML document.
   - **Print-area fix:** verified the `#printCardsArea`/`#printArea` CSS is correct —
     `body *{visibility:hidden}` plus explicit `visibility:visible` on the print
     areas and their descendants (not `display`), combined with JS setting inline
     `display:block` right before `window.print()` and back to `none` after a
     500ms timeout. This avoids the classic bug where `@media print` and inline
     `display:none` fight each other. Confirmed live: clicking "Print this menu
     directly" sets `#printArea` to `display:block`, and it resets to `none` ~500ms
     later. No other `id` collides with `#printArea`/`#printCardsArea` selectors.
   - **localStorage robustness:** fixed as described above; `JSON.parse` failures
     and non-object values were already guarded, shape validation was the gap.
   - **Price formatting:** `formatPrice()` unit-tested via Node against 12 edge
     cases (empty, null, undefined, garbage strings, `"1e2"`, whitespace, `NaN`) —
     never throws, resolves cleanly to `""` or a `$X.XX` string in all cases.
   - **XSS/escaping:** every user-controlled string (`restName`, `tagline`,
     `section.name`, `item.name`, `item.desc`) passes through `escapeHtml()` before
     being concatenated into HTML, in both the live preview and the exported
     standalone file. Verified live by injecting
     `Bob's "Fancy" <b>Bistro</b> <script>alert(1)</script>` as the restaurant name:
     it rendered as literal escaped text in both the live preview DOM and the
     actual downloaded `menu.html` (checked the real Blob bytes), with no broken
     markup or script execution.

4. **Spec coverage / wiring — PASS.** All six spec items are present and working:
   builder fields, 3 themes + custom accent picker, section/item CRUD with
   reorder, live phone-frame preview, standalone Blob export, QR generation with
   CDN + fallback, printable table cards, and the preloaded "Copper Fig" sample
   (verified exactly 3 sections / 11 items by parsing the `sampleData()` source).
   Cross-checked every `id="..."` against `getElementById(...)` usage — no dead
   buttons; every static button has exactly one `addEventListener`, and every
   dynamically-created control (theme cards, accent swatches, section/item
   add/move/delete) is wired inline at creation time.

5. **README accuracy — PASS, no changes needed.** Checked every specific factual
   claim against the code: "3 sections, 11 items" sample data (exact match),
   "6-card table-tent sheet" (matches `var count = 6` in `buildPrintCardsSheet`),
   the 5 dietary tags listed (exact match to `DIET_TAGS`), "no external
   dependencies" in the exported file (confirmed via live Blob capture), "no
   backend/database/account system," and the QR CDN fallback description. No
   false or unverifiable claims found; nothing needed correcting.

## Remaining limitations (documented, not defects — left unchanged per design)

- **Unescaped `accent` in `style="color:..."` under manually-tampered state.**
  In normal use `accent` only ever comes from a `<input type="color">` or a fixed
  preset array, so it can't carry attacker text. The new `normalizeState()` fix
  now also validates `accent` against a hex-color regex on load, closing the one
  path (hand-edited localStorage) that could have fed it something else. No
  further action needed.
- **Negative/garbage prices bypass the UI's `min="0"` only via direct state
  tampering** (e.g. `formatPrice("-5")` → `"$-5.00"`). Not reachable through any
  button or input in the app; same trust boundary as the accent-color case above.
  Left as-is — hardening the display format for a value the UI itself cannot
  produce would be scope creep for a single-user local tool.
- **No cloud sync / multi-device editing, no built-in hosting, single-currency
  formatting** — all called out explicitly (and accurately) in the README's
  "Honest limitations" section; these are intentional design choices for a
  zero-infrastructure tool, not defects.

## Revenue-Readiness score: 8/10

The product is genuinely sellable today: it does exactly what a solo operator
needs to close a $150–500 one-time menu-build gig — polished builder UI, a
convincing live phone preview, a real self-contained export that a client can
host anywhere in 30 seconds, and working QR/print-card generation — and the
README's playbook and pricing claims are honest rather than inflated. It loses
points only because the original localStorage fragility (now fixed) and the
inherent one-device/no-backup nature of a pure-localStorage tool mean a seller
should still get in the habit of exporting/backing up client menus rather than
trusting the browser alone for anything business-critical.
