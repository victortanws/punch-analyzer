# BioLink Studio

A self-contained link-in-bio page builder — the Linktree alternative your customer owns outright, with no monthly fee, no vendor lock-in, and no account required.

Open `index.html` directly in any browser (including via `file://`, no server needed) to launch the editor. Everything is one file: vanilla HTML/CSS/JS, zero dependencies, zero build step.

---

## What it does

- **Profile editor** — photo upload (stored as a dataURL, no server), display name, bio.
- **Links manager** — title, URL, optional emoji icon, one link can be marked "highlight" for visual emphasis. Add, edit, delete, and reorder with up/down controls.
- **Social row** — Instagram, TikTok, YouTube, X, WhatsApp, email, each with inline SVG icons (no icon fonts, no CDN). A social only appears on the page if its field is filled in.
- **Themes** — 4 presets (Minimal Light, Dark Neon, Soft Gradient, Editorial Serif) plus a custom solid/gradient background picker and 3 button shapes (rounded, pill, square).
- **Live phone-frame preview** that updates instantly as you type.
- **One-click export** — "Download my page" generates a fully standalone `bio.html` via Blob download. The profile photo, all styles, and every link are inlined into that single file — drop it on any static host (Netlify, GitHub Pages, Cloudflare Pages, a client's existing web host) and it just works.
- Preloaded with a realistic sample profile (a fitness coach) so it demos itself in one click, no empty-canvas awkwardness.
- All edits persist to `localStorage` — refreshing the browser never loses work.

---

## Target customer

Creators, coaches, freelancers, and local businesses who currently pay Linktree/Beacons/Milkshake a recurring fee for something that is, structurally, a static page. Specifically:

- **Micro-influencers and content creators** (fitness coaches, artists, musicians) who need one link for their Instagram/TikTok bio but don't want an ongoing subscription.
- **Local service businesses** (hair stylists, personal trainers, photographers, tutors) who want a clean "all my info in one tap" page and currently have nothing, or are using a clunky free-tier link tool plastered with someone else's branding.
- **Freelancers/consultants** who want a lightweight personal landing page without hiring a web developer.

The buyer of this *tool* (you, or whoever you resell it to) is a freelance designer, VA, or productized-service seller who wants to offer "I'll build you a bio-link page" as a fast, repeatable, high-margin gig.

## The problem

Linktree, Beacons, and similar tools charge $5–25/month forever for a page that, once built, never needs a live backend — it's a profile, a handful of links, and some styling. Customers are paying rent on something that could be a one-time purchase. They also:
- Get the tool's branding/upsells baked into free tiers.
- Depend on a third party staying in business and not changing pricing.
- Have limited creative control over themes vs. what a custom-built page can offer.

BioLink Studio flips the model: build the page once in the browser, hand over (or host) a static HTML file the customer owns forever. No subscription, no dependency, no lock-in — which is the entire pitch when selling against Linktree.

---

## Revenue models

**1. One-time page setup — $25–75 per client**
Interview the client (or use their existing Instagram bio + links), build their page in 15–30 minutes using the live editor, export `bio.html`, and deliver it. Charge $25 for a simple single-theme page, $50–75 for a page with custom brand colors, a custom photo treatment, and copywriting help on the bio text. This is the core offer — no monthly fee is explicitly the selling point vs. Linktree, and it's what you lead with in outreach.

**2. Custom theme packs — $15–30 per pack, or bundled into setup**
Design 3–5 extra on-brand theme presets beyond the 4 built in (e.g., a "streetwear," "wedding photographer," "real estate agent" pack) and sell them as an upsell add-on, or package 10 niche-specific themes as a one-time $49 "Theme Pack" digital product sold independently of any one client engagement. Because everything is CSS/HTML, new themes are cheap to produce and infinitely resellable.

**3. Hosting + updates retainer — $10–20/month (optional, not required)**
Some clients don't want to touch a text editor or upload a file to Netlify themselves. Offer an optional retainer: you host their `bio.html` on a subdomain you control, and handle link swaps/edits for them (e.g., 2 update requests/month). This is positioned as *optional convenience*, not a requirement to use the page — which keeps the "no monthly fee required" pitch honest and preserves the core differentiation from Linktree.

Realistic blended math: 10 setup sales/month at $45 average = $450, plus 3 clients on a $15/mo retainer = $45/mo recurring, plus occasional $49 theme pack sales. This is a nights-and-weekends income stream for a freelancer, not a venture-scale business — priced and scoped accordingly.

---

## First 5 customers plan

1. **Your own network first.** Post the exported sample page (rebrand it with your own name/services) in your Instagram/Twitter bio for a week. When people ask "how did you make that," you have your first pitch already proven.
2. **Local business Facebook/Nextdoor groups.** Offer 1 free page to a local business you know (hairdresser, personal trainer, food truck) in exchange for a testimonial and permission to use it as a portfolio piece. This is your case study.
3. **Direct outreach to 20 micro-creators** (2k–20k followers) who currently link to a free-tier Linktree with ads/upsells visible. DM them: "Saw you're using Linktree — I build the same thing as a page you own forever, no monthly fee, $35 flat." Expect a 5–10% response rate; target 2 conversions.
4. **Fiverr/Upwork gig listing.** List "Custom link-in-bio page, no subscription, $39" as a productized gig. This captures inbound demand from people already searching for exactly this.
5. **Referral nudge.** For every client, ask for one warm referral in exchange for $10 off their next update or a free theme swap. Word-of-mouth is disproportionately effective for a visual, shareable product like this.

Goal: 5 paying customers in the first 2–3 weeks, validating the $25–75 price band before investing in a nicer sales page or paid ads.

---

## Honest limitations

- **No backend, no analytics.** There's no click tracking, no A/B testing, and no way to update the live page remotely once exported — editing means reopening the builder and re-exporting. This is a feature for the "you own it outright" pitch but a real limitation vs. Linktree Pro's analytics dashboard.
- **Photo storage is a dataURL embedded in the HTML.** Great for portability (one file, no broken image links), but large/high-res photos will bloat the exported file size. Recommend clients use a compressed, square photo under ~300KB.
- **No custom domain handling built in.** The exported file is just HTML — connecting it to a custom domain (vs. a subdirectory of an existing site) is a manual hosting step the customer or reseller has to do themselves (or is the value-add of the retainer tier).
- **No form/lead-capture, no e-commerce.** It's a links page, not a website builder — don't oversell it as a replacement for a full site if the client needs email capture, checkout, or booking widgets embedded (though it can *link out* to Calendly, Stripe payment links, etc.).
- **LocalStorage-only editing state.** The builder itself remembers your in-progress edits per-browser via localStorage; it is not synced across devices and has no login. If you clear browser storage or switch computers mid-project, you'll need to re-enter data (export often once a client's page is finalized).
- **Manual updates only.** Any change to links/theme after handoff requires re-opening `index.html`, editing, and re-exporting/re-uploading — there's no live-editing of an already-hosted page without repeating this loop (this is exactly what the optional retainer tier monetizes).
