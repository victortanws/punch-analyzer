# CreatorForge — YouTube Pre-Production Engine

Single-file web app (`index.html`) that turns one video idea into a complete, ready-to-shoot
production pack. Built for creators who publish at volume and treat packaging (title +
thumbnail + hook) as the product.

## The workflow

1. **Brief** — paste a URL or describe the video; optionally add up to 3 of your own title
   ideas. If a URL is present, the engine researches it with live web search first.
2. **Titles** — instantly generates **50 scored title candidates** (0–100 CTR score, style
   tag, one-line rationale each). Filter by style, sort by score, ask for "15 more like my
   selection."
3. **Interview** — 6 questions generated *for this specific video* (audience level, core
   promise, format, emotional driver, differentiation, proof). Answers re-rank the full
   title list and steer everything downstream.
4. **Select up to 3 titles** → each gets a **production pack**:
   - **Script** — spoken-word script with 3 alternative hooks (fear / curiosity / bold-claim),
     inline source citations from live web search, `[B-ROLL]` / `[ON-SCREEN TEXT]` /
     `[PATTERN INTERRUPT]` / `[OPEN LOOP]` retention cues, and `[QUOTABLE]` lines for clipping.
   - **10 thumbnail concepts** — each live-rendered as a downloadable 1280×720 PNG mockup
     (typography, layout, face/object placement, accent elements) plus a complete AI-image
     prompt for Midjourney/Ideogram.
   - **Metadata kit** — SEO description, chapters, 25–30 tags, hashtags, pinned comment,
     community post, tweet thread.
   - **3 Shorts** — vertical scripts mined from the main script, each funneling to the long-form.
5. **Export** — one markdown production doc, plus JSON project backup/import. Multiple
   projects live side-by-side (idea bank) in localStorage.

## Running it

Open `index.html` in any browser. Two modes:

- **Demo mode** (default, zero setup) — full workflow with sample data, no key, no cost.
- **Live mode** — add an Anthropic API key in ⚙ Settings (stored only in localStorage;
  calls go browser → Anthropic directly, no middleman server). Model selectable
  (Opus 4.8 default / Sonnet 5 / Haiku 4.5); a header pill tracks token usage and
  estimated spend.

## Target buyer & revenue model

- **Target buyer:** faceless-channel operators, creator agencies, and anyone running a
  multi-channel volume strategy where packaging decides everything.
- **Primary revenue:** one-time unlock or monthly license (BYO API key keeps COGS at zero);
  white-label to creator agencies who run it per client channel.
- **Wedge:** demo mode is the free funnel — the full workflow is experienceable before the
  buyer ever creates an API key.

Note: unlike the other ten portfolio apps, live mode requires a (user-supplied) Anthropic
API key — the AI generation is the product. Demo mode preserves the "open the file and it
works" property.
