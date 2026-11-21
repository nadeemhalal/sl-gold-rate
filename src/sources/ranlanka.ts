import * as cheerio from "cheerio";
import type { RateRecord } from "../types.js";
import { todayISO } from "../dateutil.js";
import { extractNumber } from "../numutil.js";
import { fetchThroughKnownInterceptor } from "../pinnedfetch.js";
import { browserHeaders } from "../httpheaders.js";

const PAGE_URL = "https://ranlanka.lk/gold-price-today/";

/**
 * Ran Lanka Gem & Jewellery publishes rates per 8g/sovereign in an
 * Elementor-built page. A normal verified connection is tried first; only if
 * the certificate is untrusted (a FortiGate firewall on some networks re-signs
 * this host's traffic, see pinnedfetch.ts) do we fall back to the pinned path.
 */
async function getPage(): Promise<{ status: number; text: string }> {
  try {
    const res = await fetch(PAGE_URL, { headers: browserHeaders() });
    return { status: res.status, text: await res.text() };
  } catch (err) {
    const code = String((err as { cause?: { code?: string } }).cause?.code ?? "");
    if (!/CERT|SELF_SIGNED|UNABLE_TO_VERIFY/.test(code)) throw err;
    return fetchThroughKnownInterceptor(PAGE_URL, {
      headers: browserHeaders(),
      expectedIssuerContains: "Fortinet",
    });
  }
}

export async function fetchRanLanka(): Promise<RateRecord> {
  const scrapedAt = new Date().toISOString();
  const res = await getPage();
  if (res.status !== 200) throw new Error(`Ran Lanka request failed: HTTP ${res.status}`);
  const html = res.text;
  const $ = cheerio.load(html);

  const per8g = extractNumber($(".rl-price-gold-card-24k .rl-price-sell").first().text());
  if (!Number.isFinite(per8g) || per8g <= 0) {
    throw new Error("Ran Lanka: could not find the 24K selling price (.rl-price-gold-card-24k .rl-price-sell)");
  }

  return {
    source: "Ran Lanka Gem & Jewellery",
    kind: "seller",
    sourceUrl: PAGE_URL,
    pricePerGram24K: per8g / 8,
    unitAsPublished: `LKR ${per8g.toFixed(2)} per 8g (24K selling price; page publishes no reliable date)`,
    publishedDate: todayISO(),
    scrapedAt,
    staleDays: 0,
    stale: false,
    flagged: false,
  };
}
