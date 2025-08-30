// apps/web/src/App.tsx
import React, { useEffect, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  Marker,
} from "@vis.gl/react-google-maps";
import { ReportIcon } from "./components/ReportIcon";

const GMAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const REPORTS_URL = `${API_BASE}/reports`;
const CHAT_URL = `${API_BASE}/chat`;
const NWS_URL = `${API_BASE}/feeds/nws`;
const USGS_URL = `${API_BASE}/feeds/usgs`;
const EONET_URL = `${API_BASE}/feeds/eonet`;
const FIRMS_URL = `${API_BASE}/feeds/firms`;
const UPLOAD_URL = `${API_BASE}/upload/photo`;

type Feature = {
  type: "Feature";
  geometry: { type: "Point" | "Polygon" | "MultiPolygon"; coordinates: any };
  properties: Record<string, any>;
};
type FC = { type: "FeatureCollection"; features: Feature[] };

type SelectMeta = {
  kind:
    | "search"
    | "mylocation"
    | "click"
    | "quake"
    | "fire"
    | "eonet"
    | "report"
    | "nws";
  title?: string;
  subtitle?: string;
  severity?: string | number;
  sourceUrl?: string;
  confidence?: number; // NEW
  emoji?: string; // NEW (for natural feeds)
  category?: string; // NEW
  raw?: any; // NEW (always stash raw props)
};

// Map EONET category/title to an emoji
const eonetEmoji = (p: any) => {
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

// ---- UI bits ----
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <span className="sr-only">…</span>
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 animate-bounce [animation-delay:-0.2s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 animate-bounce" />
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 animate-bounce [animation-delay:0.2s]" />
    </span>
  );
}

// ---- Helpers ----
const sevColor = (sev: string): string => {
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
// const quakeFill = (m: number) =>
//   m >= 5 ? "#d7191c" : m >= 4 ? "#fdae61" : m >= 3 ? "#ffff99" : "#66c2a5";

// const toLL = (coords: [number, number]) => ({ lat: coords[1], lng: coords[0] });

// ---------- Controls ----------
function MyLocationControl({
  onLocated,
}: {
  onLocated: (ll: [number, number], meta: SelectMeta) => void;
}) {
  const map = useMap();

  React.useEffect(() => {
    if (!map) return;
    const btn = document.createElement("div");
    btn.style.margin = "10px";
    btn.innerHTML = `
      <button aria-label="My location" style="
        width:40px;height:40px;border-radius:50%;
        background:#fff;border:0;cursor:pointer;
        box-shadow:0 1px 4px rgba(0,0,0,.3);
        display:flex;align-items:center;justify-content:center;font-size:18px;
      ">📍</button>`;
    map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(btn);

    const click = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const ll: [number, number] = [
            pos.coords.latitude,
            pos.coords.longitude,
          ];
          map.setCenter({ lat: ll[0], lng: ll[1] });
          map.setZoom(13);
          onLocated(ll, { kind: "mylocation", title: "My location" });
        },
        undefined,
        { enableHighAccuracy: true }
      );
    };
    btn.addEventListener("click", click);

    return () => {
      btn.removeEventListener("click", click);
      const arr = map.controls[google.maps.ControlPosition.RIGHT_BOTTOM];
      for (let i = 0; i < arr.getLength(); i++) {
        if (arr.getAt(i) === (btn as any)) {
          arr.removeAt(i);
          break;
        }
      }
    };
  }, [map, onLocated]);

  return null;
}

