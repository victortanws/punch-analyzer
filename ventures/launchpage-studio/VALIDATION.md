# Validation Report — LaunchPage Studio

**Overall status: PASS-WITH-FIXES**

## Scope of audit

Independent re-check of `index.html` (1,378 lines → 1,386 after fixes) and `README.md` against the claimed spec. Method: full read of both files, static analysis (grep for `fetch`/ES modules/external URLs), `node --check` on the extracted inline script, and live interactive testing in a browser (button clicks, form fills, localStorage corruption injection, theme/accent switching, Blob export inspection) via a local static server.

## Issues found and fixed

### 1. Crash on partially-malformed localStorage state (robustness bug — FIXED)
`load()` only validated that `parsed.productName !== undefined` before accepting the entire stored object as-is. The subsequent "backfill missing keys" step only filled in keys that were strictly `undefined`, so a stored state with the right shape but wrong types (e.g. `features: null`, `socials: "oops"`, or arrays containing non-object entries) passed both checks unmodified. `renderFeatures()` then called `.length` on `null` and threw, which aborted `fullRender()` before the preview, socials, theme grid, or accent swatches ever rendered — the whole app went blank with no visible error.

Reproduced live: seeded `localStorage` with `{productName:"Test", features:null, faqs:undefined, socials:"oops"}`, reloaded — feature list, social list, and preview all failed to render (confirmed via `document.getElementById('featureList').innerHTML === ""`).

**Fix** (`index.html` ~line 1366): the init backfill step now also coerces `features`/`faqs`/`socials` back to the sample defaults if they aren't arrays, and filters out any non-object entries within those arrays. Re-tested the same corrupted payload plus a second case (`features:[null,"x",5,{...validcard...}]`) post-fix — app now loads cleanly, keeps the one valid entry, drops the garbage, no console errors, no blank screen.

### 2. Unescaped `og:image` meta attribute (injection-consistency bug — FIXED)
`buildStandaloneHtml()` escaped every other user-controlled value (`title`, `desc`, all body content via `escapeHtml`/`escapeAttr`) but inserted `s.logoDataUrl` into the `og:image` `content="..."` attribute completely raw. Practical exploitability is low (a real `FileReader.readAsDataURL()` output is base64 text, which can't contain `"` or `<`), but it broke the app's "injection-safe" guarantee as a matter of defense-in-depth and consistency with every other field.

**Fix** (`index.html` line 1320): wrapped in `escapeAttr(...)`, matching the treatment given to every other field in the export.

## Verified working (no changes needed)

- **file:// compatibility**: no `fetch()`, no `type="module"`, no external script/style/font URLs. Single inline `<script>` (verified via grep — only one `<script` tag in the whole file).
- **Script syntax**: extracted the inline script to a temp file and ran `node --check` — passes both before and after edits.
- **HTML escaping / XSS**: directly injected `<script>alert(1)</script>"><img src=x onerror=alert(2)>` into product name, SEO title, and mailto address fields and inspected the rendered preview DOM (same code path as export). All contexts (text content, `<title>`, `og:title` attribute, `href` attribute) escaped correctly; no script execution, no broken attributes.
- **Export generation**: triggered the real "Download page" button, intercepted the `Blob` via `URL.createObjectURL`, and inspected the full HTML text. Confirmed: valid `<!DOCTYPE html>` document, balanced tags, all sections present (header/hero/features/quote/FAQ/signup/footer), correct SEO/OG/Twitter meta tags populated from form data, no `<script>` tag (FAQ accordion uses native `<details>/<summary>`, so the exported page needs zero JS to be interactive), no external dependencies.
- **All 4 themes**: clicked through Bold SaaS Dark, Clean Light, Warm & Friendly, Premium Editorial and read back computed `background-color` and `font-family` in the live iframe — each theme's colors and (for Premium Editorial) serif font stack applied correctly.
- **Accent color**: both the 8 quick swatches and the custom `<input type="color">` correctly re-color the primary button in the live preview.
- **Email capture wiring**: with a Formspree URL set, the exported form is `<form action="..." method="POST">` with a named `email` input — valid, submittable markup for Formspree/Google Forms. With the URL blank, falls back to a `mailto:` link with a correctly `encodeURIComponent`-escaped subject line. Both paths pass their user-supplied values through `escapeAttr` before insertion into `href`/`action`.
- **CRUD operations**: add/delete/move-up/move-down on feature cards, add/delete on FAQs, add/delete on social links — all tested live via direct DOM event dispatch, all correctly mutate state, re-render, and persist to `localStorage`.
- **Device toggle**: desktop/mobile buttons correctly toggle the `.mobile` class and active state.
- **Corrupted-but-invalid-JSON localStorage** (`"{not valid json!!!"`): caught by the existing `try/catch` in `load()`, falls back to sample data with no crash (this path was already correct).
- **Responsive layout**: app usable at 375px mobile viewport — editor/preview stack correctly, preview iframe scales down.
- **README factual claims**: cross-checked against actual code/behavior — all accurate. Notably verified the Formspree "free tier caps at 50 submissions/month" claim against current (July 2026) Formspree documentation via web search — still correct, no edit needed. The "preview matches the export byte-for-byte" claim is literally true (both call the same `buildStandaloneHtml(state)` function). Theme count (4), accent swatch count (8), 2MB logo upload limit — all match the code exactly. No false claims found; README left unchanged.

## Remaining limitations (documented, not defects — no action taken)

These are inherent to the tool's zero-backend design and are already called out honestly in the README's "Known limitations" section:
- Large logo dataURLs bloat exported file size (by design, no image hosting).
- No spam protection on the mailto fallback path (protection only exists when a real form backend like Formspree is wired up).
- No cross-device sync (localStorage-only persistence is an intentional zero-backend tradeoff).
- Single quote block only, no testimonial wall.
- Theme customization limited to accent color on top of 4 presets.

None of these required a code change — they're accurately disclosed tradeoffs of a deliberately simple, dependency-free tool, not bugs.

## Revenue-Readiness score: 8/10

The tool does exactly what it claims, the export is genuinely standalone and safe to hand to a non-technical client, and the monetization playbook (freelance/productized/template-pack tiers) is concrete and immediately actionable for a solo operator. It loses points only because the pre-fix robustness bug (a corrupted localStorage state silently blanking the whole builder) is exactly the kind of support-ticket-generating failure that erodes trust with paying clients — now fixed, but it's a reminder this is a single-file hobbyist-grade app rather than a hardened SaaS product.
