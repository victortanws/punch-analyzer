# PunchCard Loyalty

A digital loyalty punch card you set up in five minutes and sell to cafés, salons, barbershops, and any small shop that currently uses a stamped paper card taped to the register.

Open `index.html` directly in a browser (double-click it, no server needed) to see the seller-facing app. Everything — business branding, reward rule, staff PIN — is saved to that browser's `localStorage`, so it survives refreshes and closing the tab.

---

## The problem

Independent shops love punch cards because they're cheap and customers understand them instantly. But paper cards get lost, get left at home, can't be tracked, and cost real money to print. The "solution" most point-of-sale vendors sell instead is a full loyalty *platform* — a customer-facing app download, a merchant dashboard, a monthly SaaS fee per location, sometimes a per-transaction fee. For a single-location coffee shop or barbershop doing a few hundred transactions a month, that's a sledgehammer for a thumbtack job, and most owners never finish onboarding it.

**Target customer:** the owner-operator of a single-location café, salon, barbershop, food truck, or boutique — someone who already runs (or wants to run) a "buy N get one free" punch card, has a smartphone and a laminated paper stack behind the counter, and does not want to manage an app, a login, or a monthly platform fee that requires per-customer accounting.

## What it actually is (the honest pitch)

This is a paper punch card, digitized — not a cloud loyalty platform. Each customer's card is a single self-contained HTML file that lives in **that one customer's phone browser storage**. There is no central database, no account system, and no cross-device sync. That's a deliberate trade-off, not a missing feature:

- No backend to build, host, secure, or pay for — which is exactly why this can be sold at a one-time-setup-plus-small-fee price instead of a $50–200/mo SaaS price.
- The customer never installs anything or creates a login — they scan a QR code, bookmark a page, and it behaves like a wallet pass.
- The trade-off: if a customer clears their browser data, switches phones, or uses a different phone for a return visit, their stamp history doesn't follow them (same as losing a paper card). This is the single most important thing to set expectations on with buyers up front — position it as "just like the paper card you have now, minus the paper," not "an enterprise CRM."

## Feature set

- **Business setup panel** — name, logo (stored as a data URL, no server upload), brand color, configurable reward rule (buy 4–12, get X), and a 4-digit staff PIN.
- **Card generator** — "Download customer card" produces a fully standalone `card.html` (via a Blob download) with the shop's branding baked in. Opens and works from `file://` with zero dependencies.
- **Stamping flow** — staff taps "Stamp" on the customer's own phone at checkout and enters the PIN; correct PIN adds an animated stamp with a stored timestamp, wrong PIN shows a clear error and never touches the count.
- **Completion + redemption** — when the grid fills, the card automatically switches to a reward screen; "Redeem" is PIN-gated, logs the redemption, resets the grid for the next cycle, and keeps a running lifetime-rewards counter.
- **Live pitch demo** — a fully interactive sample card inside the seller app (separate storage from real setup data) so you can hand a prospect your phone and let them tap Stamp themselves, PIN `1234`.
- **QR + printable counter sheet** — paste the hosted card URL to get a QR code and a print-formatted sheet of nine branded mini-cards for the register or window; customers scan and land straight on their card.
- **Realistic sample data preloaded** — "Copper Cup Coffee — buy 9 coffees, 10th free" so the app is demoable the instant it's opened, with no blank/lorem-ipsum states.

## Revenue models

**1. Setup fee + flat monthly, sold direct**
`$99 one-time setup + $19/month per shop.` You configure the card, brand it, print their counter sheet, and host `card.html` for them (Netlify/GitHub Pages, effectively free to you). The $19/mo is for hosting, minor edits (seasonal reward changes, PIN resets), and "it just works" peace of mind — not a metered SaaS fee. At 15 shops this is $285/mo recurring plus setup fees for new signups, with near-zero marginal cost per shop since there's no backend to scale.

