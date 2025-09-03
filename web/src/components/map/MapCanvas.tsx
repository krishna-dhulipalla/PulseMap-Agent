import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
} from "@vis.gl/react-google-maps";
import { useEffect, useState } from "react";
import SearchControl from "./controls/SearchControl";
import MyLocationControl from "./controls/MyLocationControl";
import SingleSelect from "./controls/SingleSelect";
import NWSDataLayer from "./overlays/NWSDataLayer";
import EmojiMarker from "./overlays/EmojiMarker";
import { GMAPS_KEY, MAP_ID } from "../../lib/constants";
import { eonetEmoji } from "../../lib/utils";
import type { FC, SelectMeta } from "../../lib/types";
import { ReportIcon } from "../../components/ReportIcon";
import FirmsLayer from "./overlays/FirmsLayer";

function PanOnSelect({ ll }: { ll: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !ll) return;
    map.panTo({ lat: ll[0], lng: ll[1] });
    const z = map.getZoom?.() ?? 0;
    if (z < 14) map.setZoom(14); // tweak 14–16 as you like
  }, [map, ll]);
  return null;
}

type RuntimeCfg = {
  VITE_GOOGLE_MAPS_API_KEY?: string;
  VITE_GOOGLE_MAPS_MAP_ID?: string;
};

export default function MapCanvas({
  selectedLL,
  selectedMeta,
  setSelected,
  nws,
  quakes,
  eonet,
  firms,
  reports,
}: {
  selectedLL: [number, number] | null;
  selectedMeta: SelectMeta | null;
  setSelected: (ll: [number, number], meta: SelectMeta) => void;
  nws: FC | null;
  quakes: FC | null;
  eonet: FC | null;
  firms: FC | null;
  reports: FC;
}) {
  const [cfg, setCfg] = useState<RuntimeCfg | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/config/runtime", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((json) => {
        // Safe, partial logging (don’t leak the full key)
        const k = json?.VITE_GOOGLE_MAPS_API_KEY;
        const mid = json?.VITE_GOOGLE_MAPS_MAP_ID;
        console.log("[PulseMap] /config/runtime:", {
          key_present: !!k,
          key_len: k?.length ?? 0,
          key_preview: k ? `${k.slice(0, 6)}...${k.slice(-4)}` : null,
          map_id_present: !!mid,
          map_id_preview: mid ? `${mid.slice(0, 5)}...` : null,
        });
        setCfg(json);
      })
      .catch((e) => {
        console.error("[PulseMap] runtime config fetch failed:", e);
        setErr(e.message);
      });
  }, []);
  const effectiveKey = cfg?.VITE_GOOGLE_MAPS_API_KEY ?? GMAPS_KEY;
  const effectiveMapId = cfg?.VITE_GOOGLE_MAPS_MAP_ID ?? MAP_ID;

  useEffect(() => {
    console.log("[PulseMap] build-time env:", {
      GMAPS_KEY_present: !!GMAPS_KEY,
      GMAPS_KEY_len: GMAPS_KEY?.length ?? 0,
      GMAPS_KEY_preview: GMAPS_KEY
        ? `${GMAPS_KEY.slice(0, 6)}...${GMAPS_KEY.slice(-4)}`
        : null,
      MAP_ID_present: !!MAP_ID,
      MAP_ID_preview: MAP_ID ? `${MAP_ID.slice(0, 5)}...` : null,
    });
  }, []);

  if (err) return <div>Map config error: {err}</div>;
  if (!effectiveKey) {
    console.warn(
      "[PulseMap] No Google Maps API key found from runtime or build-time."
    );
    return <div>No Google Maps API key. Check /config/runtime and env.</div>;
  }

  return (
    <APIProvider
      apiKey={effectiveKey || GMAPS_KEY}
      libraries={["places", "marker"]}
    >
      <Map
        className="map"
        mapId={effectiveMapId || MAP_ID || undefined}
        defaultCenter={{ lat: 39, lng: -98 }}
        defaultZoom={4}
        gestureHandling="greedy"
        disableDefaultUI={false}
      >
        <PanOnSelect ll={selectedLL} />
        <SearchControl onPlace={setSelected} />
        <MyLocationControl onLocated={setSelected} />
        <SingleSelect onPick={setSelected} />
        <NWSDataLayer
          nws={nws}
          onSelect={(ll, meta) => setSelected(ll, meta)}
        />
        <FirmsLayer
          firms={firms}
          onSelect={(ll, meta) => setSelected(ll, meta)}
        />

        {selectedLL && (
          <EmojiMarker
            position={{ lat: selectedLL[0], lng: selectedLL[1] }}
            emoji="📍"
            title={selectedMeta?.title || "Selected"}
            draggable
            onDragEnd={(ll) =>
              setSelected(ll, { kind: "click", title: "Selected point" })
            }
          />
        )}

        {/* Quakes */}
        {quakes?.features?.map((f: any, i: number) => {
          const g = f.geometry;
          if (!g || g.type !== "Point") return null;
          const [lng, lat] = g.coordinates as [number, number];
          const p = f.properties || {};
          const m = p.mag ?? p.Magnitude ?? p.m ?? null;
          const place = p.place || p.title || "Earthquake";
          const src = p.url || p.detail || p.sources || "";
          return (
            <EmojiMarker
              key={`qk-${i}`}
              position={{ lat, lng }}
              emoji="💥"
              title={place}
              onClick={() =>
                setSelected([lat, lng], {
                  kind: "quake",
                  title: "Earthquake at " + place,
                  severity: m !== null ? `M${m}` : undefined,
                  sourceUrl: src || undefined,
                  confidence: 1,
                  emoji: "💥",
                  raw: p,
                })
              }
            />
          );
        })}

        {/* EONET */}
        {eonet?.features?.map((f: any, i: number) => {
          const g = f.geometry;
          if (!g || g.type !== "Point") return null;
          const [lng, lat] = g.coordinates as [number, number];
          const p = f.properties || {};
          const title = p.title || p.category || "Event";
          const emoji = eonetEmoji(p);
          const src = p.link || p.url || "";
          return (
            <EmojiMarker
              key={`eo-${i}`}
              position={{ lat, lng }}
              emoji={emoji}
              title={title}
              onClick={() =>
                setSelected([lat, lng], {
                  kind: "eonet",
                  title,
                  sourceUrl: src || undefined,
                  confidence: 1,
                  emoji,
                  raw: p,
                })
              }
            />
          );
        })}

        {/* User reports (keep your AdvancedMarker + ReportIcon) */}
        {reports.features.map((f, i) => {
          if (f.geometry?.type !== "Point") return null;
          const [lng, lat] = f.geometry.coordinates as [number, number];
          const p = f.properties || {};
          const iconName = p.icon || p.emoji || "info";
          const title = p.title || "User report";
          const desc = p.text || "";
          return (
            <AdvancedMarker
              key={`rp-${i}`}
              position={{ lat, lng }}
              title={title}
              zIndex={100}
              onClick={() =>
                setSelected([lat, lng], {
                  kind: "report",
                  title,
                  subtitle: desc,
                  severity: p.severity,
                  confidence: p.confidence,
                  category: p.category,
                  emoji: p.emoji,
                  raw: p,
                })
              }
            >
              <div className="bg-white rounded-full p-1 shadow-md border">
                <ReportIcon name={iconName} size={28} />
              </div>
            </AdvancedMarker>
          );
        })}
      </Map>
    </APIProvider>
  );
}
