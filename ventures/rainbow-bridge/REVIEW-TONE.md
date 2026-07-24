# Rainbow Bridge — Grief-Sensitivity & Tone Review

_Reviewed for launch. Scope: every user-facing string in `public/index.html`, `public/app.js`,
`public/legal.html`, `public/admin.*`, and the server-side error/moderation copy and demo seed in
`server.js`. Flows driven live in demo mode (checkout → demo-pay → confirm, plus every error path)._

---

## Verdict: **SHIP AFTER COPY FIXES**

The emotional copy is, on its own, launch-ready and genuinely lovely — among the most careful
grief writing I've reviewed. The word choices ("Place them," "Return to the meadow," "years
together," "companions rest here") are tender without being saccharine, the refund and permanence
promises are outstanding, and the $29 upsell is handled with real restraint. **None of the blocking
issues are about the tender copy itself** — they are launch-hygiene artifacts that leak into the
grieving reader's view and quietly break the trust the rest of the site earns. All are fixable with
copy/config edits, not a rework. Fix the four items below and this ships with a clear conscience.

---

## Blocking tone / trust issues

### B1. The legal page tells grieving users its own promises are an unreviewed draft
`public/legal.html` opens with a note and closes with a footer that are clearly developer scaffolding
left in a published page:

- Line 33–34 (`.note`): _"This is a plain-language starting point — please have it reviewed by a
  lawyer before you rely on it commercially."_
- Line 91 (footer): _"…these terms are a template pending review."_

This is the page that holds the **permanence promise (§3)** and the **refund promise (§5)** — the two
commitments a grieving person is trusting with their pet's memory and their money. Telling them, in
the same document, that it's an unreviewed template pending legal review directly undercuts "they stay,
gently and for good." **Remove both lines** (get the terms actually reviewed off-page) before launch.
The "operated by Tan Weng Seng, Selangor, Malaysia" line can stay — that's honest and grounding; only
the "this is a draft" self-disclaimer must go.

