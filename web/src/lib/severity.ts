// lib/severity.ts
export type SeverityRank = 0 | 1 | 2; // 0=low, 1=medium, 2=high

export const SEVERITY_COLORS: Record<SeverityRank, string> = {
  0: "#7BC96F", // low  (soft green)
  1: "#F1E05A", // med  (pale yellow)
  2: "#EF6A5B", // high (light red)
};

// NEW: simple natural-disaster detector (keywords are easy to tune)
const NATURAL_KEYS = [
  "wildfire",
  "fire",
  "flood",
  "hurricane",
  "tornado",
  "earthquake",
  "quake",
  "storm",
  "cyclone",
  "typhoon",
  "tsunami",
  "volcano",
  "eruption",
  "landslide",
  "mudslide",
  "avalanche",
  "blizzard",
  "snow",
  "hail",
  "heat",
  "drought",
  "smoke",
  "dust",
  "wind",
  "ice",
  "freezing",
  "lightning",
];
export function isNaturalCategory(category?: string | null): boolean {
  const c = (category || "").toLowerCase();
  return NATURAL_KEYS.some((k) => c.includes(k));
}

// Normalize any severity -> rank (with NATURAL override to High)
export function toSeverityRank(
  severity: unknown,
  category?: string | null
): SeverityRank | null {
  // Natural disasters => always High (red), regardless of LLM severity
  if (isNaturalCategory(category)) return 2;

  if (severity != null) {
    const s = String(severity).toLowerCase().trim();
    if (s === "high" || s === "severe" || s === "critical") return 2;
    if (s === "medium" || s === "moderate") return 1;
    if (s === "low" || s === "minor") return 0;
    const n = Number(s);
    if (Number.isFinite(n)) {
      if (n >= 4) return 2;
      if (n >= 2) return 1;
      return 0;
    }
  }

  // Fallback by category (non-natural)
  const c = (category || "").toLowerCase();
  if (
    c.includes("gun") ||
    c.includes("robbery") ||
    c.includes("assault") ||
    c.includes("shoot")
  )
    return 2;
  if (
    c.includes("accident") ||
    c.includes("medical") ||
    c.includes("missing") ||
    c.includes("theft")
  )
    return 1;
  if (
    c.includes("road") ||
    c.includes("construction") ||
    c.includes("blocked") ||
    c.includes("lost") ||
    c.includes("bag")
  )
    return 0;

  return null;
}
