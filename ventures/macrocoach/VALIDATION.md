# MacroCoach — Validation Report

**Overall status: PASS-WITH-FIXES**

Audited independently against the claimed spec (coach branding, client inputs with unit
conversion, Mifflin-St Jeor → TDEE → goal-adjusted calories, macro presets + custom sliders,
per-meal breakdown, printable branded handout, localStorage persistence). One real defect was
found and fixed in place. No other correctness, wiring, or false-claim issues were found.

## Math verification (independent re-implementation, run in Node)

Extracted the calculation logic (`computeResults`, `autoBalanceMacros`, unit conversion helpers)
into a standalone Node harness and checked it against hand-computed cases:

- **Mifflin-St Jeor BMR** — male and female formulas both match spec exactly (verified against
  hand calculations for two independent cases, diff = 0.000).
- **Activity multipliers** — 1.2 / 1.375 / 1.55 / 1.725 / 1.9, strictly ordered, within the
  standard 1.2–1.9 range.
- **Cut/bulk adjustment** — uses 7700 kcal/kg, so the "Standard" 0.5 kg/wk cut produces exactly a
  550 kcal/day deficit (verified), and 0.25 kg/wk bulk produces exactly a 275 kcal/day surplus.
  All three rate tiers per goal are internally consistent with the 7700 kcal/kg constant.
- **Macro kcal/gram math** — protein/carbs at 4 kcal/g, fat at 9 kcal/g; grams recompute back to
  the exact target kcal (diff = 0.000 in all tested presets); per-meal splits sum exactly to the
  daily gram/kcal totals (only cosmetic ±1 kcal rounding possible when *displaying* rounded
  integers per meal — the underlying stored values never drift).
