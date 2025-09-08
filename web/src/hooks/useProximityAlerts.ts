// hooks/useProximityAlerts.ts
import * as React from "react";
import type { UpdateItem } from "../lib/types";
import { UPDATES_LOCAL_URL } from "../lib/constants";

export function useProximityAlerts(
  myLL: [number, number] | null,
  opts: { radiusMiles?: number; limit?: number; maxAgeHours?: number } = {}
) {
  const { radiusMiles = 2, limit = 5, maxAgeHours = 48 } = opts;

  const [nearby, setNearby] = React.useState<UpdateItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // request id to ignore stale responses
  const reqIdRef = React.useRef(0);

  const refetch = React.useCallback(async () => {
    if (!myLL) return;
    const [lat, lon] = myLL;
    setLoading(true);
    setError(null);

    const myId = ++reqIdRef.current;
    const ctrl = new AbortController();

    try {
      const url = `${UPDATES_LOCAL_URL}?lat=${lat}&lon=${lon}&radius_miles=${radiusMiles}&limit=${limit}&max_age_hours=${maxAgeHours}`;
      const res = await fetch(url, { signal: ctrl.signal });
      const data = await res.json();

      const listRaw: any[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.updates)
        ? data.updates
        : Array.isArray((data as any)?.results)
        ? (data as any).results
        : [];

      // resolve a usable rid (works even if backend forgot to surface rid at top level)
      const resolveRid = (u: any) =>
        u?.rid ||
        u?.raw?.rid ||
        u?.raw?.id ||
        u?.id ||
        u?._id ||
        u?.raw?._id ||
        u?.raw?.uuid;

      if (myId !== reqIdRef.current) return; // stale
      // Only user reports with an id we can react to
      const normalized = listRaw
        .filter((u) => u?.kind === "report")
        .map((u) => {
          const rid = resolveRid(u);
          return rid ? { ...u, rid } : null;
        })
        .filter(Boolean) as UpdateItem[];
      console.log("nearby fetch URL", url);
      console.log("nearby raw data", data);
      console.log("nearby normalized", normalized);
      setNearby(normalized.slice(0, limit));
    } catch (e: any) {
      if (e?.name !== "AbortError")
        setError(e?.message || "Failed to load nearby alerts");
    } finally {
      if (myId === reqIdRef.current) setLoading(false);
    }

    return () => ctrl.abort();
  }, [myLL, radiusMiles, limit, maxAgeHours]);

  React.useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch, myLL?.[0], myLL?.[1]]);

  return { nearby, loading, error, refetch, setNearby };
}