**2. One-time sale, self-serve**
`$149 flat, no recurring fee.` Sell the app itself (or a branded copy you host) as a one-time purchase for owners who want to run it themselves — they fill in the setup form, download their card, host it wherever they like (or just use a QR code pointing at a Netlify Drop link), and print their own sheet. Good for price-sensitive buyers or as a lower-friction entry product that upsells into the managed plan above.

**3. Local agency / franchise-style rollout**
Pick one town or commercial strip, and sell "digital punch cards" as a local specialty the way someone might sell Google Business Profile management. `$99 setup + $19/mo` per shop, targeting 30 shops in a defined area (coffee shops, barbers, nail salons, car washes, ice cream stands) — that's $570/mo recurring from one town once fully sold in, for an afternoon of setup work per shop and no ongoing engineering cost. This model scales by hiring a local rep on commission per shop signed, then repeating in the next town.

**Common wedge for all three:** "Replace your paper punch cards with a digital one — no app to download, and you don't pay per customer like the loyalty apps do." That's the entire pitch; the live demo tab exists specifically so you can deliver it in under two minutes standing at someone's counter.

## First 5 customers plan

1. **Your own regular coffee shop.** You're already a customer, you already know the owner by name. Offer the first shop a free or heavily discounted first month in exchange for being able to photograph the counter sheet in place and get a testimonial quote.
2. **One barbershop or salon near that coffee shop.** Different vertical, same block — lets you point at two live installs within a five-minute walk when pitching a third, and tests that the reward-rule copy ("buy 9 haircuts" vs "buy 9 coffees") reads naturally.
3. **A walk-in pitch to 5–10 shops on one commercial strip**, using the live demo tab on your phone. Lead with "how many punch cards do you re-print a year?" — most owners can answer instantly, which makes the paper-card cost tangible before you mention price.
4. **A local Facebook/Nextdoor small-business group post** offering the first 3 responders a free setup ($99 value) in exchange for a review and permission to use their shop name as a reference.
5. **A one-page flyer left at each installed shop's register** ("Ask us about your own digital punch card — we run [Business Name]'s") — the counter sheet itself becomes your distribution channel once a few shops are live, since customers see it while paying at shop #1 and mention it to their own shop owner.

Close every one of these with the honest framing above: this is a paper card upgrade, priced and positioned like one, not a promise of an enterprise CRM.

## Limitations (stated plainly)

- **Each card lives in one phone's browser storage.** There is no account, no login, no server-side record of any customer's stamps. If a customer clears site data, switches phones, or uses private/incognito browsing, their card resets to zero — exactly like losing a paper card. This is the central trade-off of the whole product and should be part of the sales pitch, not a footnote.
- **No cross-device or cross-location sync.** A customer cannot check their stamp count from a different phone, and a shop with two registers has no way to reconcile stamps given at one register with the same customer's card at the other unless it's the same physical device.
- **No owner-side reporting.** Because there's no backend, the shop cannot see aggregate stamp/redemption analytics, a customer list, or export data. What they get is exactly what's on the card in front of them.
- **The staff PIN is a light deterrent, not real security.** It's a shared 4-digit code typed on the customer's own screen — appropriate for stopping a customer from self-stamping, not for protecting against a determined bad actor. Anyone who inspects the exported card's source can find the PIN in plaintext.
- **Hosting is on the shop/seller, not built into this app.** `index.html` generates the card; putting `card.html` at a public URL (Netlify Drop, GitHub Pages, shop's own site) is a separate manual step covered in-app but not automated.
- **Logo size is capped at 1.5MB** and stored as a base64 data URL inside both the seller app's `localStorage` and the exported card file — great for portability, but large logos will bloat the downloaded HTML file and slow down `localStorage` writes on very old phones.
- **QR generation requires the qrcodejs CDN script to load.** If the seller app is opened with no internet connection, QR generation and the printable sheet's QR codes gracefully fall back to showing the raw URL as text instead of crashing, but you won't get a scannable code until you're back online.
