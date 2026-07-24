# The Ledger of Vanity — Pre-Deployment UI/UX Review

Reviewed 2026-07-06 against a live demo instance (isolated DATA_DIR, port 9765).
Everything below was verified by doing: full checkout loops via API and browser, 375×812
and desktop viewports, computed WCAG ratios, accessibility tree inspection, hostile inputs.
No product files were modified.

## Verdict: **SHIP AFTER FIXES**

The bones are genuinely good — the copy voice is the best asset the product has, the
dialog/focus mechanics are correct, escaping is rigorous, the payment loop is idempotent
and refresh-safe. But there is one $1 layout-destruction exploit, a profanity filter that
a 12-year-old defeats with a space bar, and a stack of conversion/accessibility gaps that
are cheap to fix and expensive to discover in public.

---

## Blocking

**B1. A $1 tribute with an unbroken 140-char declaration destroys the entire page layout.**
Verified: posted `"W"×140` as a motto; the motto's scrollWidth hit 1769px inside a 17px
column, the document grew a horizontal scrollbar, and roll cards were pushed off-viewport
(card right edge at −83px). `.roll .who .name` has `word-break: break-word`;
`.roll .who .motto` and `.throne .motto` have nothing. Any griefer defaces the whole site
for $1 — and if they take the throne, the throne breaks too. One line of CSS
(`overflow-wrap: anywhere` on both motto rules) closes it.

**B2. Spaced-out profanity sails through moderation.**
Verified: `"F u c k Face"` was accepted by `/api/checkout` (`blocked()` splits on
non-letters, so tokens are `f,u,c,k`; the collapsed-substring pass covers only the three
`SLUR_SUBSTRINGS`). Homoglyph evasion (`Sh1t`) is caught, URLs are caught, Scunthorpe
passes correctly — so the machinery exists; the collapsed check simply needs to run
against `BAD_TOKENS`/`BAD_PREFIXES` too. On a product whose entire surface is
user-supplied text ranked at the top of the page, this is not a nice-to-have.

**B3. Placeholder identity is still live everywhere money is involved.**
`hello@example.com` is the operative contact in the footer, terms modal, and legal.html
unless `CONTACT_EMAIL` is set — nothing warns at startup in live mode. legal.html still
displays `[Your legal name or business entity]` / `[your state/country]`. Also, the demo
seed puts Cristiano Ronaldo's real photo and a fabricated first-person declaration on the
public face of the product; `seed/ATTRIBUTION.md` itself says remove before launch, and
the CC BY-SA licence requires attribution *where displayed*, which the page does not give.
The `railway.json` start command without a Stripe key deploys exactly this demo publicly.

## Major

**M1. The "nothing was charged" toast is invisible in the only scenario it exists for.**
On return from a canceled checkout, the draft-restore modal opens via `showModal()` —
a top-layer element — and the reassurance toast renders beneath the backdrop
(verified: `elementFromPoint` at the toast's position returns the modal's `.amounts` div,
and the whole page outside the dialog is inert). The user who just bailed on a payment,
the person most in need of "nothing was charged," cannot see it. Put that line inside the
reopened modal, or delay opening the modal until the toast is dismissed.

**M2. On a real phone (375×812) the Pay button is below the fold with no scroll cue.**
Verified: Pay's bottom edge at 879px in an 812px viewport; the modal visually "ends"
after the tribute buttons with no overflow affordance. This is the primary CTA of a
conversion-obsessed one-pager. Tighten vertical rhythm on mobile or pin the actions row.

