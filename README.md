# Gold Rate Dashboard

Daily 24K gold rate dashboard for Sri Lanka. Scrapes three sellers' own published
rates and two market benchmarks, then highlights the cheapest seller.

## Sources

**Sellers** (compared against each other for "cheapest"):
- Devi Jewellers
- Bullion Lanka Jewellers
- Ran Lanka Gem & Jewellery

**Benchmarks** (reference only, not part of the cheapest-seller ranking):
- CBSL — official rate derived from the international spot price
- IdeaBeam — aggregated market reference rate

`goldprice.org` was evaluated but dropped: its data API is protected in a way
that isn't reliably scrapable without more work than it's worth for a
supplementary reference line.

All prices are normalized to **LKR per gram, 24K**. Some sources publish per
8g (a "sovereign"/"pawn", the standard Sri Lankan retail unit) — those are
divided by 8. Each seller's published rate is cross-checked against the
benchmark average; if it deviates more than 20%, it's flagged as likely a
broken/stale scrape rather than a real price.

## Setup

```bash
npm install
```

## Running

```bash
npm run scrape      # fetch today's rates, append to data/history.json, regenerate public/data.js
npm run dashboard    # open the dashboard in your default browser
```

You can also just double-click `public/index.html` — it reads `data.js` via a
plain `<script>` tag, so it works fine opened directly from disk, no server
needed.

## Automatic daily updates

A scheduled task (`gold-rate-daily-scrape`) runs `npm run scrape` every day at
7:30 AM Sri Lanka time. It's managed through Claude Code's scheduled-tasks
system, not Windows Task Scheduler — **it only fires while Claude Code is
open** (if closed at the scheduled time, it runs on next launch instead). If
you'd rather have it run unattended even when Claude Code isn't open, this
would need to move to a native Windows Task Scheduler entry instead — say so
and it can be set up that way.

## Project layout

- `src/sources/*.ts` — one scraper per source
- `src/scrape.ts` — orchestrator: runs all scrapers, normalizes units, sanity-checks, writes history
- `data/history.json` — full daily history (source of truth)
- `public/` — the dashboard itself (`index.html`, `app.js`, `styles.css`, and generated `data.js`)
- `scripts/serve.mjs` — optional tiny static server, only needed for previewing in tools that block `file://` pages

## If a scraper starts failing

Each of these sites is a small business's WordPress/Elementor page, not a
stable API — expect one to change its HTML occasionally and break its parser
in `src/sources/`. Run `npm run scrape` and check the console output; a
`FAILED: <source>: <error>` line tells you which one needs a fix, and the
dashboard will show a "SCRAPE FAILED" badge for it in the meantime rather than
silently showing wrong data.
