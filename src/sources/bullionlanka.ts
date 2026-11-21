import * as cheerio from "cheerio";
import type { RateRecord } from "../types.js";
import { todayISO } from "../dateutil.js";
import { extractNumber } from "../numutil.js";
import { browserHeaders } from "../httpheaders.js";

const PAGE_URL = "https://bullionlankajewellers.lk/";

/**
 * Bullion Lanka's old /gold-rates/ page was removed; current "Indicative Gold
 * Rates" now live on the homepage, quoted per 8g (poun). The page publishes no
 * date, so freshness can't be verified - publishedDate is the scrape date.
 */
export async function fetchBullionLanka(): Promise<RateRecord> {
  const scrapedAt = new Date().toISOString();
  const res = await fetch(PAGE_URL, { headers: browserHeaders() });
  if (!res.ok) throw new Error(`Bullion Lanka request failed: HTTP ${res.status}`);
  const $ = cheerio.load(await res.text());

  const per8g = extractNumber($("#rate-sell-24K").first().text());
  if (!Number.isFinite(per8g) || per8g <= 0) {
    throw new Error(`Bullion Lanka: could not find the 24K rate (#rate-sell-24K) on the homepage`);
  }

  return {
    source: "Bullion Lanka Jewellers",
    kind: "seller",
    sourceUrl: PAGE_URL,
    pricePerGram24K: per8g / 8,
    unitAsPublished: `LKR ${per8g.toFixed(2)} per 8g (24K "Ref. Sell"; page publishes no date)`,
    publishedDate: todayISO(),
    scrapedAt,
    staleDays: 0,
    stale: false,
    flagged: false,
  };
}