**M3. The largest-tribute display rule is under-communicated at the moment of payment.**
The modal states the rule ("Your entry displays the name, declaration, and image of your
largest single tribute") mid-paragraph, but there is no contextual warning when it
matters. Verified behaviors a paying user will not predict:
- Pay $25 with photo A, later pay $5 with photo B → B is stored, charged for, and never
  shown. Money silently buys nothing visible.
- Pay an amount **equal** to your own largest, without re-attaching your image → your
  photo silently disappears from the entry (tie goes to most recent; verified).
- Any stranger who ties or exceeds an entry's largest single tribute seizes its spelling,
  declaration, and image (verified: a lowercase respelling took over the display).
The client knows the name and amount at submit time and could warn ("this tribute will
not change what your entry displays").

**M4. Screen reader users cannot perceive the three most important state changes.**
Verified via DOM/a11y tree: `#formError` has no `role="alert"`/`aria-live` (server
rejections are silent); `#toast` has no live region (payment success, rank announcement,
and cancellation are silent); amount buttons carry no `aria-pressed`/radiogroup semantics
(the selected tribute is conveyed by border color only); both dialogs lack an accessible
name; the "An image…" and "Tribute" labels are associated with nothing.

**M5. Form-error red fails contrast where failure feedback matters most.**
Computed: `#b8453a` on `--bg-raise` = **3.48:1** at 12.8px — below AA (4.5:1). Also below
AA: rank numerals 11+ and monogram initials, `#8a7440` on card/raise backgrounds =
4.10–4.35:1 at their rendered sizes. Body text is fine (`--ink` 15.9:1, `--ink-dim`
6.2:1, `--ink-faint` 5.0–5.4:1) — the palette survives; two tokens need brightening.

**M6. A 404'd entry image renders as a glaring light broken-image disc.**
Verified by deleting a stored image file: the `<img class="pic">` has no `onerror`
fallback to the monogram, so a pale broken circle sits in the gold-on-black rhythm (worst
case: the 148px throne portrait). File loss is not hypothetical — images live on disk
beside a JSON db and `admin/censor` deletes files.

**M7. Social sharing has no image card.**
`twitter:card` is `summary` with no `og:image`/`twitter:image`. For a product whose
entire growth loop is "Announce it →", the unfurl is a text-only black hole. Generate a
default gold-on-black card at minimum; a per-rank dynamic card is the obvious upgrade.

**M8. legal.html lies about its own date.**
"Last updated" is computed as *today* via JS on every page view. A terms document whose
date always reads as freshly updated defeats the point of a last-updated date and looks
bad in any dispute. Hardcode it.

**M9. Ledger permanence depends on a JSON file nobody is told to persist.**
`data/data.json` on local disk; `railway.json` configures no volume. A redeploy wipes
every paid inscription on "The Ledger does not forget." (DEPLOY-RAILWAY.md may cover it —
verify a volume is mounted before a single real dollar is taken.)

## Minor

1. **Emoji-leading names break the monogram**: `e.name[0]` splits the surrogate pair —
   "🦄 Rex" renders "�" (verified, codepoint `d83e`). Use `[...name][0]`.
2. **Stale-response race in search/pagination**: two fast Next clicks left internal
   `page=3` while the UI showed "Page 1 of 3" (verified) — no request sequencing/abort;
   last response wins even when stale.
3. **Roll staleness**: the redraw fingerprint is `q:page:total:first-entry-total` — a
   mid-list amount change redraws nothing until something else changes.
4. **Pagination doesn't scroll to the roll's top** — page 3 appears above the viewport;
   user must scroll up to read it (verified scrollY unchanged).
5. **Creed line-break orphan**: hard `<br>`s leave the em dash alone on its own line at
   375px (verified in screenshot).
6. **"Other" placeholder says "Any amount, $1 or more"** — the $9,999 cap is only
   discoverable via server rejection.
7. **"Withdraw" as the cancel label** is on-brand but ambiguous next to a payment
   button — it can read as a destructive act (withdrawing a tribute/entry).
8. **Circular crop is a surprise**: uploads are center-cropped into a circle by
   `object-fit: cover` with no hint ("square images work best") — the tiny round preview
   is the only clue.
9. **Server never re-encodes images**: direct API callers bypass the client resize
   (verified: a full-resolution 94KB JPEG was stored and served as the throne portrait);
   a 600KB 10000×10000 JPEG is accepted as long as magic bytes match.
10. **Search icon "⌕" is exposed to screen readers** (CSS `content` lands in the a11y
    tree); roman ranks read as bare letters ("I", "V", "X"), and the `<ol>` announces
    "1 of 24" on every page regardless of true rank.
11. **README contradicts the product**: it says display uses "the most recent spelling
    and motto" — the code and legal.html say largest-single-tribute. Stale docs about the
    core rule will bite support.
12. **Copy register breaks** (the register is otherwise excellent): "connection hiccup"
    (toast), "WILL appear" (all-caps shouting), "(it is resized in your browser first, so
    this is unusual)" (tech-support parenthetical in a server error), "HEIC is not
    supported — use JPEG or PNG" (console voice), and "stack"/"payments stack" (gamer
    idiom, used twice). Suggested register: "The connection faltered."; "it will appear.";
    "The Ledger accepts JPEG, PNG, or WebP."
