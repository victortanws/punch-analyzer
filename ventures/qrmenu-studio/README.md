# QR Menu Studio

A single-file, no-signup digital menu builder. Design a themed mobile menu, preview it
live in a phone mockup, export it as a standalone HTML file, host it anywhere for free,
and generate a QR code plus printable table-tent cards that point guests to it.

Everything runs in the browser. There is no backend, no database, no account system —
`index.html` is the entire product. Data is saved to the browser's `localStorage` so
nothing is lost on refresh.

## Target customer

Independent restaurants, cafés, bars, and food trucks that:

- Still use laminated paper menus or a clunky PDF linked from a QR code
- Want to update prices/items without reprinting or waiting on a web developer
- Don't want to pay $30–90/month for a bloated all-in-one restaurant SaaS platform
- Are being sold to directly by a freelancer, local marketing consultant, or web-design
  side-hustler — not shopping app stores themselves

The real buyer of this *tool* is typically **you**: a solo operator or small agency who
uses QR Menu Studio to rapidly produce and re-skin menus for restaurant clients, then
resells the output (a hosted menu + QR code + printed table cards) as a service.

## The problem

- Paper menus are expensive to reprint every time a price or seasonal item changes.
- Many "QR menu" solutions on the market are subscription platforms ($20–100/mo) that
  lock the restaurant's menu content behind a vendor's hosting and branding.
- Restaurant owners are time-poor and don't want to fight with a web builder — they want
  someone to hand them a finished, good-looking mobile menu and a stack of table cards.
- Existing free options (a Google Doc link, a plain PDF) look unprofessional and aren't
  mobile-optimized, hurting a restaurant's perceived quality.

QR Menu Studio closes the gap: a fast way to produce an attractive, mobile-first, on
-brand menu with zero recurring software cost to the builder, which can then be resold
to restaurants with a recurring retainer attached.

## Revenue models

### 1. One-time setup fee per restaurant — $150–$500
Charge a flat fee to interview the owner, build their menu in the Builder tab (logo,
theme, accent color, full section/item structure), export `menu.html`, host it (Netlify
Drop takes 30 seconds), generate the QR code, and print/deliver table-tent cards.
- $150–$250: simple menu, 1–2 sections, minimal-light or warm-bistro theme, digital QR
  only (owner prints cards themselves).
- $300–$500: full multi-section menu, custom logo integration, printed and laminated
  table cards delivered in person, plus a stock photo or two if the owner has none.
This is the highest-margin, easiest-to-close offer because it's a fixed, one-time ask
with an obvious before/after (laminated paper vs. a clean phone-native menu).

### 2. Monthly "menu updates + hosting" retainer — $10–$20/month
Most restaurants change specials seasonally or adjust prices a few times a year but
don't want to touch a tool themselves. Offer a standing retainer: the restaurant emails
or texts changes, you update the menu in the Builder, re-export, and re-upload to their
host — same QR code, same URL, zero disruption for guests.
- $10/mo: up to 2 update requests per month, 48-hour turnaround.
- $20/mo: unlimited reasonable update requests, same-day turnaround, plus you handle
  hosting renewal/monitoring so their link never breaks.
This converts a one-time sale into recurring revenue and is the multiplier: 20 clients
at $15/mo average is $300/mo of near-passive income after the initial setup work.

### 3. Agency / reseller model
Package QR Menu Studio as a white-label service inside a broader local-marketing
agency or freelance offering (alongside social media management, Google Business Profile
optimization, etc.):
- Bundle the menu + QR + table cards as a **free "in" offer** to land a bigger monthly
  retainer (e.g., $300–$800/mo social media + website package) — the menu is the
  low-cost, high-visible-value item that opens the door.
- Train and license other freelancers/agencies to use the same builder and process for
  a flat license fee ($49–$99) or a rev-share (e.g., $2/mo per active restaurant client
  they manage), since the tool itself has no per-seat cost to you.
- Sell "menu refresh" packages to restaurant groups with 3+ locations at a multi-unit
  discount (e.g., $400 setup for the first location, $150 for each additional location
  using the same theme).

## First 5 customers plan

1. **Your own neighborhood, on foot.** Walk into 10–15 independent restaurants/cafés
   within a 2-mile radius during their slow hours (2–4pm). Bring a phone with a sample
   menu already loaded in the app so you can show, not tell.
