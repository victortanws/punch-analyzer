# MacroCoach

A white-label macro & calorie calculator that fitness coaches brand as their own and hand to clients as a professional nutrition intake tool and printable handout.

Single file, zero dependencies: `index.html` opens directly via `file://`, no server, no build step, no external network calls. All data is stored in the browser's `localStorage`.

## The problem

Every online coach, personal trainer, and gym eventually needs to give a new client a calorie and macro target. Today they either:

- Manually calculate BMR/TDEE in a spreadsheet (slow, error-prone, looks unprofessional in a sales conversation), or
- Send clients to a generic public calculator (IIFYM, calculator.net, etc.) that is covered in ads, has *someone else's* branding, and does nothing to reinforce the coach's own brand or capture the lead for the coach's business, or
- Pay $30-100+/month for a full coaching-app platform (Trainerize, TrueCoach, etc.) just to get a macro calculator bundled inside far more machinery than a solo coach or small gym needs.

Coaches — especially in combat sports/boxing gyms, where nutrition is often bolted on informally by a coach who isn't a dietitian — need a fast, credible, on-brand way to hand a client real numbers in the first session, without a subscription or a website build.

## Target customer

- Independent personal trainers and online coaches (1-1 or small group coaching)
- Boxing/MMA/combat-sports gyms and strength & conditioning coaches who program nutrition alongside training
- Small gyms/studios that want a lead magnet on their website ("Get your free macro plan")
- Nutrition-adjacent coaches who are not registered dietitians and need a clear, liability-conscious disclaimer baked into every handout

## What it does

1. **Coach branding** — business name, logo (uploaded as a local file, stored as a dataURL), accent color, and a contact line. Applied consistently across the live app and the printed handout.
2. **Client inputs** — age, sex, height/weight with a metric/imperial toggle, 5-tier activity level with plain-language descriptions, and a goal (cut/maintain/bulk) with selectable weekly rate.
3. **Transparent math** — Mifflin-St Jeor BMR → activity-adjusted TDEE → goal-adjusted calorie target, with every step of the calculation shown, not just the final number.
4. **Macro split** — Balanced (30/40/30), Low-Carb (40/25/35), and High-Protein (40/30/30) presets (protein/carbs/fat), or fully custom sliders with auto-balance to guarantee the split always totals 100%. Results shown in grams, kcal, and protein g/kg bodyweight.
5. **Per-meal breakdown** — daily targets divided evenly across 2-6 meals/day.
6. **Printable handout** — a clean, branded one-pager (client stats, target, macro table, meal table, coach contact, and a medical disclaimer) generated via real print CSS and `window.print()`, with all app chrome hidden.
7. **Client roster** — save, reopen, re-print, and delete multiple clients, all persisted locally so nothing is lost on refresh.
8. **Instant demo** — ships with a realistic preloaded sample client ("Jordan Reyes") so a coach can see the full flow in seconds.

## Revenue models

1. **$49 one-time white-label license per coach.** The coach downloads/receives the single HTML file, drops in their logo/colors/contact info once, and it's theirs — "their brand, their clients." No recurring hosting cost to you, so it's a clean one-time sale with high margin. Upsell: $79 "does it for you" tier where you brand it for them.
2. **Lead-magnet embed on the coach's own site.** Package it as a "Free Macro Calculator" page/embed that coaches install on their own coaching website or link-in-bio. Every client who runs their numbers is a captured warm lead the coach can follow up with to sell a paid program — position this as a $99-149 "embed + setup" service, or bundle it free with a coaching-website package to close a bigger sale.
3. **Bundled into online-coaching onboarding.** Sell it as an add-on inside a broader "coach starter kit" ($199-299) alongside other white-label tools (invoicing, round timer, QR menu, etc. from the same product family) — the calculator becomes the first deliverable a new client receives, which makes onboarding feel instantly more professional and justifies premium program pricing.

## First 5 customers plan

1. **Owner's own network first.** The founder already has a boxing/combat-sports audience — DM 10-15 boxing/MMA coaches and strength coaches directly with a live demo link and a "here's what your clients would see with your logo on it" pitch. Target: 2-3 sales from warm contacts.
2. **Post in 2-3 coaching Facebook groups / subreddits** (r/personaltraining, online fitness coach communities) with a short demo video/GIF of the branding flow + print handout, framed as "I built a tool so you stop doing macros in a spreadsheet."
3. **Cold outreach to 20 local gyms/studios** via Instagram DM with a 30-second Loom showing their (mocked-up) logo already applied — personalization at the point of first contact converts far better than a generic pitch.
4. **Offer the first 5 buyers a discounted founding price** (e.g. $29 instead of $49) in exchange for a testimonial/screenshot of their branded version in use — social proof is the biggest lever for sales #6 onward.
5. **List it on one micro-SaaS/indie-tool marketplace or directory** (e.g. a Gumroad page, a fitness-tools directory, or a boxing-coach forum) to capture inbound search traffic from coaches actively looking for exactly this.

## Known limitations (honest)

- **Not medical advice.** Calorie and macro targets are estimates from a standard predictive formula (Mifflin-St Jeor) applied to self-reported inputs. They do not account for individual medical conditions, medications, disordered eating history, pregnancy, or clinical nutrition needs. Every handout and the app footer say this explicitly — coaches should say it out loud too.
- **No user accounts or cloud sync.** All data lives in one browser's `localStorage`. Clearing browser data, switching browsers/devices, or using a private/incognito window will lose saved clients. Use "Export data" periodically as a manual backup.
- **Single-device by design.** There is no server, so a coach's client roster does not sync between their laptop and phone. For a solo coach doing 1-1 work this is rarely an issue in practice, but it should be set expectations correctly.
- **Logo storage is local only.** Uploaded logos are stored as base64 dataURLs in `localStorage`, capped at 2MB per file — large or many logos can approach browser storage limits over time.
- **Formulas are estimates, not lab measurements.** Mifflin-St Jeor is one of several validated predictive equations; it does not measure actual metabolic rate (which requires indirect calorimetry) and can be meaningfully off for individuals with atypical body composition (e.g. very high muscle mass or very high body fat).
- **No print-to-PDF automation.** "Print / Save as PDF" relies on the browser's native print dialog (choose "Save as PDF" as the destination) rather than generating a PDF file directly — this keeps the app dependency-free but adds one manual step for the coach.

## Files

- `index.html` — the entire application (structure, styles, and logic in one file).
- `README.md` — this file.
