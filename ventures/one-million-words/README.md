# One Million Words

The longest story ever told, one dollar at a time. Strangers append one word each; every
word is permanently attributed (hover any word). The story ends at word 1,000,000 and is
then printed as a book crediting every author.

**Psychology:** contribution to a finite collective monument — cathedral-beam signing at
$1. The progress bar and hard ending create urgency; permanent attribution creates
ownership; the chaos of strangers steering a plot creates the content people screenshot.

## Mechanics
- `GET /api/state` — last 5,000 words + offset, count, distinct authors, target.
- `POST /api/checkout {w, author}` — one token: letters with internal `'`/`-`, optional
  leading quote, ≤2 trailing punctuation marks, ≤24 chars; blocklist; $1 Stripe Checkout.
- Words are append-only. Moderation redacts (`[removed]`) but never renumbers:
  `POST /api/admin/remove {token, wordNumber}`.
- Hard stop at 1,000,000 — checkout refuses beyond it.

## Revenue levers
- $1/word × 1,000,000 ceiling; the book (print-on-demand) is a second act.
- Later: "chapter sponsor" (every 10,000th word milestone), author-page permalinks,
  daily "story so far" newsletter.

## Run
`node server.js` — demo mode without `STRIPE_SECRET_KEY`. See `../GO-LIVE-PAYMENTS.md`.
