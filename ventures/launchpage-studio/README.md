# LaunchPage Studio

A single-file, no-signup landing/waitlist page builder for indie founders and local businesses. Fill in a form, watch a live preview update, and download a complete, responsive `landing.html` you can host anywhere in seconds.

Open `index.html` directly in any browser — no server, no build step, no account. Works offline. All edits are saved automatically to `localStorage` so nothing is lost on refresh.

---

## Who this is for

**Target customer:** a solo founder, indie hacker, or local business owner who needs a credible landing page *today* — to validate an idea, collect a waitlist, or announce a launch — but doesn't want to learn Webflow, hire a designer, or wait on a dev. Also a strong fit for:

- Freelance web designers / no-code consultants who want a fast first draft to show a client
- Agencies that pump out many small landing pages for local clients (restaurants, gyms, contractors, event organizers)
- Makers validating a product idea before writing a line of app code

## The problem

Most people who need a landing page fall into a bad set of options: a $20–50/month SaaS page builder that's overkill for a single static page, a freelancer who takes a week and charges $500+, or a blank HTML file and a weekend lost to CSS. Meanwhile the actual requirement is usually simple — headline, features, a quote, an FAQ, and a signup form — but it still needs to *look* professional, or visitors bounce before they trust the CTA.

LaunchPage Studio collapses that into a 10-minute form-fill: pick a theme, write your copy, wire up a free Formspree endpoint, and export a page that looks like it cost real money.

---

## Revenue models

### 1. Freelance service — "Validate your idea in a day," $50–200 per page
Position yourself (or resell this tool under your own brand) as a same-day landing page service for pre-launch founders. Charge:
- **$50** — template fill-in using one of the 4 presets, client supplies copy
- **$120** — includes copywriting pass on headline/subheadline/features from a client questionnaire
- **$200** — includes copywriting + custom accent/logo treatment + Formspree setup and a Loom walkthrough of how to edit it themselves later

Pitch: "Send me your product idea this morning, get a live, shareable landing page with a working signup form by end of day." Sell it as a de-risking tool for people about to spend months building something nobody wants — the page is a $50–200 gut-check before the $5,000+ MVP.

### 2. Productized offer — "Landing page in 24h," flat-rate subscription-adjacent package
Package it as a fixed-scope, fixed-price productized service (à la Designjoy) rather than open-ended freelancing:
- **$149 flat** per landing page, 24-hour turnaround, 1 revision round, delivered as a downloadable HTML file plus hosting instructions (Netlify drag-and-drop, GitHub Pages, etc.)
- **$399/month "unlimited" retainer** for agencies or serial founders who need a new page every week or two (cap at a reasonable number, e.g. 4/month, to protect margin)
- Upsell: $75 add-on for a matching "thank you" / confirmation page, or a second theme variant for A/B testing

This works because the tool itself does 90% of the labor — margin is high once you've built a fast intake questionnaire that maps directly onto the builder's fields.

### 3. Niche template packs, $19–49 per pack
Since the app already ships 4 themes, sell **downloadable pre-filled starter packs** aimed at specific niches — e.g. "SaaS Waitlist Pack," "Local Restaurant Launch Pack," "Newsletter/Course Creator Pack," "Wedding/Event Pack." Each pack is just a pre-filled export (or a small JSON preset users paste into `localStorage`) with niche-appropriate sample copy, feature card wording, and FAQ content already written — the buyer just swaps in their own product name and hits download.
- **$19** single template pack
- **$49** bundle of 5 packs
- **$99** "commercial license" tier letting a freelancer/agency reuse the packs across unlimited client projects

Distribution: Gumroad or Lemon Squeezy, cross-promoted from the freelance service (every client becomes a template-pack lead) and from indie-maker communities (Indie Hackers, r/SaaS, Twitter/X build-in-public threads).

