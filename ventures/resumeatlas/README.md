# ResumeAtlas

A single-file, ATS-friendly resume builder. Open `index.html` in any browser — no install, no account, no server. Everything is saved to `localStorage` on the device, with JSON export/import for backup and portability.

## Target customer

Two distinct buyers:

1. **Active job seekers**, especially mid-career professionals (5–15 years experience) applying to mid-size and large companies whose postings run through an Applicant Tracking System (Workday, Greenhouse, Taleo, iCIMS, etc.). These people are anxious about their resume being auto-rejected by software before a human ever sees it, and they don't trust that their current Word/Canva/Google Docs resume is "ATS-safe."
2. **Resume-writing freelancers and career coaches** (Fiverr/Upwork sellers, LinkedIn "resume doctors," outplacement coaches) who write resumes for clients repeatedly and want a fast, reliable, on-brand production tool instead of reformatting Word documents by hand for every client.

## The problem

- Most people don't know that fancy resume templates (multi-column layouts, text boxes, icons, tables, graphics) actively break ATS parsing — fields get scrambled, sections get dropped, and the applicant is silently filtered out with no feedback.
- Free resume builders online are either (a) full of dark patterns that lock the PDF download behind a paywall after the user has already invested 20 minutes of data entry, or (b) template-first tools that produce ATS-unsafe designs because they're optimized to look good on Pinterest, not to parse cleanly.
- People lose resume drafts because they were only stored in one cloud account, one Word file on one machine, or inside a tool that shut down.
- Freelance resume writers currently rebuild client resumes from scratch in Word/Canva for every project, which is slow and inconsistent from client to client.

ResumeAtlas solves this with: templates that are provably single-column and table-free, an always-visible live preview so users can see exactly what they're building, real print CSS so "Save as PDF" produces a clean paginated document (not a screenshot), and local-only storage plus JSON export so nothing is ever locked in.

## Revenue models

### 1. Freemium template unlock — $19 one-time
The **Classic** template is free forever (fully functional: live preview, autosave, JSON export, printing). **Modern** and **Compact** templates, plus the full accent-color picker, are gated behind a one-time $19 unlock. This is implemented as a simple client-side licensing checkpoint in a real deployment (e.g., a license key entered after Stripe/Gumroad checkout that flips a `localStorage` flag) — the current build ships all three templates unlocked as a demo; gating is a ~30-minute follow-up task before charging real customers. One-time pricing (vs. subscription) fits the "I need a resume for the next 2 months of job hunting" usage pattern and avoids the churn-management overhead of a subscription for a tool this narrow.

*Why $19*: cheap enough to be an impulse buy next to a $0 alternative, expensive enough to filter for people who are seriously job-hunting (not just browsing). Comparable tools charge $2.95/week (subscription trap) or $25–40 one-time; $19 undercuts on a one-time basis.

### 2. Backend tooling for Fiverr/Upwork resume-writing gigs
Freelance resume writers charge clients $50–250 per resume on Fiverr/Upwork but do the formatting by hand in Word every time. Package ResumeAtlas as the writer's internal production tool:
- Writer collects the client's raw experience via a call/questionnaire, types it into ResumeAtlas, picks a template and the client's brand color, exports a polished PDF in minutes instead of hours.
- Sell this angle directly to freelance resume writers as a $39 "agency license" (a rebrand of the same $19 unlock at a higher tier, framed as "make client resumes 3x faster") — the pitch is time saved per gig, not features.
- Because the tool is a single static file, a writer can put it on a USB stick or a private Dropbox link and use it fully offline with clients who are privacy-conscious about their data touching a server.

### 3. White-label for career coaches and coaching platforms — $99/site license
Career coaches, university career centers, and outplacement firms want to hand students/clients a branded tool rather than pointing them at a generic public site. Sell a $99 white-label license that includes:
- The same `index.html`, re-skinned with the coach's/institution's logo and color palette (swap the `.brand` block and `--accent` default in the `<style>` block — no build step required).
- Permission to host it on the coach's own domain or LMS and hand it out to unlimited students/clients under that single license.
- Positioned as a one-time fee per coach/institution (not per student), which is an easy line item for a coaching business or career-services budget to approve versus a recurring SaaS contract.

### Suggested rollout order
Start with model 1 (freemium unlock) to validate that strangers will pay for this at all with minimal sales effort, then layer in models 2 and 3 as outbound plays once there's a working payment flow and a few testimonials.

## First 5 customers plan

1. **Personal network seeding.** Post the free Classic template link in 2–3 job-search-focused subreddits (r/resumes, r/jobs) and a local job-seekers Facebook/LinkedIn group, framed as "I built a free ATS-safe resume builder, no signup" — the goal is feedback and first real users, not revenue yet.
2. **r/forhire and Fiverr forum outreach.** Directly message 10–15 active Fiverr/Upwork resume-writing sellers (searchable by gig category) offering the "agency license" free for 30 days in exchange for a testimonial and permission to be listed as a case study. Freelancers who say yes are customers 1–3.
3. **One local career center or bootcamp.** Reach out to a coding bootcamp's or university career center's career-services team (these are easy to find on LinkedIn) with the white-label pitch; a single $99 sale here is customer 4 and gives a credible "used by X program" logo for marketing.
4. **Direct ask in a resume-help Discord/Slack.** Career-change and layoff-support communities (there are several active Discords for tech layoffs) are full of people actively job hunting right now; a helpful, non-spammy post offering the free tier plus a discount code for the $19 unlock converts customer 5.
5. **Collect testimonials at every step** and fold them into the landing/sales copy before any paid acquisition (ads, SEO) — first 5 customers should be relationship-driven, not ad-driven, since the total addressable spend on ads doesn't make sense until conversion rate from free-to-paid is validated.

## Honest limitations

- **No true ATS simulation.** The app follows well-known ATS-safe formatting rules (single-column, no tables/graphics, standard headings) but cannot actually run a resume through Workday/Taleo/iCIMS to verify parsing. "ATS-friendly" is a design constraint here, not a tested guarantee.
- **No cloud sync or multi-device editing.** Data lives in one browser's `localStorage` on one device. Switching browsers, using private/incognito mode, or clearing browser data loses the resume unless the user has exported a JSON backup first. This is disclosed in-app but is a real limitation versus account-based competitors.
- **No spell-check, grammar help, or AI content generation.** This is a formatting and structuring tool, not a writing assistant — users still have to write their own bullet points.
- **Payment/licensing is not wired up.** The monetization plan above (template gating, license keys) describes the intended commercial structure, but this deliverable ships as a fully-unlocked demo; a real checkout integration (Stripe/Gumroad) and a license-check gate are follow-up engineering work before charging customers.
- **Print fidelity depends on the browser's print engine.** The app supplies correct `@page`/`break-inside` CSS, but exact PDF output (font substitution, margins) can vary slightly between Chrome, Firefox, and Safari print-to-PDF implementations.
- **Single-page assumption.** The print stylesheet paginates gracefully across multiple pages if content is long, but the app doesn't warn users when a resume has grown past the commonly-recommended 1–2 page length for their experience level.
- **No accessibility audit performed.** Basic semantic HTML and focus states are in place, but a full WCAG pass (screen-reader flow through the live-editing form, ARIA live regions for autosave status, etc.) has not been done.
