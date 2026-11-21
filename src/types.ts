export type SourceKind = "seller" | "benchmark";

export interface RateRecord {
  source: string;
  kind: SourceKind;
  sourceUrl: string;
  pricePerGram24K: number;
  unitAsPublished: string;
  publishedDate: string;
  scrapedAt: string;
  staleDays: number;
  stale: boolean;
  flagged: boolean;
  flagReason?: string;
  error?: string;
}

export interface DaySnapshot {
  date: string;
  generatedAt: string;
  cheapestSeller: string | null;
  records: RateRecord[];
}
