# CertMaker

A single-file, no-signup certificate generator for trainers, course creators, and small schools who need to hand out professional-looking completion certificates in bulk without touching Photoshop, Canva, or a mail-merge template.

Open `index.html` directly in any modern browser (double-click it, or `file://` it) — there is no server, no build step, and no account. Everything is saved to `localStorage` on the device it's opened on.

---

## The problem

Anyone running a cohort-based course, a bootcamp, a martial arts / fitness academy, a corporate training program, or a weekend workshop eventually hits the same annoying task: **50 students finished the course and each one needs a certificate with their name on it, today.**

The realistic alternatives right now are all bad:
- **Canva/Google Slides one-by-one** — works for 1 certificate, is miserable for 30+, and there's no real "bulk" mode without a paid Canva plan and a CSV merge app.
- **Word mail merge** — technically works, but requires Word, a spreadsheet, format wrangling, and produces certificates that look like 2005.
- **Hiring a designer** — costs more than the whole cohort's course fee and takes days.
- **Dedicated certificate SaaS tools** — usually subscription-only, require an account and uploading your student list to a third party, and are overkill for someone who runs 2 cohorts a year.

CertMaker exists for the person who wants: paste a list of names, pick a theme that doesn't look like clip art, hit print, done — in under five minutes, with zero recurring cost and zero data leaving their machine.

---

## Who it's for

- Independent trainers, coaches, and instructors (fitness, martial arts, music, language, tech bootcamps)
- Course creators running cohort-based cohorts (Maven/Teachable/Kajabi-style courses)
- Small schools, academies, and training centers without a design department
- Corporate L&D / HR teams issuing internal training completion certificates
- Freelancers and agencies who get one-off "make us 40 certificates" requests

---

## Revenue models

### 1. $19 one-time purchase (primary — direct to trainers/bootcamps)
Sell `index.html` as a downloadable product on Gumroad or Lemon Squeezy. Positioning: "Stop paying $30/month for a certificate generator you use twice a year." Because it's a single file with no server costs, this is close to pure margin after the platform's cut (~5-9%). Target: 20 sales/month = ~$350-380 net is a realistic early goal; the product supports much higher volume since there's no fulfillment cost per sale.

- Distribution: Gumroad/Lemon Squeezy listing, plus a "Certificate Maker for Trainers" landing page targeting SEO terms like "bulk certificate generator," "certificate template for course completion," "print certificates for students."
- Upsell: a $9 "extra themes pack" or a $5 "custom brand color" add-on later, once there's a customer base to survey for what they actually want.

### 2. Done-for-you bulk certificate gigs on Fiverr/Upwork ($10-30 per batch)
Many small course creators and event organizers don't want to touch a tool at all — they want to email you a name list and a logo and get back a ZIP of print-ready PDFs. This app is the internal production tool for that gig, not the product itself.

- List the gig as "I will design and generate bulk certificates for your course/event" at $10 (up to 10 recipients) / $20 (up to 50) / $30 (unlimited + rush delivery).
- Turnaround is minutes per batch once the theme is set, so this is high-margin freelance work — the bottleneck is customer acquisition, not production time.
- Natural upsell path: gig customers who like the output become $19 self-serve customers for their next cohort.

### 3. Site license for schools/academies ($99 flat)
A single school or academy often runs many instructors/cohorts per year and doesn't want to buy 5 separate $19 licenses or manage sharing one file around. Offer a $99 one-time "site license": unlimited internal use across the organization, priority email support for setup questions, and permission to customize/rebrand the file freely.