### B2. The "write to us" lifeline points at a placeholder address
The contact address is `hello@example.com` everywhere it isn't overridden by the `CONTACT_EMAIL` env
var: `index.html` footer (line 235), `legal.html` §10 (line 88), and `server.js` default (line 22).
The entire graceful-exit story — change your mind, fix a typo, request removal, get a refund — routes
through this one address. If it ships unconfigured, every reassurance in the copy ("write to us and
we'll take care of it," "we read every message") dead-ends. **Must-verify launch step:** set
`CONTACT_EMAIL` to a monitored inbox and confirm it renders in the footer, the About modal, and legal.

### B3. The anniversary email promises something the system can't yet do
The email field (index.html line 297–298) promises: _"for a gentle remembrance each year"_ /
_"We'll only write on their anniversary."_ Per `README.md` (lines 29–32), the annual email is **not
built** — the address is collected now, but nothing sends. Collecting an email under a specific,
dated promise ("each year, on their anniversary") from a grieving person, then never delivering, is a
quiet broken promise on the most emotionally loaded day of their year — and some will be waiting for
it. **Either** ship the send before launch, **or** soften the copy so it promises only what's live
(see C1). Do not collect against a promise you can't currently keep.

### B4. "Final once placed" contradicts the refund promise it sits next to
Pay-note, index.html line 318: _"Reviewed before it appears. Final once placed — see our refund
promise."_ "Final once placed" reads as _no take-backs_ at the exact anxious moment before payment —
yet the linked refund policy (§5) says the opposite: write to us, change your mind, no explanation
needed. The microcopy is more rigid than the actual, generous policy, and the rigidity lands right
where a grieving person is most hesitant. Soften so the microcopy matches the kindness of the policy
(see C2).

---

## Copy that should change

**C1 — Anniversary email promise (index.html:297–298)**
Current:
> `Your email — for a gentle remembrance each year (optional)`
> placeholder: `We'll only write on their anniversary. Never shared.`

Suggested (until the send is actually built):
> `Your email — so we can reach you about this memorial (optional)`
> placeholder: `We'll only use it for their yearly remembrance, once that's ready. Never shared, opt out anytime.`

(If the yearly email ships before launch, keep the original wording — it's lovely — but add the
opt-out reassurance.)

**C2 — Pay-note (index.html:318)**
Current:
> `Reviewed before it appears. Final once placed — see our refund promise.`

Suggested:
> `Reviewed with care before it appears. Changed your mind? Our refund promise has you covered.`

**C3 — Hero CTA note (index.html:207)** — _minor_
Current:
> `From $19. Every memorial is reviewed with care before it appears.`

Leading a grief CTA with a bare price tag ("From $19") is the one spot that reads faintly like a
storefront. Transparency here is kind (no paywall surprise after someone pours their heart out), so
keep the price — just soften the framing:
> `A place in the meadow is $19. Every memorial is reviewed with care before it appears.`

**C4 — Legal note + footer (legal.html:33–34, 91)** — see B1. Remove the "template pending review" /
"have it reviewed by a lawyer" self-disclaimers.

**C5 — "An eternal light" naming (index.html:307)** — _watch-item, likely fine_
Because "eternal" is applied only to the $29 tier while it sits beside a promise that _every_
memorial is permanent, a fast reader could infer the $19 memorial is the less-lasting one. The $19
description does say "forever" and §3 guarantees both, so this is mitigated — no change required, but
worth a second look. If you ever touch it, anchoring the difference on the candle/story rather than
permanence (e.g. "An eternal flame") keeps "eternal" attached to the light, not the memorial's
lifespan.

---

## What's already pitch-perfect (do not touch)

- **Permanence promise, legal §3** — honest _and_ reassuring. It refuses to lie ("we cannot promise
  the internet is forever… and we won't pretend otherwise") yet gives the exact comfort a grieving
  person needs: "we will not quietly delete what you left here, and if we ever had to close we would
  give notice and a way to keep what you placed." Exemplary.
- **Refund promise, legal §5** — _"Grief is not a moment for fine print… no explanation needed… This
  is more generous than the law requires, and we mean it."_ This is how you write a refund policy for
  the bereaved.
- **The $29 upsell** — the sharpest risk, and it's handled with real integrity: two equal options
  side-by-side, the cheaper one pre-selected, described in aesthetic terms (a candle, room for a
  longer story) with **zero** manipulation ("show them how much you loved them," "they deserve the
  best" — none of that). It never implies the $19 memorial is lesser.
- **Success toast** (app.js:172) — _"Thank you. [name] will join the meadow once we've gently reviewed
  it — usually within a day. You'll always have a place for them here."_ Warm, sets expectations,
  reassures about permanence.
- **Canceled-checkout copy** (app.js:182) — _"Nothing was charged. What you wrote is kept here —
  continue whenever you're ready."_ Draft is genuinely restored. Pressure-free and kind.
- **Error messages** — consistently gentle and non-accusatory. The profanity block —
  _"Please choose gentler words — this is a place of remembrance."_ — is the standout: it corrects
  without shaming and never says "profanity detected." Rate-limit "One moment, please." and the
  HEIC hint are equally soft.
- **Form microcopy** — _"Take your time. You can add as little or as much as feels right,"_ "Their
  name / The name you called them," "They were a," "Passed," "Placed by / Your name, or your
  family's," "Not now" (instead of Cancel). All past-tense, all tender.
- **Detail view** — "N years together" reframing a lifespan as shared time, and "Return to the
  meadow" as the close, are beautiful.
- **Empty/no-results states** — "The meadow is quiet, for now. The first companion is waiting to be
  remembered." / "No companion here matches "…" yet." The "yet" does real emotional work.
- **Demo seed data** — every one of the ten is respectful, specific, and warmly written ("A small,
  soft comma in a loud sentence of a life"; "She knew before I did when I needed her"). Gentle humor
  where present ("Stole socks, hearts, and one entire roast chicken") never tips into flippant. Names
  are diverse and human. Safe and tasteful to launch with.
- **Stripe line-item** (server.js:305) — "In loving memory of {petName}" on the receipt/statement is
  a quietly caring touch most teams would forget.
- **Admin "Groundskeeper's Desk"** — even the internal tool keeps the tone ("Review each memorial
  with care," "The meadow is peaceful").

---

## Missing reassurance a grieving person may want

1. **A gentle pointer to pet-loss grief support.** Nothing on the site acknowledges that this loss
   can be genuinely heavy, and there's no optional link to a pet-loss support resource. This is
   squarely a grief product; a single, non-clinical line (e.g. near the footer or in the About modal:
   _"Losing a companion can be very hard. If you're struggling, pet-loss support is available."_ with
   a reputable link) would deepen the care without being preachy. Optional, not blocking — but it's
   the most human thing currently absent.

2. **"You won't be spammed," reassured at the point of capture.** The legal terms cover it
   ("never share or sell it; ask us to remove it any time"), but the email field itself doesn't yet
   say "opt out anytime." Folding that into C1 closes the gap where the anxiety actually occurs.

3. **A word about fixing your own typos.** For a memorial billed as permanent, a misspelled pet name
   can only be fixed by emailing. The refund/edit-on-request policy covers it, but a grieving person
   may not realize an honest mistake is easily correctable. A small note ("Something not right after
   it's placed? Write to us — we'll fix it, gladly.") would relieve that specific fear. Minor.

4. **Internal-voice caution (not user-facing, but launch-relevant).** The `README.md` framing
   ("grief is the least price-sensitive spend humans make and it renews") and the commit history are
   the exact opposite of the site's voice. It's internal and users never see it — fine as-is — but
   whoever writes launch/marketing copy must not let that mercenary register anywhere near the public
   surface. Keep it strictly internal.

---

_No product files were modified during this review. This file is the only artifact created._
