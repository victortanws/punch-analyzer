# InvoiceForge

A single-file, offline-first invoice generator and mini invoice manager for freelancers and micro-businesses. Open `index.html` in any browser — no install, no account, no server. All data lives in the browser's `localStorage`.

## Target customer

Freelancers, consultants, and micro-agencies (1–5 people) who currently invoice clients using a Word/Google Docs template, a spreadsheet, or a bloated SaaS tool they don't need. Think: freelance designers, developers, copywriters, photographers, tutors, and small consultancies who send somewhere between 2 and 30 invoices a month and don't want a monthly subscription, a login, or their client data sitting on someone else's server.

## The problem

- **Word/Docs templates** drift out of sync (copy-paste errors, wrong totals, forgotten invoice numbers) and don't track what's paid vs. outstanding.
- **Spreadsheets** can compute totals but produce ugly, unprofessional-looking output and have no real "send-ready" document view.
- **SaaS invoicing tools** (FreshBooks, Bonsai, Invoice Ninja Cloud, etc.) charge $15–$40/month for a feature set that's massive overkill for someone sending a handful of invoices — and they require an account, an internet connection, and trust that a third party is storing your client's billing details.
- Nobody wants to relearn a tool or pay a subscription just to make a PDF look professional.

InvoiceForge solves this with a single HTML file: professional live-preview invoices, automatic numbering, multi-currency support, a lightweight status workflow (Draft/Sent/Paid), and a JSON backup you fully own. No server, no tracking, no recurring fee required to use it.

## Feature set

- Dashboard sidebar with all invoices, status badges, and Outstanding/Paid/Draft summary tiles (correctly grouped per currency)
- Full invoice editor: business profile with logo upload (stored as a data URL), client details, auto-incrementing invoice numbers, issue/due dates
- Line items with live-computed line totals, per-invoice tax % and discount %, add/remove rows
- 12 currencies with correct symbols and locale-aware formatting (USD, EUR, GBP, JPY, CAD, AUD, INR, CHF, CNY, MXN, BRL, ZAR)
- Notes / payment terms field rendered directly on the invoice
- Live, professionally styled invoice preview that updates as you type
- Real print stylesheet — "Print / Save PDF" prints (or exports to PDF via the browser's print dialog) only the invoice itself, with all app chrome hidden
- Draft → Sent → Paid status workflow, plus one-click invoice duplication
- Full JSON export/import for backup, migration, or moving to a new machine
- 3 realistic preloaded sample invoices (a freelance design studio billing three different clients in USD and EUR) so it demos instantly

## Revenue models

**1. One-time purchase on Gumroad or Lemon Squeezy — $29**
Sell the single HTML file as a downloadable product. No hosting cost, no ongoing support burden beyond bug fixes. This is the simplest model: buyer downloads a zip, opens `index.html`, done. Positioning: "Invoicing software you own, not rent." Gumroad/Lemon Squeezy handle payment, VAT/sales tax, and delivery, taking roughly 5–10% per sale. At $29 with even modest volume (50 sales/month) this is ~$1,450/month before platform fees, for effectively zero marginal cost per sale.

**2. Free-with-watermark → paid unlock — $19 one-time**
Ship a version where the printed/exported invoice includes a small "Created with InvoiceForge" footer watermark unless a license key is entered (a client-side check against a simple key format, stored in localStorage — not bulletproof, but sufficient friction for this price point and audience). The free version is a genuine lead magnet: people use it, like it, and pay $19 to remove the watermark for client-facing documents. Distribute the free version widely (Product Hunt, r/freelance, indie hacker directories); conversion-optimize the "remove watermark" CTA inside the app itself.

**3. White-label licensing to bookkeepers and agencies — $199–$499 one-time per brand, or $49/month for multi-client bundles**
Bookkeeping firms, virtual assistant agencies, and small accounting practices often want to hand clients a simple invoicing tool under their own brand. Sell a rebrandable version (swap logo/colors/footer text, remove "InvoiceForge" attribution) as a higher-ticket one-time license, or a small recurring fee if you're maintaining custom builds for multiple firms. This is the highest-margin tier since it targets buyers who bill the tool onward to their own clients and can justify a much higher price than a solo freelancer would pay.

## First 5 customers plan

1. **Personal network seed**: Post in 2–3 freelancer-focused communities you're already a credible member of (a Slack/Discord for freelance devs/designers, a local freelancers' meetup group chat) with a direct link and a "here's a problem I built this for" framing, not a sales pitch. Goal: first 2–3 sales from people who already trust your judgment.
2. **r/freelance, r/smallbusiness, Indie Hackers**: One well-written post (not an ad) describing the specific pain — "spreadsheet invoices vs. a $30/month SaaS I didn't need" — with a link to a live demo (host `index.html` for free on GitHub Pages/Netlify as a "try before you buy" demo, since it needs no backend). Goal: 1–2 sales plus qualitative feedback on missing features.
3. **Direct outreach to 10 freelancers you can identify by name** (via Twitter/X, LinkedIn, or portfolio sites) who visibly do client billing — offer the first 5 people who reply a free license in exchange for a testimonial or a public post. Goal: social proof to put on the landing page before charging anyone else full price.
4. **Gumroad/Lemon Squeezy discovery**: List it properly tagged (invoicing, freelance tools, small business) — some organic traffic comes from marketplace search with zero additional effort.
5. **"Built in public" post**: A short write-up (dev.to, Hacker News "Show HN", or a tweet thread) about building a commercial micro-app as a single HTML file with no backend — this appeals to a developer audience who may buy it themselves or pass it to a freelancer friend, and it's a distinct angle from generic invoicing-tool marketing.

## Honest limitations

- **No cloud sync or multi-device access.** Data lives in one browser's localStorage on one machine. Switching browsers, computers, or clearing browser data loses everything unless the user has exported a JSON backup. This is explicitly a local-first tool, not a hosted SaaS — that's the pitch, but it's also a real constraint worth stating up front.
- **No multi-user collaboration.** One person, one browser, one dataset. Not suitable for a team that needs shared visibility into invoices.
- **No real payment processing or online payment links.** This generates and tracks invoices; it does not collect card payments, integrate with Stripe/PayPal, or send emails. "Sent" and "Paid" are manually-set statuses, not verified events.
- **No email sending.** The user must download/print the PDF and send it themselves via their own email client.
- **localStorage has practical size limits** (typically 5–10MB per origin depending on browser). Because logos are stored as base64 data URLs directly in this storage, a user who uploads several large, high-resolution logo images across many invoices could theoretically approach that ceiling. Using one reasonably compressed logo (which is the realistic use case — the same logo across all invoices) avoids this in practice.
- **The free-with-watermark license check (if that model is used) is a client-side gate**, not a hardened DRM system — a technically motivated user could remove it by editing the file. This is an accepted tradeoff at this price point, not a defect to be "fixed" with more engineering than the product justifies.
- **No built-in tax compliance logic** (VAT ID validation, jurisdiction-specific tax rules, e-invoicing standards like Peppol/ZUGFeRD). The tax field is a flat percentage the user sets manually — appropriate for simple use cases, not for businesses with complex multi-jurisdiction tax obligations.
- **No audit trail or edit history.** Editing an already-"Sent" or "Paid" invoice silently changes it with no record of the prior version — fine for a solo freelancer, not appropriate for anyone needing an immutable financial record.