### First 5 customers plan
1. **Warm network first** — post the tool in 2–3 indie-maker Slack/Discord communities you're already in (Indie Hackers, WIP, a local startup Slack) offering a free landing page build to the first 3 people who reply, in exchange for a testimonial/screenshot you can use to sell the next 10.
2. **Build in public** — tweet/post a before/after (blank idea -> live page in under 10 minutes, screen-recorded) and link a Calendly/DM for the $50 starter tier.
3. **Local business drive-by** — walk into 5 local businesses without a real web presence (food trucks, personal trainers, small event organizers) and offer the $50 tier on the spot as a "get a real webpage today" pitch; local businesses respond well to speed and a fixed price.
4. **Productized landing page for the productized offer** — literally build your own landing page with this tool, wire the signup form to your own Formspree, and use it as the intake form for the "24h" package.
5. **Template-pack seed sales** — once you have 2–3 real client builds, extract the reusable copy patterns into your first template pack and list it on Gumroad same week, cross-linked from your freelance page.

---

## Feature overview

- **Form-driven builder** — product name, logo (stored as a dataURL, no upload server needed), hero headline, subheadline, CTA text.
- **Feature cards** — 3 to 6 cards, each with an emoji icon, title, and description; add, edit, reorder (move up/down), and delete.
- **Social proof** — one quote block with attribution (name + role/company).
- **FAQ** — add/remove question-and-answer pairs, rendered as collapsible `<details>` accordions on export.
- **Footer** — copyright line, contact email, and an arbitrary list of social links.
- **Email capture** — paste a Formspree (or Google Forms) endpoint URL and the exported page POSTs directly to it; leave it blank and the page falls back to a `mailto:` signup button automatically. Inline instructions explain how to get a free Formspree endpoint.
- **4 polished themes** — Bold SaaS Dark, Clean Light, Warm & Friendly, Premium Editorial (serif) — plus a custom accent-color picker with 8 quick swatches or a full color picker.
- **Live preview** with a desktop/mobile toggle, rendered in an iframe via `srcdoc` so it always matches the real export byte-for-byte.
- **One-click export** — "Download page" generates a fully standalone `landing.html` (title/meta description/Open Graph/Twitter Card tags filled from your form) via a `Blob`, ready to drag into Netlify, GitHub Pages, or any static host.
- **Realistic preloaded sample** — a fictional apartment-search product ("Nestled") with real-feeling copy so the app is fully populated and demoable the instant it opens.
- **Local persistence** — every field autosaves to `localStorage`; refreshing the browser never loses work. "Reset sample" restores the demo data; "Start blank" clears everything for a fresh build.

## Known limitations (honest)

- **No image hosting for the logo beyond dataURL.** Large logos bloat the exported HTML file size (the app rejects uploads over 2MB, but a 1.5MB PNG still means a 2MB+ HTML file). Fine for a single-page export; not ideal if you need a tiny page for performance-obsessed use cases.
- **Single-page only** — no multi-page sites, no routing, no blog. This is a landing/waitlist page tool, not a site builder.
- **No built-in analytics** — the exported page has no visit tracking. Users who want conversion data need to add their own snippet (e.g. Plausible, Fathom, or GA) manually to the exported HTML.
- **Email capture depends on a third party** — Formspree's free tier caps monthly submissions (currently 50/month on the free plan); high-signup pages will need a paid Formspree tier or a different backend.
- **No spam protection on the fallback mailto button** — it's a plain `mailto:` link, so there's no CAPTCHA or bot filtering; that protection lives on Formspree's side when a form action is used.
- **No true multi-device/multi-browser sync** — because data lives in `localStorage`, switching browsers or computers means starting over (or re-uploading an exported page and manually re-entering fields). There's no account system or cloud save by design (keeps it a zero-backend, zero-cost tool).
- **One quote, not a full testimonial wall** — intentionally kept simple; sellers who need more social proof will want to hand-edit the exported HTML.
- **Theme customization is accent-color only** — you can't yet adjust fonts, spacing, or layout beyond the 4 presets + accent color without editing the exported HTML/CSS directly.

## Sales pitch

Turn a blank idea into a live, professional, signup-ready landing page in under 10 minutes — no code, no hosting fees, no monthly SaaS bill.
