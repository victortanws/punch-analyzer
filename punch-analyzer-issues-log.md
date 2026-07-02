# 🥊 Punch Power Analyzer — Development Issues Log

A summary of problems encountered during development and deployment, along with their causes and resolutions.

---

## 1. Camera Preview Not Displaying

**Problem:** The app did not show a live video preview or evaluate punches when first tested.

**Cause:** The Claude artifact viewer does not support camera access. The app must be run as a local HTML file or hosted page.

**Resolution:** Saved the code as a local `.html` file and opened it directly in the browser (Chrome/Edge recommended), where camera and microphone permissions could be granted properly.

---

## 2. Pose Detection Not Working (No Skeleton Overlay)

**Problem:** Only the plain video feed appeared — no green skeleton overlay, meaning MediaPipe was not detecting the body.

**Cause:** Likely a combination of framing (full body not visible), lighting conditions, or browser compatibility.

**Resolution / Mitigation:**
- Stand further back so the full body (head to feet) is visible
- Ensure good lighting and a plain background
- Use Chrome or Edge for best MediaPipe support
- Check the browser console (F12) for loading errors

---

## 3. Scores Registering as Zero ("No punch data recorded!")

**Problem:** All metrics returned 0/100 after a punch attempt.

**Cause:** Downstream effect of Issue #2 — since pose detection never captured landmarks during the recording window, there was no data to score.

**Resolution:** Fixed by resolving the pose detection issue and later pre-loading pose detection so it is already running before the countdown begins.

---

## 4. GitHub Confusion — Local Commits vs. Remote Push

**Problem:** Files were committed but did not appear on GitHub; unclear which repository was being used and whether the user was logged in.

**Cause:** Commits were made to the **local** repository only. The `gh` CLI was not installed, and no remote had been pushed to yet.

**Resolution:**
- Verified config with `git config --global --list` and `git status`
- Created the repository manually via github.com/new
- Connected with `git remote add origin ...` and pushed with `git push -u origin main`
- Authenticated using a Personal Access Token

---

## 5. GitHub Pages Showing README Instead of the App

**Problem:** Visiting the GitHub Pages URL displayed the README file, not the punch analyzer itself.

**Cause:** Two issues combined:
- GitHub Pages serves `index.html` by default; the app file was named `punchanalyzer.html`
- The "Try It Live" link in the README pointed to the repository page rather than the live app URL

**Resolution:** Updated the README link to point to `https://victortanws.github.io/punch-analyzer/punchanalyzer.html`. (Alternative: rename the file to `index.html` for a cleaner root URL.)

---

## 6. Skeleton Overlay Visible on Page Load Despite Unchecked Box

**Problem:** The skeleton overlay appeared immediately on page load even though the "Show skeleton overlay" checkbox was unchecked.

**Cause:** State mismatch — the JavaScript variable `showSkeleton` was initialized to `true` while the checkbox defaulted to unchecked.

**Resolution:** Changed the variable default to `false` so the overlay only renders after the checkbox is actively checked. Pose tracking continues to function invisibly.

---

## 7. Read-Only File Error in VSCode

**Problem:** VSCode displayed *"Editor is read-only because the file system of the file is read-only"* and blocked edits.

**Cause:** Insufficient write permissions on the file or folder (possibly a locked file or permissions issue after moving files).

**Resolution:** Fixed permissions via terminal:
```bash
chmod u+w punchanalyzer.html
# or for the whole folder:
chmod -R u+w .
```

---

## 8. Duplicate Donation Section (Repeated Fix Failures)

**Problem:** Two "Support This Project" PayPal sections appeared on the page — one in the middle and one below the social links. It took **multiple attempts** across several artifact versions to actually remove the duplicate.

**Cause:** The duplicate donation block existed in the HTML below the follow section. Early "fixes" repeatedly targeted the wrong block or claimed removal without verifying against the rendered output, so the duplicate persisted through versions 26–27.

**Resolution:** Systematically traced every occurrence of the `donation-section` markup in the full document and removed the instance appearing after the social follow section, leaving a single donation section.

**Lesson:** Verify fixes against the actual rendered output/screenshot rather than assuming an edit landed correctly.

---

## 9. Social Media Link Previews Not Configured

**Problem:** Sharing the URL (e.g., on WhatsApp) showed no proper title, logo, or preview image.

**Cause:** Missing Open Graph / Twitter meta tags and no favicon or preview image asset.

