# RoundTimer Pro — Validation Report

**Date:** 2026-07-03
**Status: PASS-WITH-FIXES**

Independent audit of `index.html` and `README.md` against the claimed spec. Two
real defects were found and fixed directly in `index.html`; everything else
checked out.

## Audit checklist results

1. **Files present, file:// compatible.** Both `index.html` and `README.md`
   exist. No ES modules, no `fetch()`, no external URLs, no `<audio>`/media
   files — all audio is synthesized via Web Audio oscillators. Confirmed with
   `grep` for `fetch(`, `import `, `type="module"`, `http(s)://`, `.mp3/.wav/.ogg`
   — zero hits.

2. **Inline script extraction + `node --check`.** One `<script>` block
   (~26KB after fixes). Extracted to a temp file and run through
   `node --check`: clean, both before and after fixes.

3. **Timer correctness — real defect found and fixed.**
   The original engine used `setInterval(fn, 1000)` with a naive
   `state.secondsLeft--` per tick. A `tickAnchor` field existed in `state` but
   was never referenced anywhere — vestigial evidence that timestamp-based
   correction was intended but never wired in. This decrements by tick count,
   not by elapsed wall time, so it drifts over long sessions and does not
   catch up after `setInterval` throttling in backgrounded/inactive tabs
   (a real risk for a 45+ minute class where the device screen may still dim
   despite the Wake Lock attempt, or the browser deprioritizes a background
   tab).
   **Fix:** rewrote the tick engine around `performance.now()`. `armPhaseTimer()`
   stores an absolute end-timestamp (`tickAnchor`) whenever a phase starts;
   `tick()` recomputes `secondsLeft` from the delta to that timestamp every
   poll (polling raised to 200ms so the on-screen second changes promptly,
   but the poll rate does not affect correctness). If more than one phase's
   worth of time has elapsed (e.g., the tab was suspended), `tick()` loops
   `advancePhase()` to catch up to the correct phase/round instead of freezing
   or drifting, bounded to 10,000 iterations as a safety guard. Verified live
   in a running preview: using the page's own `performance.now()` as ground
   truth (to avoid relying on the harness's wall clock), the displayed
   countdown matched elapsed phase time to within one second in every trial.
   Phase state machine (prep → work → rest → … → done): traced by hand and
   confirmed correct — N work phases, N−1 rest phases (no trailing rest after
   the final round), and the `rest === 0` "skip straight to next round's work"
   branch correctly re-bells and re-arms the timer. No off-by-one found.
   10-second warning: fires exactly once per work round, guarded by
   `beepedTenSecThisRound` (reset on every new work phase) — confirmed by
   reading the guard logic and by live testing. It only fails to fire if a
   work round is configured under 10 seconds, which is a documented, sane
   corner case, not a bug.
   Pause/resume: **fixed as part of the same change.** Pausing now snapshots
   `pausedMsLeft = tickAnchor - now`; resuming re-anchors `tickAnchor = now +
   pausedMsLeft`. Verified live: clock froze exactly during a 3-second pause
   window and resumed without gaining or losing time.
   Spacebar: correctly no-ops when `document.activeElement` is an
   `INPUT`/`TEXTAREA`, so it does not hijack the preset-name text field.

4. **Web Audio unlock / Wake Lock lifecycle — no defects.**
   `ensureAudioContext()` lazily creates the `AudioContext` and resumes it if
   suspended; it is invoked from `startSession()` and from the resume branch
   of `togglePauseResume()`, both of which only run from a user click/keypress,
   satisfying the autoplay-unlock requirement. Wake Lock is requested on
   session start, released on finish/reset/exit, and re-requested on
   `visibilitychange` while a session is running — correct lifecycle, with a
   graceful on-screen fallback message when unsupported (verified live: the
   automated browser context has no Wake Lock capability, and the app showed
   "Couldn't keep screen awake automatically..." instead of failing silently
   or throwing).

5. **Spec coverage / dead buttons — none found; one real defect found and fixed.**
   All spec items are present and wired: rounds/work/rest/prep config with
   steppers, four built-in presets, custom preset save/delete (localStorage),
   full-viewport color-coded phases with whole-background color change, round
   X/N indicator, distinct start/end/10-second-warning tones, start/pause/
   resume/reset, spacebar toggle, Wake Lock with fallback, persisted session
   log with date/preset/rounds-completed. Every button in the DOM has a
   matching listener — no dead buttons found.
   **Defect:** `lsGet()` only guarded against `JSON.parse` throwing (malformed
   JSON) or a missing key, not against valid JSON of the wrong *shape*. A
   stored value of `null`, an object, or a non-array — e.g. the literal string
   `"null"`, which is valid JSON — passed straight through into
   `state.customPresets` / `state.history`. `BUILTIN_PRESETS.concat(null)`
   silently appends a `null` element, and `renderPresetGrid()`'s
   `all.forEach(p => ... p.id ...)` then throws an uncaught `TypeError` on
   that element. This was reproduced live: setting
   `localStorage.rtp_customPresets_v1 = "null"` and reloading left `init()`
   partway through — the preset grid rendered its first few real entries via
   `appendChild` before the exception aborted the rest of `init()`
   (`updateRoundIndicator()`, `updateClockDisplay()` never ran on that load).
   Any later call to `renderPresetGrid()` (selecting/saving/deleting a preset)
   would throw again, permanently breaking the Setup screen for that browser
   profile until the user manually cleared storage.
   **Fix:** added an `lsGetArray(key, itemIsValid)` helper that guarantees an
   array of well-formed objects, filtering out `null`/non-object entries and
   (optionally) entries failing a shape predicate. Applied it to
   `state.customPresets` (requires string `id`/`name`, numeric
   `rounds`/`work`/`rest`) and to both places `history` is loaded — the
   initial `state.history` and the re-read inside `renderHistory()` (requires
   string `date`/`preset`). Verified live: reloading with
   `rtp_customPresets_v1 = "null"` and `rtp_history_v1 = '{"garbage":true}'`
   now renders all 4 built-in presets and the round indicator/clock/history
   view correctly, with no crash. Re-verified that normal save/select/delete/
   reload round-trips for custom presets and history still work after the fix
   (regression check).

6. **README factual accuracy — no false claims found.**
   Cross-checked every concrete, falsifiable claim against the code:
   preset numbers (Boxing 12×3:00/1:00, MMA 5×5:00/1:00, Tabata 8×0:20/0:10,
   Heavy Bag 6×3:00/0:30) match `BUILTIN_PRESETS` exactly; "zero dependencies /
   works fully offline / data never leaves this device" matches the absence of
   any network calls; "synthesized tones, not sampled recordings" matches
   `playTone`/`playBell`; the partial-session-logging limitation ("only logged
   once at least one full round has been completed") matches the
   `currentRound > 1` guard in the exit/reset handlers exactly; the PWA
   revenue idea is correctly framed as a *future* addition ("add a manifest +
   service worker... a small addition on top of what's here"), not a claim
   that the app is already installable — no export/import feature exists in
   the code, consistent with the limitations section. No edits were needed;
   monetization content left untouched.

## Remaining limitations (design choices, not defects — left as-is)

- No cross-device sync, no accounts, no export/import — by design, and
  honestly disclosed in the README.
- The 10-second work-phase warning cannot fire for work durations under 10
  seconds (it would need to fire on entry rather than at a specific
  countdown value) — an edge case for unusually short custom presets, not a
  spec violation for any of the four built-in presets or realistic training
  configs.
- Wake Lock support is genuinely inconsistent across browsers (notably older
  Safari/iOS); the app already detects and falls back gracefully with an
  on-screen note, which is the correct and only available mitigation from a
  single static HTML file.
- The catch-up loop in `tick()` silently fast-forwards through phases missed
  while backgrounded rather than replaying every intermediate bell — this is
  the correct UX (a wall of stacked bell sounds on tab refocus would be worse
  than silence), but is worth knowing: a coach who backgrounds the tab for
  an entire round will not hear that round's bells, only see the corrected
  state once they return.

## Revenue-Readiness: 7/10

The product is a genuinely complete, correctly-functioning single-file tool
that solves a real, narrow problem (gym-wall round timer) for a well-defined
buyer (independent gym owners, trainers, home users) at a price point
($99–199 one-time, or a few dollars as a PWA unlock) that doesn't require
building a backend, support infrastructure, or subscription billing — a solo
operator could plausibly close the "first 5 customers" plan in the README
using nothing but this file and a landing page. It loses points because the
category is crowded with free interval-timer apps and $30 physical clocks,
so the realistic ceiling is modest per-unit revenue requiring real outbound
hustle (cold DMs, Reddit posts) rather than passive discovery, and because
the fixed defects (timer drift/freeze risk, a corrupted-localStorage crash)
were exactly the kind of issue that would have generated public one-star
reviews or refund requests had they shipped to a paying gym mid-class.
