// components/map/overlays/TractsLayer.tsx
import * as React from "react";
import { useMap } from "@vis.gl/react-google-maps";
import type { FC } from "../../../lib/types";
import {
  SEVERITY_COLORS,
  toSeverityRank,
  type SeverityRank,
} from "../../../lib/severity";
import { GEO_URL } from "../../../lib/constants";

type Pt = { lat: number; lon: number; rank: SeverityRank | null };

function extractReports(fc: FC): Pt[] {
  const out: Pt[] = [];
  (fc?.features || []).forEach((f: any) => {
    if (f?.geometry?.type !== "Point") return;
    const [lon, lat] = f.geometry.coordinates || [];
    const p = f.properties || {};
    const rank = toSeverityRank(p.severity, p.category);
    out.push({ lat: Number(lat), lon: Number(lon), rank });
  });
  return out;
}

// natural feeds → always High rank (2)
function extractNaturalPoints(
  eonet?: FC | null,
  quakes?: FC | null,
  firms?: FC | null
): Pt[] {
  const acc: Pt[] = [];
  const pushPoints = (fc?: FC | null) => {
    (fc?.features || []).forEach((f: any) => {
      if (f?.geometry?.type !== "Point") return;
      const [lon, lat] = f.geometry.coordinates || [];
      acc.push({ lat: Number(lat), lon: Number(lon), rank: 2 });
    });
  };
  pushPoints(eonet);
  pushPoints(quakes);
  pushPoints(firms);
  return acc;
}

export default function TractsLayer({
  reports,
  eonet,
  quakes,
  firms,
  minZoom = 11,
}: {
  reports: FC;
  eonet?: FC | null;
  quakes?: FC | null;
  firms?: FC | null;
  minZoom?: number;
}) {
  const map = useMap();
  const [tick, setTick] = React.useState(0);

  // NEW: keep live polygons + request id in refs
  const polysRef = React.useRef<google.maps.Polygon[]>([]);
  const reqIdRef = React.useRef(0);

  const clearAll = React.useCallback(() => {
    polysRef.current.forEach((p) => p.setMap(null));
    polysRef.current = [];
  }, []);

  React.useEffect(() => {
    if (!map) return;
    const idle = map.addListener("idle", () => setTick((k) => k + 1));
    setTick((k) => k + 1);
    return () => google.maps.event.removeListener(idle);
  }, [map]);

  React.useEffect(() => {
    if (!map) return;

    // bump request id & create an abort controller for this run
    const myId = ++reqIdRef.current;
    const ctrl = new AbortController();

    const zoom = map.getZoom?.() ?? 0;

    // If zoom too small, clear immediately and bail
    if (zoom < minZoom) {
      clearAll();
      return () => ctrl.abort();
    }

    const b = map.getBounds?.();
    if (!b) {
      clearAll();
      return () => ctrl.abort();
    }

    const ne = b.getNorthEast(),
      sw = b.getSouthWest();
    const bbox = `${sw.lng()},${sw.lat()},${ne.lng()},${ne.lat()}`;

    // fetch tracts for current view
    fetch(`${GEO_URL}?bbox=${bbox}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((fc) => {
        // Ignore stale responses (if user moved/zoomed since)
        if (myId !== reqIdRef.current) return;

        // We're drawing fresh polygons → clear previous ones first
        clearAll();

        const ptsReports = extractReports(reports);
        const ptsNatural = extractNaturalPoints(eonet, quakes, firms);
        const pts = [...ptsReports, ...ptsNatural].filter(
          (p) =>
            p.lat >= sw.lat() &&
            p.lat <= ne.lat() &&
            p.lon >= sw.lng() &&
            p.lon <= ne.lng()
        );

        const addPoly = (rings: google.maps.LatLngLiteral[][]) => {
          const polygon = new google.maps.Polygon({
            paths: rings,
            strokeColor: "#000000",
            strokeOpacity: 0.3,
            strokeWeight: 1,
            fillColor: "#9aa0a6",
            fillOpacity: 0.05,
            clickable: false,
            zIndex: 1,
          });
          polygon.setMap(map);
          polysRef.current.push(polygon);

          // Highest severity wins
          let maxRank: SeverityRank | null = null;
          for (const p of pts) {
            if (p.rank == null) continue;
            const inside = google.maps.geometry.poly.containsLocation(
              new google.maps.LatLng(p.lat, p.lon),
              polygon
            );
            if (!inside) continue;
            if (maxRank == null || p.rank > maxRank) maxRank = p.rank;
            if (maxRank === 2) break;
          }

          if (maxRank != null) {
            polygon.setOptions({
              fillColor: SEVERITY_COLORS[maxRank],
              fillOpacity: 0.18,
              strokeOpacity: 0.12,
            });
          }
        };

        (fc.features || []).forEach((f: any) => {
          const g = f.geometry || {};
          const rings: google.maps.LatLngLiteral[][] = [];
          if (g.type === "Polygon") {
            const outer = (g.coordinates?.[0] || []).map((c: any) => ({
              lat: c[1],
              lng: c[0],
            }));
            if (outer.length) rings.push(outer);
          } else if (g.type === "MultiPolygon") {
            (g.coordinates || []).forEach((poly: any) => {
              const outer = (poly?.[0] || []).map((c: any) => ({
                lat: c[1],
                lng: c[0],
              }));
              if (outer.length) rings.push(outer);
            });
          }
          if (rings.length) addPoly(rings);
        });
      })
      .catch((e) => {
        if (e?.name !== "AbortError") {
          // optional: console.warn("Tracts fetch failed", e);
        }
      });

    // On effect re-run/unmount: abort in-flight request
    return () => ctrl.abort();
  }, [map, tick, reports, eonet, quakes, firms, minZoom, clearAll]);

  return null;
}
