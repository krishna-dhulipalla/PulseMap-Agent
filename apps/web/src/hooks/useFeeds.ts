import { useEffect, useState } from "react";
import type { FC } from "../lib/types";
import { NWS_URL, USGS_URL, EONET_URL, FIRMS_URL } from "../lib/constants";

// normalize FIRMS (same as you had)
function normalizeFirms(
  j: any
): { type: "FeatureCollection"; features: any[] } | null {
  if (!j) return null;
  if (j.type === "FeatureCollection" && Array.isArray(j.features)) return j;
  if (j.data?.type === "FeatureCollection" && Array.isArray(j.data.features))
    return j.data;
  if (Array.isArray(j.features))
    return { type: "FeatureCollection", features: j.features };
  const rows = Array.isArray(j?.rows)
    ? j.rows
    : Array.isArray(j?.items)
    ? j.items
    : Array.isArray(j)
    ? j
    : null;
  if (rows) {
    const features = rows
      .map((r: any) => {
        const lat = Number(r.lat ?? r.latitude ?? r.LAT ?? r.LATITUDE);
        const lon = Number(r.lon ?? r.longitude ?? r.LON ?? r.LONGITUDE);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [lon, lat] },
          properties: r,
        };
      })
      .filter(Boolean);
    return { type: "FeatureCollection", features };
  }
  return null;
}

// small helper: fetch with timeout; return null on any failure
async function fetchJSON(url: string, timeoutMs = 8000): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export function useFeeds() {
  const [nws, setNws] = useState<FC | null>(null);
  const [quakes, setQuakes] = useState<FC | null>(null);
  const [eonet, setEonet] = useState<FC | null>(null);
  const [firms, setFirms] = useState<FC | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const [nwsRes, usgsRes, eonetRes, firmsRes] = await Promise.allSettled([
        fetchJSON(NWS_URL, 8000),
        fetchJSON(USGS_URL, 8000),
        fetchJSON(EONET_URL, 5000), // shorter timeout since it’s flaky right now
        fetchJSON(FIRMS_URL, 8000),
      ]);

      if (!mounted) return;

      const val = (x: PromiseSettledResult<any>) =>
        x.status === "fulfilled" ? x.value : null;

      const a = val(nwsRes),
        b = val(usgsRes),
        c = val(eonetRes),
        d = val(firmsRes);

      setNws(a?.data || a || null);
      setQuakes(b?.data || b || null);
      setEonet(c?.data || c || null);

      const firmsFC = normalizeFirms(d);
      setFirms(firmsFC);

      console.log("FIRMS note:", (d && d._note) || firmsFC?._note || null);
      console.log("FIRMS normalized:", firmsFC?.features?.length);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return { nws, quakes, eonet, firms };
}