- Sell directly to franchise-style academies (boxing gyms, dance studios, driving schools, language schools) via cold email to owners/operators — this is a B2B one-time sale with a clear, easy-to-justify price point (less than one hour of an admin's time spent formatting certificates manually).
- Add a lightweight "verify certificate" note in the README/product page for schools that care about credibility (see Limitations — this app does not include real verification, so don't oversell it).

---

## First 5 customers plan

1. **Your own network first.** Post in 2-3 Facebook/Discord/Reddit communities for the niches you can access directly (boxing gyms, coding bootcamp instructors, yoga teacher training programs, Teachable/Kajabi creator groups). Offer the tool free to the first 5 people who reply in exchange for a testimonial/screenshot of their finished certificate — this seeds real "used by real trainers" proof before charging.
2. **Direct outreach to 20 micro-academies.** Search Google Maps / Instagram for local boxing gyms, driving schools, and dance studios (the same categories CertMaker's sample data targets). Send a short DM/email: "I built a tool that turns a name list into 50 print-ready certificates in 2 minutes — want a free one for your next graduating class?" Convert the ones who respond well into the first paid $19 sales or $99 site license conversations.
3. **One Fiverr gig live from day one.** List the done-for-you gig immediately — it requires no marketing spend, Fiverr provides its own search traffic, and it validates whether people will pay for this before you spend time on ads for the self-serve product.
4. **Cohort-completion timing.** Course creators need certificates at a specific moment (the last week of a cohort). Find 5 upcoming cohort-completion dates on Teachable/Maven's public course pages and reach out 1-2 weeks ahead of their end date — this is the exact moment the problem is acute and willingness to pay is highest.
5. **Ask every customer for one referral.** At $19 there's no room for paid acquisition per customer, so the first 5 sales should each end with "know another trainer who'll need this for their next cohort?" — training/course communities are small and word travels fast.

---

## Feature overview

- **Designer panel** — certificate title, organization name, logo upload (stored as a data URL, no server), achievement/course text with an optional `{name}` inline token, date, and one or two signature blocks (name + role each).
- **4 distinct themes** — Classic Gold (cream + double gold border, serif), Modern Minimal (white, thin sidebar accent, sans-serif), Elegant Navy (deep navy gradient + gold trim, serif), Playful Education (warm dashed border, rounded corners, playful palette). Each theme changes layout details, not just color.
- **Recipients** — single-name mode for one-off certificates, or bulk mode: paste one name per line, optionally `Name, extra detail` (detail renders as an italic subline, e.g. "With Distinction").
- **Paginated preview** — prev/next navigation with a live count indicator, plus a theme preview dropdown that lets you browse other themes without changing your saved design.
- **Print** — "Print This One" for a single certificate, "Print All" for the full batch. Print CSS forces landscape orientation via `@page` and exactly one certificate per printed page via `page-break-after`, regardless of how many recipients are loaded.
- **Template persistence** — every field autosaves to `localStorage` as you type; "Save Template" gives an explicit confirmation, "Reset Sample" restores the original demo data.
- **Instant demo** — preloaded with a realistic sample: "Boxing Fundamentals Course" from Ironclad Boxing Academy, 5 sample recipients, both signature lines filled in, so the app is fully demoable the moment it's opened.

---

## Honest limitations

- **No real certificate verification.** There's no unique ID, QR code, or lookup registry — this produces a nice-looking PDF/printout, not a tamper-proof credential. Don't market it as suitable for anything requiring fraud-proof verification (e.g., professional licensing).
- **Data lives in one browser.** Templates and recipient lists are saved via `localStorage` on a single device/browser profile. There is no cloud sync, no login, and no way to share a saved template between two computers except manually re-entering the data (or copying the browser's localStorage, which isn't exposed in the UI).
- **PDF export is print-driven.** "Save as PDF" works through the browser's native print dialog ("Print All" → destination: Save as PDF), not a built-in PDF export button. This is reliable in all modern browsers but is an extra click compared to a one-button PDF download.
- **Logo size affects storage.** Logos are embedded as base64 data URLs; very large image files will bloat `localStorage` and can eventually hit the browser's storage quota (typically 5-10MB). A warning is shown for large uploads, but there's no automatic image compression.
- **Bulk parsing is comma-based.** Names or details containing a comma inside the name itself (rare, but possible with some formatting) will be split at the first comma — this covers the vast majority of real name lists but isn't a full CSV parser.
- **No multi-language layout testing.** Fonts and spacing are tuned for Latin-script names; very long names or non-Latin scripts may wrap or overflow the certificate in ways that weren't specifically tested.
- **Single-file trade-off.** Because everything (including all 4 themes) ships in one HTML file for the "just open it" promise, the file is larger than a typical multi-file web app. This has no real performance impact for local use but is worth knowing if you plan to extend it significantly.

---

## Tech notes (for whoever maintains this)

- Zero dependencies, zero build step, no external requests. Pure HTML/CSS/JS.
- Print layout uses `@page { size: landscape; margin: 0; }` plus a hidden `#printArea` that's only populated (and made visible via `@media print`) right before `window.print()` is called, then cleared on `afterprint`.
- All user-supplied text is HTML-escaped before being injected into the certificate markup to avoid any HTML/script injection via names or free-text fields.
