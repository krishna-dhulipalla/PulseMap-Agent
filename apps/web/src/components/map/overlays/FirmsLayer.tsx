// components/map/overlays/FirmsLayer.tsx
import React from "react";
import type { FC, SelectMeta } from "../../../lib/types";
import EmojiMarker from "./EmojiMarker";

export default function FirmsLayer({
  firms,
  onSelect,
}: {
  firms: FC | null;
  onSelect: (ll: [number, number], meta: SelectMeta) => void;
}) {
  if (!firms?.features?.length) return null;

  const push = (lat: number, lon: number, p: any, k: string) => (
    <EmojiMarker
      key={k}
      position={{ lat, lng: lon }}
      emoji="🔥"
      title="Fire hotspot"
      onClick={() =>
        onSelect([lat, lon], {
          kind: "fire",
          title: "Fire hotspot",
          severity: p.confidence ?? p.brightness ?? p.frp,
          confidence: 1,
          emoji: "🔥",
          raw: p,
        })
      }
    />
  );

  const out: React.ReactNode[] = [];
  firms.features.forEach((f: any, i: number) => {
    const g = f?.geometry,
      p = f?.properties || {};
    if (!g) return;
    if (g.type === "Point" && Array.isArray(g.coordinates)) {
      const [lon, lat] = g.coordinates;
      if (Number.isFinite(lat) && Number.isFinite(lon))
        out.push(push(lat, lon, p, `fi-${i}`));
    } else if (g.type === "MultiPoint" && Array.isArray(g.coordinates)) {
      g.coordinates.forEach((c: any, j: number) => {
        const [lon, lat] = c || [];
        if (Number.isFinite(lat) && Number.isFinite(lon))
          out.push(push(lat, lon, p, `fi-${i}-${j}`));
      });
    }
  });

  return <>{out}</>;
}
