import { useEffect } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import type { FC, SelectMeta } from "../../../lib/types";
import { sevColor } from "../../../lib/utils";

export default function NWSDataLayer({
  nws,
  onSelect,
}: {
  nws: FC | null;
  onSelect: (ll: [number, number], meta: SelectMeta) => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    map.data.forEach((f) => map.data.remove(f));

    if (nws?.features?.length) {
      map.data.addGeoJson(nws as any);
      map.data.setStyle((f) => {
        const sev = (f.getProperty("severity") || "Unknown") as string;
        const color = sevColor(sev);
        return {
          strokeColor: color,
          strokeWeight: 1.2,
          fillColor: color,
          fillOpacity: 0.18,
        };
      });

      const clickListener = map.data.addListener(
        "click",
        (e: google.maps.Data.MouseEvent) => {
          const p: any = e.feature;
          const title =
            (p.getProperty && p.getProperty("event")) || "NWS Alert";
          const sev = (p.getProperty && p.getProperty("severity")) || "Unknown";
          const src =
            (p.getProperty && (p.getProperty("@id") || p.getProperty("id"))) ||
            "";
          if (e.latLng) {
            onSelect([e.latLng.lat(), e.latLng.lng()], {
              kind: "nws",
              title,
              severity: sev,
              sourceUrl: src || undefined,
              confidence: 1,
              emoji: "⚠️",
              raw: p?.g ?? p,
            });
          }
        }
      );

      return () => {
        google.maps.event.removeListener(clickListener);
        map.data.forEach((f) => map.data.remove(f));
      };
    }
  }, [map, nws, onSelect]);

  return null;
}
