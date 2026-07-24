# QuoteCalc Builder

A drag-free, no-build tool for building instant-quote price calculators that local service businesses embed on their websites. You build the calculator on the left, watch it work live on the right, then export a fully standalone `calculator.html` (or an iframe embed snippet) ready to hand to a client.

Open `index.html` directly in any browser — no server, no install, no dependencies. Your work is saved to `localStorage` automatically as you type.

---

## Target customer

**You are not selling to consumers — you're selling to freelance developers, agency owners, and "productized service" resellers** who in turn sell to small local service businesses: house cleaners, mobile detailers, general contractors, movers, landscapers, pest control, HVAC techs, and similar trades.

Secondary audience: the service business owners themselves, if they're technical enough to fill in a builder UI and paste an iframe snippet into Wix/Squarespace/WordPress.

## The problem

Local service businesses lose leads because getting a price out of them requires a phone call or a "we'll get back to you" contact form. Customers comparison-shopping between three cleaners or three movers pick whoever answers fastest — and most small operators are slow, because they're on a job site, not by the phone.

An instant-quote calculator on the homepage closes that gap: the visitor plugs in bedrooms/bathrooms/square footage/add-ons, sees a real number immediately, and the business captures a warm, pre-qualified lead (with the exact quote already itemized) via email or WhatsApp — no missed calls, no back-and-forth.

Building this bespoke for every client is what normally costs a freelance dev hours per client. QuoteCalc Builder turns that into a 10-minute configuration task: pick fields, set prices, brand it, export.

## Revenue models

1. **Done-for-you calculators sold directly to local businesses — $100–$300 per calculator (one-time).**
   Pitch: *"Your website quotes customers while you sleep."* You interview the business owner for 15 minutes about their pricing (per bedroom, per add-on, minimum job size), build the calculator in QuoteCalc Builder, brand it with their logo/colors, and deliver `calculator.html` plus the embed snippet. Price scales with field complexity — $100 for a simple 3-field calculator, up to $300 for multi-tier pricing with several add-on groups and a custom domain page wrapped around it.

2. **Hosting-and-updates retainer — $10–$25/month per client.**
   Once a business has a calculator live, they'll want price changes (seasonal rates, new add-ons, inflation adjustments) without learning the tool themselves. Offer to host the file (Netlify/S3/Cloudflare Pages — pennies of infra cost) and handle all future edits for a flat monthly fee. This is the recurring-revenue engine; the $100–300 build is the door-opener, the retainer is the actual business.

3. **Niche template packs — $29–$79 per pack, sold to other freelancers/agencies.**
   Package pre-built `.json`-importable (or pre-filled `index.html`) starting points for specific verticals — "Moving Company Calculator Pack," "Auto Detailing Calculator Pack," "Contractor Estimate Pack" — each with realistic field sets and pricing logic already configured, sold on Gumroad/Etsy-for-digital-goods to other freelancers who want to resell calculators without doing the discovery work themselves. This turns your own delivery process into a second, higher-margin product.

## First 5 customers plan

1. **Your own network first.** Message 10 local service-business owners you or your contacts already know (a cleaner, a detailer, a landscaper, a handyman, a mover). Offer the first calculator at a steep discount ($49) or free in exchange for a testimonial/case study — you need one real, live example to show the next prospect.
2. **Google Maps cold outreach.** Search "[service] near [city]" for 3–4 service categories, open the ones with dated or clunky websites and no visible quote tool, and email/DM the owner directly: *"I noticed your site doesn't have an instant quote calculator — here's a 60-second demo of one for a business like yours [link to a live export]."* Attach a working example, not just a pitch.
3. **Facebook/Nextdoor local business groups.** Most metro areas have a "[City] Small Business Owners" or trades-specific Facebook group. Post the live demo calculator (not a sales pitch) and offer a limited-time launch price for the first 5 responders.
4. **Partner with a local marketing/web-design freelancer.** They already have service-business clients and no quote-calculator offering; propose a referral fee (20% of the $100–300 fee) for every client they send you, or white-label the tool so they can resell it themselves under their own brand.
5. **Fiverr/Upwork gig listing.** List "Instant Quote Calculator for [cleaning/detailing/moving] business — delivered in 24 hours" as a fixed-price gig. This captures inbound demand from business owners actively searching for exactly this and gives you a portfolio of finished work fast.

Across all five, the fastest path to a sale is always a **live, interactive demo** — this repo's preloaded house-cleaning example exists specifically so you can screen-record it or share the exported file within minutes of a first conversation.

## Honest limitations

- **No backend, no database.** Leads go out via `mailto:` or WhatsApp deep links only — there's no CRM, no lead log, no analytics. If a customer's email client isn't configured, the mailto link does nothing visible; this is a real gap for less technical end-customers of your calculators.
- **All state lives in the browser's `localStorage`** of whichever machine/browser you built it on. Clearing browser data, using a different browser, or switching computers loses your builder progress (though each finished export is a fully independent static file, so shipped calculators are unaffected).
- **No payment collection.** The calculator quotes a price; it does not take a deposit or process payment. That requires bolting on Stripe Payment Links or similar separately.
- **No server-side validation or spam protection** on the lead capture — a bad actor could submit nonsense repeatedly, though impact is limited since it just opens the visitor's own mail/WhatsApp client rather than sending anything invisibly.
- **Pricing logic is intentionally simple:** linear unit pricing, flat add-on prices, and a single minimum charge. It cannot express tiered/bulk discounts, tax rates, or conditional logic between fields (e.g., "if Deep Clean, oven add-on costs less"). Sufficient for the vast majority of small service-business quote scenarios, but not universal.
- **Logo images are inlined as base64 data URLs** — convenient for a single self-contained file, but a large uploaded logo will bloat the exported HTML's size. Recommend keeping logos under ~200KB.
- **No accessibility audit beyond basic keyboard focus states** — screen-reader labeling is present via `<label>` elements but hasn't been tested with assistive tech.
- **The embed snippet uses a placeholder hosting URL** the reseller must edit — there's no built-in hosting/deployment step, by design (keeps the tool a $0-infra static file generator rather than a hosted SaaS with its own costs).