2. **The 90-second pitch + live demo.** "I build phone-friendly menus that replace your
   paper menu or PDF — guests scan a code on the table and see this." Open the phone
   preview on your phone, tap through the sample bistro menu, then show their actual
   name typed into the Builder in real time so they see themselves in it.
3. **Close with a no-risk trial offer.** "I'll build your full menu for $150 (normally
   $250) — if you don't like it, I'll refund you, no questions asked." Removing risk is
   the single biggest lever for a first sale with zero portfolio/reviews yet.
4. **Ask for the referral, not just the review.** After delivering the first 1–2 jobs,
   ask specifically: "Do you know another restaurant/café owner who'd want this?" Local
   restaurant owners talk to each other constantly (shared suppliers, local business
   groups) — this is the highest-converting channel after the initial cold walk-ins.
5. **Local Facebook groups + Instagram DMs.** Post a short before/after video (paper
   menu vs. phone menu scan) in local "X neighborhood business owners" Facebook groups
   and DM 10–20 café/restaurant Instagram accounts in your city directly. Restaurant
   owners run their own social media and respond to DMs far more than cold email.
6. Once you have 5 paying setups, convert as many as possible onto the $10–20/mo update
   retainer immediately — that recurring base is what makes the business durable.

## What's included

- Builder panel: restaurant name, tagline, logo upload (stored as a data URL), 3 theme
  presets (Elegant Dark, Warm Bistro, Minimal Light) plus a free-form accent color
  picker with quick-swatch presets.
- Menu structure editor: unlimited sections and items, each item has name, description,
  price, and dietary tags (Vegetarian, Vegan, Spicy, Gluten-Free, New). Add, edit,
  delete, and reorder (up/down) both sections and items, with confirmation prompts
  before destructive deletes.
- Live phone-frame preview that updates on every keystroke.
- Export tab: downloads a fully standalone, mobile-first `menu.html` via Blob — no
  external dependencies, ready to drag into Netlify Drop or push to GitHub Pages. Also
  supports printing the menu directly from the browser.
- QR tab: paste your hosted URL to render a scannable QR code (via the qrcodejs CDN
  library), with a graceful plain-text fallback if the CDN is unreachable (e.g. fully
  offline), and a "Print table cards" flow that lays out a 6-card table-tent sheet via
  dedicated `@media print` styles.
- A realistic preloaded sample menu ("The Copper Fig" — 3 sections, 11 items) so the
  app demos instantly with no setup, plus a one-click "Load sample" and "Clear all"
  reset.
- All data (restaurant details, theme, menu content, saved menu URL) persists in
  `localStorage` — closing the tab or refreshing never loses work.

## Honest limitations

- **No cloud sync or multi-device editing.** Everything is stored in one browser's
  `localStorage`. If you build a client's menu on one laptop, you must export/re-import
  or rebuild it to edit from another device. There is no login system by design (that's
  what keeps this a $0-infrastructure tool) — but it means you are responsible for not
  clearing your browser data before a client's menu is finalized and exported.
- **No built-in hosting.** The app produces a static `menu.html` file; you must upload
  it yourself to Netlify, GitHub Pages, or similar. This is a 30-second manual step, not
  automated inside the tool.
- **QR code generation requires internet access once.** The QR renderer loads from a
  CDN (`cdnjs.cloudflare.com`). If you're fully offline, the app still works for
  building/exporting/printing the menu, but the QR tab falls back to showing the URL as
  copyable text instead of a scannable code until you're back online.
- **No image hosting for the logo beyond a data URL.** Logos are embedded directly in
  the exported HTML as base64 data. This keeps the file self-contained (no broken image
  links ever), but very large logo images will bloat the exported file size — keep logos
  under a few hundred KB for best results.
- **No analytics, no live-editing after export.** Once `menu.html` is downloaded and
  uploaded to a host, changing the menu means re-editing in the Builder and
  re-downloading/re-uploading — there's no dashboard for the restaurant to self-serve
  edits (this is intentional: it's what justifies the update retainer revenue model).
- **Single-currency, single-language.** Prices are rendered with a `$` prefix and there
  is no built-in localization or multi-currency support. Easy enough to hand-edit in the
  source for a specific market, but it's not a toggle in the UI.
- **Not a POS or ordering system.** This is a menu *display* tool only — no online
  ordering, payments, or table reservations. It solves the "guest looks at a menu"
  problem, not the full restaurant tech stack.

## Sales pitch

Turn every paper menu into a scan-and-see mobile menu in one sitting, then get paid
again every month to keep it fresh.
