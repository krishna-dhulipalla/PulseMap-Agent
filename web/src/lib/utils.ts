export const sevColor = (sev?: string): string => {
  switch ((sev || "").toLowerCase()) {
    case "extreme":
      return "#6f00ff";
    case "severe":
      return "#d7191c";
    case "moderate":
      return "#fdae61";
    case "minor":
      return "#ffff99";
    default:
      return "#9e9e9e";
  }
};

export const eonetEmoji = (p: any) => {
  const s = (
    p?.category ||
    p?.categories?.[0]?.title ||
    p?.title ||
    ""
  ).toLowerCase();
  if (s.includes("wildfire")) return "🔥";
  if (s.includes("volcano")) return "🌋";
  if (s.includes("earthquake") || s.includes("seismic")) return "💥";
  if (
    s.includes("storm") ||
    s.includes("cyclone") ||
    s.includes("hurricane") ||
    s.includes("typhoon")
  )
    return "🌀";
  if (s.includes("flood")) return "🌊";
  if (s.includes("landslide")) return "🏔️";
  if (s.includes("drought")) return "🌵";
  if (s.includes("ice") || s.includes("snow") || s.includes("blizzard"))
    return "❄️";
  if (s.includes("dust") || s.includes("smoke") || s.includes("haze"))
    return "🌫️";
  return "⚠️";
};

export const toQuery = (o: Record<string, any>) =>
  "?" +
  Object.entries(o)
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`
    )
    .join("&");

export const formatAgo = (iso?: string) => {
  if (!iso) return "";
  const t = new Date(iso);
  const s = Math.max(0, (Date.now() - t.getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
