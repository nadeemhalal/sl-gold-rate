import * as cheerio from "cheerio";
import type { RateRecord } from "../types.js";
import { parseLooseDateToISO, daysBetween, todayISO } from "../dateutil.js";
import { extractNumber } from "../numutil.js";
import { browserHeaders } from "../httpheaders.js";

const HOME_URL = "https://devijewellers.lk/";
const RATE_PAGE_URL = "https://devijewellers.lk/gold-rate/";
const AJAX_URL = "https://devijewellers.lk/wp-admin/admin-ajax.php?action=gpt_get_rates&range=month";

function collectCookies(res: Response): string {
  // Node's fetch exposes multiple Set-Cookie headers via getSetCookie()
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
  const raw = anyHeaders.getSetCookie ? anyHeaders.getSetCookie() : [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

/**
 * Devi Jewellers' site sits behind a WAF that blocks plain requests. Visiting
 * the homepage first to pick up a session cookie, then calling the site's own
 * (undocumented) WordPress AJAX rate-history endpoint with that cookie plus a
 * Referer/X-Requested-With header, gets past it.
 *
 * The endpoint's "24K/G" column is mislabeled: the values it returns are
 * actually per-8g (sovereign/pawn) figures, confirmed by cross-checking their
 * magnitude against CBSL/IdeaBeam per-gram rates - so we divide by 8.
 */
export async function fetchDevi(): Promise<RateRecord> {
  const scrapedAt = new Date().toISOString();

  const homeRes = await fetch(HOME_URL, { headers: browserHeaders() });
  if (!homeRes.ok) throw new Error(`Devi Jewellers: homepage request failed: HTTP ${homeRes.status}`);
  const cookie = collectCookies(homeRes);

  const ajaxRes = await fetch(AJAX_URL, {
    headers: browserHeaders({
      Cookie: cookie,
      Referer: RATE_PAGE_URL,
      "X-Requested-With": "XMLHttpRequest",
      Accept: "*/*",
    }),
  });
  if (!ajaxRes.ok) throw new Error(`Devi Jewellers: rate endpoint failed: HTTP ${ajaxRes.status}`);
  const html = await ajaxRes.text();

  const $ = cheerio.load(html);
  const firstRow = $(".gold_table tbody tr").first();
  if (firstRow.length === 0) {
    throw new Error("Devi Jewellers: rate table not found in response");
  }

  const dateText = firstRow.find("td").eq(0).text().trim();
  const per8gText = firstRow.find("td").eq(1).contents().first().text();
  const per8g = extractNumber(per8gText);
  const publishedDate = parseLooseDateToISO(dateText);

  if (!publishedDate || !Number.isFinite(per8g) || per8g <= 0) {
    throw new Error(`Devi Jewellers: could not parse row (date="${dateText}", value="${per8gText}")`);
  }

  const staleDays = daysBetween(publishedDate, todayISO());

  return {
    source: "Devi Jewellers",
    kind: "seller",
    sourceUrl: RATE_PAGE_URL,
    pricePerGram24K: per8g / 8,
    unitAsPublished: `LKR ${per8g.toFixed(2)} per 8g (published as "24K/G")`,
    publishedDate,
    scrapedAt,
    staleDays,
    stale: staleDays > 3,
    flagged: false,
  };
}
