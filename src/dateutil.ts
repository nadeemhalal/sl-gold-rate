const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parses loose date text like "Jul 28, 2026" or "July 3, 2026, 6:14 AM" into an ISO date (YYYY-MM-DD). */
export function parseLooseDateToISO(text: string): string | null {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA + "T00:00:00Z").getTime();
  const b = new Date(isoB + "T00:00:00Z").getTime();
  return Math.round(Math.abs(a - b) / MS_PER_DAY);
}
