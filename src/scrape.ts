import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchCbsl } from "./sources/cbsl.js";
import { fetchIdeaBeam } from "./sources/ideabeam.js";
import { fetchDevi } from "./sources/devi.js";
import { fetchBullionLanka } from "./sources/bullionlanka.js";
import { fetchRanLanka } from "./sources/ranlanka.js";
import type { DaySnapshot, RateRecord } from "./types.js";
import { todayISO } from "./dateutil.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const HISTORY_PATH = path.join(DATA_DIR, "history.json");
const PUBLIC_DATA_PATH = path.join(__dirname, "..", "public", "data.js");

const SOURCES: Array<{ name: string; kind: RateRecord["kind"]; url: string; fetch: () => Promise<RateRecord> }> = [
  { name: "CBSL (official reference)", kind: "benchmark", url: "", fetch: fetchCbsl },
  { name: "IdeaBeam (market reference)", kind: "benchmark", url: "", fetch: fetchIdeaBeam },
  { name: "Devi Jewellers", kind: "seller", url: "", fetch: fetchDevi },
  { name: "Bullion Lanka Jewellers", kind: "seller", url: "", fetch: fetchBullionLanka },
  { name: "Ran Lanka Gem & Jewellery", kind: "seller", url: "", fetch: fetchRanLanka },
];

const SANITY_DEVIATION_THRESHOLD = 0.2; // 20% away from the CBSL benchmark looks like a scraping error

async function loadHistory(): Promise<DaySnapshot[]> {
  try {
    const raw = await readFile(HISTORY_PATH, "utf8");
    return JSON.parse(raw) as DaySnapshot[];
  } catch {
    return [];
  }
}

function errorRecord(name: string, kind: RateRecord["kind"], url: string, message: string): RateRecord {
  return {
    source: name,
    kind,
    sourceUrl: url,
    pricePerGram24K: 0,
    unitAsPublished: "n/a",
    publishedDate: "n/a",
    scrapedAt: new Date().toISOString(),
    staleDays: 0,
    stale: false,
    flagged: false,
    error: message,
  };
}

async function main() {
  console.log(`[${new Date().toISOString()}] Starting gold rate scrape...`);

  const settled = await Promise.allSettled(SOURCES.map((s) => s.fetch()));
  const records: RateRecord[] = settled.map((result, i) => {
    const src = SOURCES[i];
    if (result.status === "fulfilled") {
      console.log(`  ok: ${src.name} -> LKR ${result.value.pricePerGram24K.toFixed(2)}/g (published ${result.value.publishedDate})`);
      return result.value;
    }
    console.error(`  FAILED: ${src.name}: ${result.reason}`);
    return errorRecord(src.name, src.kind, src.url, String(result.reason?.message ?? result.reason));
  });

  const benchmarks = records.filter((r) => r.kind === "benchmark" && !r.error);
  const benchmarkAvg =
    benchmarks.length > 0 ? benchmarks.reduce((sum, r) => sum + r.pricePerGram24K, 0) / benchmarks.length : null;

  if (benchmarkAvg) {
    for (const r of records) {
      if (r.kind !== "seller" || r.error) continue;
      const deviation = (r.pricePerGram24K - benchmarkAvg) / benchmarkAvg;
      if (Math.abs(deviation) > SANITY_DEVIATION_THRESHOLD) {
        r.flagged = true;
        r.flagReason = `${(deviation * 100).toFixed(1)}% away from the CBSL/IdeaBeam benchmark average - likely a stale or broken scrape, verify manually`;
      }
    }
  }

  const validSellers = records.filter((r) => r.kind === "seller" && !r.error && !r.flagged);
  const cheapest = validSellers.reduce<RateRecord | null>((min, r) => {
    if (!min || r.pricePerGram24K < min.pricePerGram24K) return r;
    return min;
  }, null);

  const snapshot: DaySnapshot = {
    date: todayISO(),
    generatedAt: new Date().toISOString(),
    cheapestSeller: cheapest?.source ?? null,
    records,
  };

  const history = await loadHistory();
  const idx = history.findIndex((d) => d.date === snapshot.date);
  if (idx >= 0) history[idx] = snapshot;
  else history.push(snapshot);
  history.sort((a, b) => a.date.localeCompare(b.date));

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(HISTORY_PATH, JSON.stringify(history, null, 2), "utf8");

  await mkdir(path.dirname(PUBLIC_DATA_PATH), { recursive: true });
  await writeFile(PUBLIC_DATA_PATH, `window.GOLD_HISTORY = ${JSON.stringify(history)};\n`, "utf8");

  console.log(`Done. ${history.length} day(s) of history saved. Cheapest today: ${snapshot.cheapestSeller ?? "n/a"}`);
}

main().catch((err) => {
  console.error("Scrape run failed:", err);
  process.exitCode = 1;
});