**Resolution:**
- Added 🥊 emoji favicon
- Added Open Graph and Twitter Card meta tags with title and description
- Created and referenced a custom `punch-preview.png` image (boxing glove on maroon background)

---

## 10. Local Repo Was 7 Commits Behind GitHub

**Problem:** The local working copy still contained the initial commit's version — none of the fixes from issues #5, #6, #8, and #9 (skeleton toggle, donation dedupe, meta tags) were present locally.

**Cause:** Later versions were edited/uploaded directly on GitHub (web UI commits like "Update punchanalyzer.html"), and the local clone was never pulled.

**Resolution:** `git fetch` + `git pull --ff-only origin main` before making any new edits, so improvements are based on the real latest version.

---

## 11. Social Preview Image Never Committed

**Problem:** Issue #9's fix referenced `punch-preview.png` in the Open Graph/Twitter meta tags, but the file was never added to the repository — so link previews still show no image (the URL 404s).

**Resolution:** The meta tags are kept; the `punch-preview.png` asset still needs to be created and committed to the repo root.

---

## 12. Scoring Engine Flaws (Fixed in v2 Rewrite)

A code review of the scoring logic found several correctness bugs:

- **Speed was frame-rate dependent** — it measured wrist movement *per frame*, so a slower device (fewer pose frames/sec) reported *higher* per-frame distances and different scores. Fixed by timestamping frames and computing shoulder-widths **per second**.
- **Speed and power depended on distance from camera** — normalized coordinates mean standing closer inflates all movement. Fixed by normalizing against the player's shoulder width.
- **Extension was always ~100** — it took the maximum elbow angle over the whole 2-second window, and an arm hanging straight at your side is also 180°. Fixed by only measuring extension in a ±300 ms window around peak punch speed.
- **Hip rotation had an angle-wraparound bug** — `|atan2 − atan2|` can jump by 2π, producing spurious ~360° rotations. Fixed by normalizing the difference to [0°, 180°].
- **Power score could go negative** — `(0.5 − minDepth) × 200` had no lower clamp. Fixed with proper clamping, and power now measures *change* from the punch's starting position (hand-size growth + z-depth delta) instead of absolute values.
- **Battle Cry rewarded noisy rooms** — no ambient baseline, and volume was only sampled when a pose frame arrived. Fixed with a rolling ambient-noise baseline (scored on how far the shout rises above it), RMS loudness, and sampling on every animation frame.
- **Form score was fake** — it was just `(speed + extension + rotation) / 3 × 0.8`, a rehash of other metrics. Replaced with a real boxing metric: whether the non-punching hand stays up guarding the face during the punch.
- **No landmark visibility gating** — occluded limbs produce hallucinated landmark positions that corrupted speeds and angles. All metrics now ignore landmarks below 50% visibility.

---

## 13. Robustness Gaps (Fixed in v2 Rewrite)

- **Denying the microphone killed the camera too** — `getUserMedia({video, audio})` fails entirely if either is denied. Now retries video-only and shows "N/A (no mic)" for Battle Cry, excluding it from the weighted total.
- **No handling for CDN failure** — if MediaPipe scripts didn't load, `new Pose()` threw and the page silently broke (root cause of issue #2's worst case). Now detected with a clear error message.
- **Punch button enabled before tracking worked** — the root cause of issue #3 could still occur: the button enabled when the camera started, not when a body was actually detected. Now a live "Body detected / No body detected" badge gates the punch button, and a punch with no captured frames shows guidance instead of a 0/100 scoreboard.
- **Preview not mirrored** — movement felt backwards; the canvas is now mirrored like a selfie camera, and the hidden `<video>` element is no longer redundantly rendered behind it.
- **Keyboard shortcuts hijacked browser combos** — pressing Cmd/Ctrl+P (print) also triggered a punch countdown. Modifier keys are now ignored.
- **Root URL still showed nothing useful** — added an `index.html` redirect so `https://victortanws.github.io/punch-analyzer/` works while keeping all previously shared `punchanalyzer.html` links valid.

---

## Key Takeaways

1. **Camera-based apps can't run inside artifact viewers** — always test locally or on a hosted URL.
2. **`git commit` is local; `git push` is what publishes** — the live site only updates after a push (plus 1–2 minutes for GitHub Pages to rebuild).
3. **GitHub Pages defaults to `index.html`** — name your entry file accordingly or link to the exact filename.
4. **Keep JS state and UI state in sync** — checkbox defaults must match their corresponding variables.
5. **Verify edits against actual output** — especially when removing duplicated markup in a large single-file app.
