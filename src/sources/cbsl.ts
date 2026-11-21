import type { RateRecord } from "../types.js";
import { daysBetween, todayISO } from "../dateutil.js";

const TROY_OZ_IN_GRAMS = 31.1034768;
const RESULTS_URL = "https://www.cbsl.gov.lk/cbsl_custom/exrates/exrates_results.php";
const PAGE_URL = "https://www.cbsl.gov.lk/en/rates-and-indicators/exchange-rates/daily-gold-rates";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * CBSL publishes an official indicative rate derived from the international
 * spot price (Reuters/Bloomberg) x USD/LKR spot rate - a benchmark, not a
 * seller's price. The site exposes it through a POST-based lookup tool
 * rather than a plain page table.
 */
export async function fetchCbsl(): Promise<RateRecord> {
  const scrapedAt = new Date().toISOString();
  const body = new URLSearchParams({
    lookupPage: "lookup_daily_exchange_rates.php",
    rangeType: "dates",
    txtStart: isoDaysAgo(7),
    txtEnd: isoDaysAgo(0),
    "chk_cur[]": "XAU~Gold (per Troy oz.)",
    submit_button: "Submit",
  });

  const res = await fetch(RESULTS_URL, {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`CBSL request failed: HTTP ${res.status}`);
  const html = await res.text();

  const rowRe = /<tr class="odd"><td>\s*([\d-]+)\s*<\/td><td>\s*([\d.]+)\s*<\/td>/g;
  let latestDate: string | null = null;
  let latestValue: number | null = null;
  for (const match of html.matchAll(rowRe)) {
    const [, date, value] = match;
    if (!latestDate || date > latestDate) {
      latestDate = date;
      latestValue = Number(value);
    }
  }

  if (!latestDate || latestValue === null) {
    throw new Error("CBSL: could not find a gold rate row in the response");
  }

  const pricePerGram24K = latestValue / TROY_OZ_IN_GRAMS;
  const staleDays = daysBetween(latestDate, todayISO());

  return {
    source: "CBSL (official reference)",
    kind: "benchmark",
    sourceUrl: PAGE_URL,
    pricePerGram24K,
    unitAsPublished: `LKR ${latestValue.toFixed(2)} per troy oz (XAU->LKR)`,
    publishedDate: latestDate,
    scrapedAt,
    staleDays,
    stale: staleDays > 3,
    flagged: false,
  };
}