- **Imperial conversions** — `CM_PER_IN = 2.54` and `LB_PER_KG = 2.2046226218` (i.e. 1 lb =
  0.453592 kg) are the correct constants. Round-tripping a metric value through the imperial UI
  fields and back introduces only sub-0.1 cosmetic drift from the ft/in display rounding to one
  decimal place — verified in the live app (178 cm → 5'10.1" → 178.1 cm on toggle-back), which is
  normal, expected, and within the checklist's own stated tolerance.
- **Macro auto-balance** — tested all-zero, 99%, 101%, single-nonzero-macro, and gross-overshoot
  (300%) inputs; the algorithm always returns an exact 100% total in every case, confirmed both
  in isolated Node tests and by driving the actual UI slider/badge/button.

## Defect found and fixed

**Malformed persisted state crashed the calculator (checklist item 4).**

`load()` caught JSON parse failures, but not *shape* problems: a `clients`/`draft` record that
was valid JSON but missing fields (e.g. `goal`) reached `computeResults()` unchanged. There,
`if(d.goal !== "maintain")` treated any non-`"maintain"` value (including `undefined`) as a
cut/bulk goal, looked up `RATE_OPTIONS[d.goal]`, got `[]`, and `opts.find(...) || opts[1]`
resolved to `undefined`. The next line, `rateInfo.kgPerWeek`, threw an uncaught `TypeError`.
Reproduced both in an isolated Node harness and live in the browser by writing a
valid-JSON-but-partial record directly into `localStorage` and reloading — the app went into a
non-crashing-looking but effectively broken state (branding chrome rendered, but the math box,
macro table, and meal table all quietly stayed blank) with no error shown to the coach and no
console error most users would ever see. Any future format change, hand-edited localStorage, or
partially-written record (e.g. a tab closed mid-save) could trigger this in production.

Fix applied in `index.html`:
- Added `normalizeClient(raw)` (new function, ~40 lines) that validates every field on a
  client/draft record against the same enums the rest of the app already uses
  (`ACTIVITY_LEVELS`, `RATE_OPTIONS`, `MACRO_PRESETS`) and backfills anything missing or invalid
  from `sampleClient()`. Applied to every record coming out of `localStorage` in `load()`
  (`state.clients = rawClients.map(normalizeClient)`, `state.draft = normalizeClient(parsed.draft)`),
  plus a check that `activeClientId` still points at a real client after normalization.
- Hardened `computeResults()` itself as a second line of defense: the rate-lookup branch now
  only activates for `d.goal === "cut" || d.goal === "bulk"` (anything else, including a stray
  value, is treated as maintenance) and guards against `rateInfo` still resolving to nothing.

Verified after the fix: the same malformed-record test now loads cleanly with all missing fields
backfilled to sensible defaults, full math/macro/meal rendering, no console errors — while a
clean/normal save-and-reload cycle and the sample-client/new-client/load-sample flows all produce
byte-identical output to before the change. `node --check` passes on the extracted script both
before and after.

## Other checklist items — verified, no issues

- **File format**: single self-contained `index.html`, no `type="module"`, no `fetch(`, no
  `http://`/`https://` references, no `<link>`/`@import`/`url()` to external resources. Runs
  entirely client-side.
- **Syntax**: inline `<script>` extracted and run through `node --check` — passes.
- **Wiring**: every button/input `id` referenced in the HTML has a corresponding
  `addEventListener` in the script (topbar tabs, unit/sex segmented controls, goal tabs, meal
  count segment, macro presets, custom sliders + auto-balance, save/load/delete client, branding
  save, logo upload/remove, color swatches, export data, reset data, print). Clicked through all
  of these live in a browser preview; no dead buttons found.
- **Print path**: `@media print` hides all page content via `visibility:hidden` and re-reveals
  only `#view-print`; `.no-print` elements are force-hidden. `beforeprint`/`afterprint` listeners
  correctly force-switch to the handout view (verified: dispatching `beforeprint` from the
  Calculator tab switches `#view-print` to visible and `#view-calculator` to `display:none`, and
  `afterprint` restores the original tab).
- **Disclaimer**: present in the app footer (`.footer-note`) and in the printed handout
  (`.handout-disclaimer`) — both explicitly state the numbers are not medical advice.
- **Sample client + persistence**: first run seeds "Jordan Reyes"; localStorage round-trips
  branding + client roster + draft correctly; "Load sample" and "New client" flows both verified
  live.

## README.md — factual claims checked

All specific technical/product claims cross-checked against the code and found accurate:
Mifflin-St Jeor description, the three macro presets and their exact percentages (30/40/30,
40/25/35, 40/30/30), the 2–6 meal range, the "no server / no build / zero external calls"
claim (confirmed via grep — no external references of any kind), the 2 MB logo upload cap
(matches `2*1024*1024` in code), and the localStorage-only / no-cloud-sync limitations. No
changes were needed to README.md.

## Remaining limitations (by design, not defects)

- Single-device, localStorage-only persistence — no accounts or cloud sync (documented in
  README, appropriate for a $49 solo-coach tool).
- Print-to-PDF depends on the browser's native print dialog rather than generating a PDF
  directly.
- Mifflin-St Jeor is a predictive estimate, not a clinical measurement — correctly disclaimed
  in-app and on the handout.
- Displayed per-meal values are rounded to whole kcal/grams for readability; the stored
  underlying numbers never drift, only the rounded display can differ by ~1 unit across meals
  in edge cases. Cosmetic only.

## Revenue-Readiness: 8/10

The core product a coach actually depends on — the calorie/macro math and the printed handout —
is provably correct, the one real robustness gap found (malformed-state crash) is now fixed, and
the app is a complete, polished, self-contained deliverable that matches its own README claims
line for line. The two points held back reflect solo-seller realities rather than code quality:
there's no license-key/anti-redistribution mechanism for a one-time-sale white-label file, and
the entire revenue model depends on manual outreach (DMs, warm network) rather than any
in-product conversion or trial-limiting mechanism, so real revenue will hinge entirely on the
founder's distribution hustle, not the software.