function SearchControl({
  onPlace,
}: {
  onPlace: (ll: [number, number], meta: SelectMeta) => void;
}) {
  const map = useMap();

  React.useEffect(() => {
    if (!map || !window.google) return;

    const container = document.createElement("div");
    container.style.background = "#fff";
    container.style.borderRadius = "8px";
    container.style.boxShadow = "0 1px 4px rgba(0,0,0,.3)";
    container.style.margin = "10px";
    container.style.padding = "4px";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Search places…";
    input.setAttribute("aria-label", "Search places");
    Object.assign(input.style, {
      border: "0",
      outline: "0",
      padding: "10px 12px",
      width: "260px",
      borderRadius: "6px",
    } as CSSStyleDeclaration);

    container.appendChild(input);
    map.controls[google.maps.ControlPosition.TOP_LEFT].push(container);

    const ac = new google.maps.places.Autocomplete(input, {
      fields: ["geometry", "name", "formatted_address"],
      types: ["geocode"],
    });
    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const loc = place?.geometry?.location;
      if (loc) {
        const ll: [number, number] = [loc.lat(), loc.lng()];
        map.setCenter({ lat: ll[0], lng: ll[1] });
        map.setZoom(12);
        onPlace(ll, {
          kind: "search",
          title: place.name || "Search result",
          subtitle: place.formatted_address,
          raw: place,
        });
      }
    });

    return () => {
      google.maps.event.removeListener(listener);
      const arr = map.controls[google.maps.ControlPosition.TOP_LEFT];
      for (let i = 0; i < arr.getLength(); i++) {
        if (arr.getAt(i) === (container as any)) {
          arr.removeAt(i);
          break;
        }
      }
    };
  }, [map, onPlace]);

  return null;
}

function SingleSelect({
  onPick,
}: {
  onPick: (ll: [number, number], meta: SelectMeta) => void;
}) {
  const map = useMap();
  React.useEffect(() => {
    if (!map) return;

    map.setOptions({ disableDoubleClickZoom: true });
    const onClick = map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      onPick([e.latLng.lat(), e.latLng.lng()], {
        kind: "click",
        title: "Selected point",
      });
    });
    const onDbl = map.addListener(
      "dblclick",
      (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        onPick([e.latLng.lat(), e.latLng.lng()], {
          kind: "click",
          title: "Selected point",
        });
      }
    );

    return () => {
      google.maps.event.removeListener(onClick);
      google.maps.event.removeListener(onDbl);
    };
  }, [map, onPick]);

  return null;
}

// ---------- Emoji Marker (AdvancedMarker w/ DOM content; falls back to Marker) ----------
function EmojiMarker({
  position,
  emoji,
  title,
  draggable = false,
  onDragEnd,
  onClick,
}: {
  position: google.maps.LatLngLiteral;
  emoji: string;
  title?: string;
  draggable?: boolean;
  onDragEnd?: (ll: [number, number]) => void;
  onClick?: () => void;
}) {
  const useAdvanced = !!MAP_ID;
  if (useAdvanced) {
    return (
      <AdvancedMarker
        position={position}
        draggable={draggable as any}
        onDragEnd={(e: any) => {
          if (onDragEnd && e.latLng)
            onDragEnd([e.latLng.lat(), e.latLng.lng()]);
        }}
        onClick={onClick}
      >
        <div
          title={title}
          style={{
            fontSize: "24px",
            lineHeight: "24px",
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,.35))",
            cursor: onClick ? "pointer" : "default",
            userSelect: "none",
          }}
        >
          {emoji}
        </div>
      </AdvancedMarker>
    );
  }
  // fallback: native Marker with emoji label
  return (
    <Marker
      position={position}
      label={emoji}
      draggable={draggable}
      onDragEnd={(e: google.maps.MapMouseEvent) => {
        if (onDragEnd && e.latLng) onDragEnd([e.latLng.lat(), e.latLng.lng()]);
      }}
      onClick={onClick}
      title={title}
    />
  );
}

