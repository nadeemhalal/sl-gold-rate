import * as cheerio from "cheerio";
import type { RateRecord } from "../types.js";
import { daysBetween, todayISO } from "../dateutil.js";
import { extractNumber } from "../numutil.js";

const PAGE_URL = "https://www.ideabeam.com/finance/rates/goldprice.php";

/**
 * IdeaBeam publishes a single aggregated market reference table (not a
 * per-seller comparison), with a daily history table further down the page.
 * We read the most recent row of that history table since it's more
 * reliably dated than the "Updated On" banner.
 */
export async function fetchIdeaBeam(): Promise<RateRecord> {
  const scrapedAt = new Date().toISOString();
  const res = await fetch(PAGE_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  if (!res.ok) throw new Error(`IdeaBeam request failed: HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const firstRow = $("table.datatable tbody tr").first();
  if (firstRow.length === 0) {
    throw new Error("IdeaBeam: history table not found");
  }

  const publishedDate = firstRow.find("th").first().text().trim();
  const priceText = firstRow.find("td").eq(1).text(); // 24 Carat 1 Gram column
  const price = extractNumber(priceText);

  if (!publishedDate || !Number.isFinite(price) || price <= 0) {
    throw new Error(`IdeaBeam: could not parse row (date="${publishedDate}", price="${priceText}")`);
  }

  const staleDays = daysBetween(publishedDate, todayISO());

  return {
    source: "IdeaBeam (market reference)",
    kind: "benchmark",
    sourceUrl: PAGE_URL,
    pricePerGram24K: price,
    unitAsPublished: `Rs. ${price.toFixed(2)} per gram (24 Carat 1 Gram)`,
    publishedDate,
    scrapedAt,
    staleDays,
    stale: staleDays > 3,
    flagged: false,
  };
}