13. **Silent failure mode**: `loadState`/`loadRoll` swallow all errors — if the server is
    down the page sits on stale numbers with no indication.
14. **Share intent still points at twitter.com** (works via redirect; consider x.com).

## The 5 hard questions

1. **Who owns an entry?** Anyone who ties or exceeds an entry's largest single tribute
   buys control of its face, spelling, and words — verified live. Is a stranger hijacking
   the #1 entry with a mocking photo a feature (contested vanity) or your first legal
   incident? If the answer is "outbid them," say so on the page; if not, entries need a
   claim mechanism (e.g., the email Stripe already collects as an owner handle).

2. **What happens when two real "John Smith"s pay?** Name is the primary key, so the
   second John Smith's money silently merges into the first's total and can seize its
   display. Merge-by-spelling is load-bearing for the "payments stack" pitch — but is it
   defensible when a customer says "that entry isn't me, where did my $100 go?"

3. **What is the chargeback story?** The ToS declares all tributes final, but Stripe
   chargebacks will happen on impulse vanity purchases. A charged-back payment remains in
   `db.payments` forever — rank keeps counting money you returned — and the only admin
   tool removes an entire name, not a single payment. What's the workflow, and does rank
   deflate?

4. **Who is the Keeper at 3 a.m.?** Image moderation is entirely reactive (curl + shared
   admin token), text filtering is a ~20-word list already defeated by spaces, and there
   is no nudity/CSAM screening on uploads displayed instantly to the world. When this
   goes viral, what's the operational SLA for removing an illegal image, and who carries
   the pager?

5. **What does launch day look like with zero entries?** Live mode correctly quarantines
   demo data, so the real ledger opens as "The Ledger awaits its first name" under a
   "$0 tribute collected" masthead — the exact opposite of the social proof the demo
   sells (and the Ronaldo seed can't legally make the jump). What's the seeding plan, and
   do you actually want lifetime revenue displayed publicly forever once it *is* real?

## What works well

- **The copy is the product, and it's excellent.** "It confers nothing. That has never
  stopped anyone." / "A tribute would fix that." / "The Ledger pretends not to judge." /
  "Inscribed as 'name'. This confers nothing." on the Stripe line item — the deadpan
  luxury register holds almost everywhere, including error states, and the share text
  ("I hold rank N on The Ledger of Vanity. It confers nothing.") is engineered to travel.
- **Native `<dialog>` done right**: focus lands in the name field on open, Esc closes,
  focus returns to the trigger (verified), backdrop blur is tasteful.
- **Escaping is rigorous** — hostile mottoes with `<img onerror>`/`<script>` render as
  inert text in the roll, toast, and empty-state message (verified).
- **The payment loop is defensively built**: double demo-pay + double confirm produced
  exactly one $2 payment (verified); confirm is refresh-safe; pending checkouts expire;
  demo data can never leak onto a live ledger.
- **Anti-defacement works as promised for the advertised case** — a $5 payment could not
  alter a $25 inscription's display (verified), and the tie rule matches legal.html.
- **Draft stashing is a genuinely kind touch**: cancel at checkout and your name, motto,
  and image come back, modal pre-opened, counter updated (verified).
- **Pagination and search degrade gracefully**: `page=99/0/-3/abc` all clamp sanely;
  ranks are preserved under search; the 0-result state sells ("A tribute would fix that").
- **The monogram fallback looks intentional** — a serif initial in a gold-ringed disc
  reads as design, not absence (screenshot-verified), and it's `aria-hidden` correctly.
- **Throne-with-no-image degrades to a name-only throne** without layout damage.
- **Core palette passes AA with room to spare** (body 15.9:1, dim 6.2:1, faint 5.0+:1);
  the gold gradient masthead and throne portrait treatment photograph beautifully.
- Rate limiting engages exactly at spec (429 after 20 checkout attempts/min, verified).