// ---------- NWS polygons as Data layer (click pushes info to sidebar) ----------
function NWSDataLayer({
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
              confidence: 1, // NEW
              emoji: "⚠️", // NEW
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

// ---------- Main ----------
export default function App() {
  // the single, active point on the map
  const [selectedLL, setSelectedLL] = useState<[number, number] | null>(null);
  const [selectedMeta, setSelectedMeta] = useState<SelectMeta | null>(null);

  // Feeds + user reports
  const [reports, setReports] = useState<FC>({
    type: "FeatureCollection",
    features: [],
  });
  const [nws, setNws] = useState<FC | null>(null);
  const [quakes, setQuakes] = useState<FC | null>(null);
  const [eonet, setEonet] = useState<FC | null>(null);
  const [firms, setFirms] = useState<FC | null>(null);

  const [pendingPhotoUrl, setPendingPhotoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Chat
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; text: string; image?: string }[]
  >([]);
  const [draft, setDraft] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasFirstToken, setHasFirstToken] = useState(false);
  const chatBodyRef = React.useRef<HTMLDivElement | null>(null);
  const scrollToBottom = React.useCallback(() => {
    const el = chatBodyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  type UpdateItem = {
    kind: "report" | "quake" | "nws" | "eonet" | "fire";
    title: string;
    emoji: string;
    time: string;
    lat: number;
    lon: number;
    severity?: string | number;
    sourceUrl?: string;
  };

  const [activeTab, setActiveTab] = useState<"local" | "global">("local");
  const [localUpdates, setLocalUpdates] = useState<UpdateItem[]>([]);
  const [globalUpdates, setGlobalUpdates] = useState<UpdateItem[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [loadingGlobal, setLoadingGlobal] = useState(false);

  const UPDATES_LOCAL_URL = `${API_BASE}/updates/local`;
  const UPDATES_GLOBAL_URL = `${API_BASE}/updates/global`;

  const formatAgo = (iso?: string) => {
    if (!iso) return "";
    const t = new Date(iso);
    const s = Math.max(0, (Date.now() - t.getTime()) / 1000);
    if (s < 60) return `${Math.floor(s)}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  const pickPhoto = () => fileInputRef.current?.click();

  const onFileChosen = async (file: File) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(UPLOAD_URL, { method: "POST", body: fd }).then(
        (r) => r.json()
      );
      const url = res?.url || API_BASE + (res?.path || "");
      if (url) setPendingPhotoUrl(url);
    } catch {
      // no-op or toast
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toQuery = (o: Record<string, any>) =>
    "?" +
    Object.entries(o)
      .map(
        ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`
      )
      .join("&");

  const loadLocalUpdates = async (ll: [number, number]) => {
    setLoadingLocal(true);
    try {
      const url =
        UPDATES_LOCAL_URL +
        toQuery({
          lat: ll[0],
          lon: ll[1],
          radius_miles: 25,
          max_age_hours: 48,
          limit: 100,
        });
      const j = await fetch(url).then((r) => r.json());
      setLocalUpdates(j.updates || []);
    } catch (e) {
      setLocalUpdates([]);
    } finally {
      setLoadingLocal(false);
    }
  };

  const loadGlobalUpdates = async () => {
    setLoadingGlobal(true);
    try {
      const j = await fetch(UPDATES_GLOBAL_URL + "?limit=200").then((r) =>
        r.json()
      );
      setGlobalUpdates(j.updates || []);
    } catch (e) {
      setGlobalUpdates([]);
    } finally {
      setLoadingGlobal(false);
    }
  };

  // data loaders
  const loadReports = async () => {
    const fc = await fetch(REPORTS_URL)
      .then((r) => r.json())
      .catch(() => ({ type: "FeatureCollection", features: [] }));
    setReports(fc);
  };
  const loadFeeds = async () => {
    const [a, b, c, d] = await Promise.all([
      fetch(NWS_URL)
        .then((r) => r.json())
        .catch(() => null),
      fetch(USGS_URL)
        .then((r) => r.json())
        .catch(() => null),
      fetch(EONET_URL)
        .then((r) => r.json())
        .catch(() => null),
      fetch(FIRMS_URL)
        .then((r) => r.json())
        .catch(() => null),
    ]);
    setNws(a?.data || a || null);
    setQuakes(b?.data || b || null);
    setEonet(c?.data || c || null);
    setFirms(d?.data || d || null);
  };
  useEffect(() => {
    loadReports();
    loadFeeds();
  }, []);

  useEffect(() => {
    loadGlobalUpdates();
  }, []);
  useEffect(() => {
    if (selectedLL) loadLocalUpdates(selectedLL);
  }, [selectedLL]);

  // typing animation
  const typeOut = async (fullText: string) => {
    const step = fullText.length > 1200 ? 6 : fullText.length > 400 ? 3 : 1;
    const delayMs = fullText.length > 1200 ? 4 : fullText.length > 400 ? 8 : 15;
    let acc = "";
    let firstTokenSet = false;

    for (let i = 0; i < fullText.length; i += step) {
      acc = fullText.slice(0, i + step);
      setMessages((m) => {
        const out = [...m];
        for (let j = out.length - 1; j >= 0; j--) {
          if (out[j].role === "assistant") {
            out[j] = { ...out[j], text: acc };
            break;
          }
        }
        return out;
      });
      if (!firstTokenSet && acc.length > 0) {
        setHasFirstToken(true);
        firstTokenSet = true;
      }
      scrollToBottom();
      await new Promise((r) => setTimeout(r, delayMs));
    }
    setIsStreaming(false);
    setHasFirstToken(true);
    scrollToBottom();
  };

  // stable session id
  const [sessionId] = React.useState(() => {
    const existing = localStorage.getItem("pulsemaps_session");
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem("pulsemaps_session", fresh);
    return fresh;
  });

  const selectPoint = (ll: [number, number], meta: SelectMeta) => {
    setSelectedLL(ll);
    setSelectedMeta(meta);
  };

  const send = async () => {
    const text = draft.trim();
    if (!text) return;

    // add user's message to chat with inline image preview
    setMessages((m) => [
      ...m,
      { role: "user", text, image: attached || undefined },
    ]);
    setDraft("");
    setTimeout(scrollToBottom, 0);

    setIsStreaming(true);
    setHasFirstToken(false);
    setMessages((m) => [...m, { role: "assistant", text: "" }]);
    setTimeout(scrollToBottom, 0);

    const attached = pendingPhotoUrl; // capture now (see #3)
    setPendingPhotoUrl(null); // clear immediately (see #3)

    let finalText = text;
    if (selectedLL) {
      // Make coords explicit so the LLM must use them
      finalText += `\n\n[COORDS lat=${selectedLL[0]} lon=${selectedLL[1]}]`;
    }

    const payload: any = { message: finalText, session_id: sessionId };
    if (selectedLL)
      payload.user_location = { lat: selectedLL[0], lon: selectedLL[1] };
    if (attached) payload.photo_url = attached;

    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .catch(() => ({ reply: "Something went wrong." }));

    await typeOut(res.reply || "(no reply)");
    if (res.tool_used === "add_report") await loadReports();
    setPendingPhotoUrl(null);
  };

  // ---- UI ----
  return (
    <div className="shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">PM</div>
          <div className="title">PulseMap Agent</div>
        </div>

        <div className="block">
          <label className="label">Selected location</label>
          <div className="locationCard">
            {selectedLL ? (
              <>
                {/* Header: icon/emoji + title */}
                <div className="locName flex items-center gap-2">
                  {/* For user reports, use your Lucide-based ReportIcon if we have a name */}
                  {selectedMeta?.kind === "report" &&
                  (selectedMeta.emoji || selectedMeta.raw?.emoji) ? (
                    <div className="inline-flex items-center justify-center bg-white rounded-full p-1 shadow border">
                      <ReportIcon
                        name={
                          (selectedMeta.emoji ||
                            selectedMeta.raw?.emoji) as string
                        }
                        size={18}
                      />
                    </div>
                  ) : selectedMeta?.emoji ? (
                    <span style={{ fontSize: 18, lineHeight: "18px" }}>
                      {selectedMeta.emoji}
                    </span>
                  ) : null}
                  <span>{selectedMeta?.title || "Selected"}</span>
                </div>

                {/* Optional subtitle (e.g., search address) */}
                {selectedMeta?.subtitle && (
                  <div className="muted">{selectedMeta.subtitle}</div>
                )}

                {/* Coordinates */}
                <div className="locLL">
                  {selectedLL[0].toFixed(4)}, {selectedLL[1].toFixed(4)}
                </div>

                {/* Details (uniform for reports + natural feeds) */}
                <div className="mt-2 text-sm space-y-1">
                  {/* Category */}
                  {selectedMeta?.category || selectedMeta?.raw?.category ? (
                    <div>
                      <b>Category:</b>{" "}
                      {selectedMeta.category || selectedMeta.raw?.category}
                    </div>
                  ) : null}

                  {/* Severity (fallback to raw) */}
                  {selectedMeta?.severity !== undefined ||
                  selectedMeta?.raw?.severity !== undefined ? (
                    <div>
                      <b>Severity/Mag:</b>{" "}
                      {String(
                        selectedMeta?.severity ?? selectedMeta?.raw?.severity
                      )}
                    </div>
                  ) : null}

                  {/* Confidence: for officials default to 1; for user reports use provided */}
                  <div>
                    <b>Confidence:</b>{" "}
                    {(() => {
                      const k = selectedMeta?.kind;
                      const fromMeta =
                        selectedMeta?.confidence ??
                        selectedMeta?.raw?.confidence;
                      const official =
                        k && ["nws", "quake", "eonet", "fire"].includes(k);
                      const val = fromMeta ?? (official ? 1 : undefined);
                      return val !== undefined ? String(val) : "—";
                    })()}
                  </div>

                  {/* Source (string) */}
                  {selectedMeta?.raw?.source ? (
                    <div>
                      <b>Source:</b> {selectedMeta.raw.source}
                    </div>
                  ) : selectedMeta?.kind &&
                    ["nws", "quake", "eonet", "fire"].includes(
                      selectedMeta.kind
                    ) ? (
                    <div>
                      <b>Source:</b> {selectedMeta.kind.toUpperCase()}
                    </div>
                  ) : null}

                  {/* Source link */}
                  {selectedMeta?.sourceUrl && (
                    <div>
                      <a
                        href={selectedMeta.sourceUrl}
                        className="link"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Source
                      </a>
                    </div>
                  )}
                </div>

                {/* Photo preview if available (user report) */}
                {selectedMeta &&
                  (selectedMeta.raw?.photo_url ||
                    (selectedMeta as any)?.photo_url) && (
                    <div
                      className="mt-2"
                      style={{ maxHeight: 220, overflow: "auto" }}
                    >
                      <img
                        src={
                          selectedMeta.raw?.photo_url ||
                          (selectedMeta as any).photo_url
                        }
                        alt="Attached"
                        style={{
                          width: "100%",
                          height: "auto",
                          borderRadius: 8,
                          objectFit: "contain",
                          display: "block",
                        }}
                      />
                    </div>
                  )}
              </>
            ) : (
              <div className="locDetecting">
                Use search, 📍, or click the map.
              </div>
            )}

            <div className="hint">
              Only one point is active. Drag 📍 to fine-tune; chat uses this
              point.
            </div>

            {selectedLL && (
              <div className="mt-2">
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setSelectedLL(null);
                    setSelectedMeta(null);
                  }}
                >
                  Clear selection
                </button>
              </div>
            )}
          </div>
        </div>

        <div
          className="block"
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          <div className="tabs" style={{ flex: "0 0 auto" }}>
            <button
              className={`tab ${activeTab === "local" ? "tab-active" : ""}`}
              onClick={() => setActiveTab("local")}
            >
              Local updates
            </button>
            <button
              className={`tab ${activeTab === "global" ? "tab-active" : ""}`}
              onClick={() => setActiveTab("global")}
            >
              Global updates
            </button>
          </div>

          {/* The scroll area is fixed-height and won’t resize the map */}
          <div
            className="updates"
            style={{
              flex: "0 0 auto",
              height: "50vh", // tweak as you like (e.g., 36vh on small screens)
              overflowY: "auto",
              overflowX: "hidden",
              paddingRight: 4, // small breathing room so scrollbar doesn’t overlap
            }}
            onWheel={(e) => {
              // keep wheel scrolling contained in this list (optional)
              e.stopPropagation();
            }}
          >
            {activeTab === "local" ? (
              <>
                {!selectedLL && (
                  <div className="muted">
                    Pick a point (search/📍/click) to load local updates within
                    25 miles (last 48h).
                  </div>
                )}
                {selectedLL && loadingLocal && (
                  <div className="muted">Loading local updates…</div>
                )}
                {selectedLL && !loadingLocal && localUpdates.length === 0 && (
                  <div className="muted">No recent updates here.</div>
                )}
                {selectedLL &&
                  localUpdates.map((u, i) => (
                    <div className="updateItem" key={`lu-${i}`}>
                      <div className="flex items-center gap-2">
                        <div className="text-xl">{u.emoji}</div>
                        <div className="flex-1">
                          <div className="font-medium">{u.title}</div>
                          <div className="text-xs muted">
                            {formatAgo(u.time)} · {u.kind}
                            {u.severity ? <> · {String(u.severity)}</> : null}
                          </div>
                          {u.sourceUrl && (
                            <div className="text-xs">
                              <a
                                className="link"
                                href={u.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Source
                              </a>
                            </div>
                          )}
                        </div>
                        <button
                          className="btn btn-ghost"
                          onClick={() =>
                            selectPoint([u.lat, u.lon], {
                              kind: u.kind as any,
                              title: u.title,
                              severity: u.severity,
                              sourceUrl: u.sourceUrl,
                            })
                          }
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))}
              </>
            ) : (
              <>
                {loadingGlobal && (
                  <div className="muted">Loading global updates…</div>
                )}
                {!loadingGlobal && globalUpdates.length === 0 && (
                  <div className="muted">No global updates right now.</div>
                )}
                {!loadingGlobal &&
                  globalUpdates.map((u, i) => (
                    <div className="updateItem" key={`gu-${i}`}>
                      <div className="flex items-center gap-2">
                        <div className="text-xl">{u.emoji}</div>
                        <div className="flex-1">
                          <div className="font-medium">{u.title}</div>
                          <div className="text-xs muted">
                            {formatAgo(u.time)} · {u.kind}
                            {u.severity ? <> · {String(u.severity)}</> : null}
                          </div>
                          {u.sourceUrl && (
                            <div className="text-xs">
                              <a
                                className="link"
                                href={u.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Source
                              </a>
                            </div>
                          )}
                        </div>
                        <button
                          className="btn btn-ghost"
                          onClick={() =>
                            selectPoint([u.lat, u.lon], {
                              kind: u.kind as any,
                              title: u.title,
                              severity: u.severity,
                              sourceUrl: u.sourceUrl,
                            })
                          }
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))}
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        <section className="mapWrap" style={{ position: "relative" }}>
          <APIProvider apiKey={GMAPS_KEY} libraries={["places", "marker"]}>
            <Map
              className="map"
              mapId={MAP_ID}
              defaultCenter={{ lat: 39, lng: -98 }}
              defaultZoom={4}
              gestureHandling="greedy"
              disableDefaultUI={false}
            >
              <SearchControl onPlace={selectPoint} />
              <MyLocationControl onLocated={selectPoint} />
              <SingleSelect onPick={selectPoint} />
              <NWSDataLayer
                nws={nws}
                onSelect={(ll, meta) => selectPoint(ll, meta)}
              />

              {/* Single active selection marker (📍), draggable */}
              {selectedLL && (
                <EmojiMarker
                  position={{ lat: selectedLL[0], lng: selectedLL[1] }}
                  emoji="📍"
                  title={selectedMeta?.title || "Selected"}
                  draggable={true}
                  onDragEnd={(ll) =>
                    selectPoint(ll, { kind: "click", title: "Selected point" })
                  }
                />
              )}

              {/* USGS quakes = 💥 */}
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
                      selectPoint([lat, lng], {
                        kind: "quake",
                        title: "Earthquake at " + place,
                        severity: m !== null ? `M${m}` : undefined,
                        sourceUrl: src || undefined,
                        confidence: 1, // NEW
                        emoji: "💥", // NEW
                        raw: p,
                      })
                    }
                  />
                );
              })}

              {/* EONET events (generic) = ⚠️ */}
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
                      selectPoint([lat, lng], {
                        kind: "eonet",
                        title,
                        sourceUrl: src || undefined,
                        confidence: 1, // NEW
                        emoji, // NEW
                        raw: p,
                      })
                    }
                  />
                );
              })}

              {/* FIRMS hotspots = 🔥 */}
              {firms?.features?.map((f: any, i: number) => {
                const g = f.geometry;
                if (!g || g.type !== "Point") return null;
                const [lng, lat] = g.coordinates as [number, number];
                const p = f.properties || {};
                const title = "Fire hotspot";
                const sev = p.confidence || p.brightness || p.frp || undefined;
                return (
                  <EmojiMarker
                    key={`fi-${i}`}
                    position={{ lat, lng }}
                    emoji="🔥"
                    title={title}
                    onClick={() =>
                      selectPoint([lat, lng], {
                        kind: "fire",
                        title,
                        severity: sev,
                        confidence: 1, // NEW
                        emoji: "🔥", // NEW
                        raw: p,
                      })
                    }
                  />
                );
              })}

              {/* User reports = 📝 */}
              {reports.features.map((f, i) => {
                if (f.geometry?.type !== "Point") return null;
                const [lng, lat] = f.geometry.coordinates as [number, number];
                const p = f.properties || {};
                const name = (p.icon ?? p.emoji ?? "info") as string;
                const title = p.text || p.title || "User report";
                // Use the default marker or provide a custom icon via the 'icon' prop if needed
                return (
                  <AdvancedMarker
                    key={`rp-${i}`}
                    position={{ lat, lng }}
                    title={title}
                    onClick={() =>
                      selectPoint([lat, lng], {
                        kind: "report",
                        title,
                        severity: p.severity, // NEW
                        confidence: p.confidence, // NEW
                        category: p.category, // NEW
                        emoji: p.emoji, // NEW (name string; used by ReportIcon)
                        raw: p,
                      })
                    }
                  >
                    {/* Styled badge for a professional look */}
                    <div className="bg-white rounded-full p-1 shadow-md border">
                      <ReportIcon name={name} size={18} />
                    </div>
                  </AdvancedMarker>
                );
              })}
            </Map>
          </APIProvider>
        </section>

        {/* Chat */}
        <section className="chat">
          <div className="chatHdr">Assistant</div>
          <div className="chatBody" ref={chatBodyRef}>
            {messages.length === 0 ? (
              <div className="muted">
                Try: “Flooded underpass here”, or “List reports near me”.
              </div>
            ) : (
              messages.map((m, idx) => (
                <div key={idx} className={`msg ${m.role}`}>
                  {isStreaming &&
                  !hasFirstToken &&
                  idx === messages.length - 1 &&
                  m.role === "assistant" ? (
                    <div className="pointer-events-none relative top-1 translate-y-1 z-20">
                      <TypingDots />
                    </div>
                  ) : (
                    <>
                      {m.text}
                      {m.image && (
                        <div style={{ marginTop: 8 }}>
                          <img
                            src={m.image}
                            alt="attachment"
                            style={{
                              maxWidth: "220px",
                              maxHeight: "220px",
                              borderRadius: 8,
                              objectFit: "cover",
                              display: "block",
                            }}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="chatInputRow">
            <input
              className="input-chat"
              placeholder="Type a message…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFileChosen(f);
              }}
            />

            {/* Attach / uploading indicator */}
            <button
              className="btn btn-ghost"
              onClick={pickPhoto}
              disabled={isUploading}
            >
              {isUploading ? "Uploading…" : "Attach"}
            </button>

            {/* Tiny thumbnail preview + clear */}
            {pendingPhotoUrl && (
              <div className="flex items-center gap-2 px-2">
                <img
                  src={pendingPhotoUrl}
                  alt="attachment"
                  style={{
                    width: 36,
                    height: 36,
                    objectFit: "cover",
                    borderRadius: 6,
                  }}
                />
                <button
                  className="btn btn-ghost"
                  onClick={() => setPendingPhotoUrl(null)}
                >
                  ✕
                </button>
              </div>
            )}

            <button className="btn" onClick={send}>
              Send
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
