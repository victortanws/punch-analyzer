# RoundTimer Pro

A gym-wall round timer for boxing, MMA, and HIIT training. One HTML file, zero
dependencies, zero setup — open it and it works, on a phone propped on a rack,
a wall-mounted tablet, or a laptop on the ring apron.

## Target customer

- **Independent boxing/MMA gyms and home-garage gym owners** who currently run
  rounds off a phone stopwatch, a $30 plastic interval timer, or someone
  yelling "time" from the corner. They don't want a subscription app, an
  account, or an internet connection that might drop mid-class.
- **Personal trainers and combat-sports coaches** running small-group HIIT or
  bag-work classes who want a big, legible, color-coded display the whole
  room can see without staring at a phone.
- **Home users** doing solo bag work, shadowboxing, or Tabata-style
  conditioning who want bell cues without buying a $150 dedicated boxing
  timer clock.
- **Content audience of the existing punch-analyzer tool** — the same
  combat-sports enthusiasts already using a punch-tracking tool are a near
  perfect fit for a companion round timer; the audiences overlap almost
  entirely.

## The problem

Commercial boxing round timers (wall-mounted LED units) cost $150–400 and are
bolted-on hardware. Phone stopwatch apps don't do phase-based round/rest
cycling, don't have bell tones, and force someone to hover over the screen.
Generic "interval timer" apps on the App Store are cluttered, ad-supported,
require accounts, or don't work offline. Nobody wants to tap "add 3 minutes,
add 1 minute, repeat 12 times" by hand before every class.

RoundTimer Pro solves this with: one-tap presets for the four most common
training formats, a full-screen color-coded display readable from across a
gym floor, synthesized bell/beep audio cues (no files to load, works offline),
a screen wake lock so the display doesn't dim mid-round, and a persisted
session log so a coach can see what got done.

## Revenue models

1. **Gym licensing ($99–199 per location, one-time or annual renewal).**
   Package the HTML file with the gym's logo colors swapped into the CSS
   variables (a 10-minute customization job), deliver it as a branded
   "[Gym Name] Round Timer" file they run on a wall-mounted tablet or old
   laptop in kiosk mode. $99 for a single-location one-time license, $149 for
   a version with their logo/name embedded in the header, $199/year if they
   want ongoing tweaks (new presets, seasonal color themes, priority support).
   Pitch to gym owners directly via Instagram/local outreach — this is a
   one-time sale per gym, not a recurring SaaS relationship, which makes it an
   easy "yes" for a small business owner who hates subscriptions.

2. **Freemium PWA with a one-time "Pro Unlock" ($4.99–9.99).** Wrap this same
   HTML as an installable PWA (add a manifest + service worker for offline
   caching — a small addition on top of what's here). Free tier: Boxing, MMA,
   Tabata, Heavy Bag presets, basic timer. Pro unlock (one IAP or Stripe
   Payment Link, no backend needed): unlimited custom presets, session
   history export, additional color themes, and gym-logo customization. This
   monetizes the solo/home-user segment that will never buy a gym license.

3. **Bundled companion product for the punch-analyzer audience ($9–15 as a
   bundle add-on, or free with punch-analyzer Pro as a retention hook).**
   Since the same owner already has an audience for a punch-counting/analysis
   tool, RoundTimer Pro is a natural "use this timer for your bag work, then
   analyze the session with punch-analyzer" cross-sell. Offer it free to
   punch-analyzer's existing paying users to increase perceived value and
   reduce churn, and sell it standalone to the rest of the combat-sports
   content audience (YouTube/TikTok boxing creators, gym owners who follow
   the same content) via a simple landing page + Gumroad/Stripe link.

## First 5 customers plan

1. **The user's own gym contacts / local network** — ask 2–3 local
   boxing/MMA gyms (in person or via the combat-sports content audience) to
   trial it for free for two weeks on their wall tablet in exchange for a
   testimonial and logo photo for the sales page.
2. **Punch-analyzer's existing user base** — email or in-app announce it to
   current punch-analyzer users as a free companion tool; convert the most
   engaged ones into $99 gym-license customers if they run/coach at a gym.
3. **r/amateur_boxing, r/MMA, r/Boxing, r/hiit and local Facebook
   gym-owner groups** — a short demo video (phone camera pointed at a gym
   wall running the timer) posted natively, not as a link-drop, with the
   file offered free to the first 10 commenters in exchange for feedback.
4. **Direct outreach to boxing/kickboxing gym owners on Instagram** — most
   independent gyms post class schedules and equipment on IG; a cold DM with
   a 15-second demo clip and a $99 one-time price is a low-friction ask
   compared to a SaaS pitch.
5. **A dedicated micro-landing page with a Stripe Payment Link** — no backend
   required; sell the branded PWA unlock or gym license directly, driven by
   the content/social posts above, and iterate pricing based on the first
   few conversions.

## Honest limitations

- **No backend, no accounts, no cross-device sync.** History, presets, and
  settings live in this browser's localStorage only. Clearing browser data,
  using a different browser, or using private/incognito mode will lose all
  saved data. There is no cloud backup or export/import of history yet.
- **Web Audio autoplay policies mean sound doesn't play until the user taps
  Start.** This is correct, required behavior for all modern browsers, but it
  means the very first prep countdown always requires an explicit tap — you
  cannot auto-start a session from a URL or script and expect sound.
- **Screen Wake Lock API is not universally supported.** It works in current
  Chrome, Edge, and Android browsers; Safari/iOS support has historically
  been inconsistent across versions. The app detects and falls back
  gracefully with an on-screen note, but on unsupported browsers the device
  may still sleep mid-session unless the user disables auto-lock manually.
- **All audio is synthesized tones (sine/square oscillators), not real
  recorded bell/gym sounds.** They are clearly audible and distinct (bell vs.
  double-beep) but they are a synthesized approximation, not a sampled boxing
  bell recording.
- **No multi-timer or multi-station support.** This is a single timer for one
  group/one screen at a time — it does not coordinate multiple stations or
  circuits in one session.
- **Partial/abandoned sessions are only logged to history once at least one
  full round has been completed** (exiting or resetting during the prep
  countdown or the first round doesn't create a "0 rounds" history entry).
  This is a deliberate choice to avoid junk log entries, but means very early
  aborts are silently discarded.
- **No user accounts, no multi-user gym dashboards, no analytics.** This is a
  single-purpose timer, not a gym management platform — it intentionally does
  one thing well rather than trying to be a broader class-scheduling tool.
