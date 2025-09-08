import React from "react";
import "./style.css";
import type { FC, SelectMeta } from "./lib/types";
import { REPORTS_URL } from "./lib/constants";
import { useFeeds } from "./hooks/useFeeds";
import { useSessionId } from "./hooks/useSessionId";
import { useUpdates } from "./hooks/useUpdates";
import { useChat } from "./hooks/useChat";
import MapCanvas from "./components/map/MapCanvas";
import SelectedLocationCard from "./components/sidebar/SelectedLocationCard";
import UpdatesPanel from "./components/sidebar/UpdatesPanel";
import { useProximityAlerts } from "./hooks/useProximityAlerts";
import ChatPanel from "./components/chat/ChatPanel";
import type { ReactionInfo, UpdateItem } from "./lib/types";
import { REACTIONS_URL, REACT_URL } from "./lib/constants";
import { useNearbyQueue } from "./hooks/useNearbyQueue";
import NearbyAlertModal from "./components/modals/NearbyAlertModal";

export default function App() {
  const [selectedLL, setSelectedLL] = React.useState<[number, number] | null>(
    null
  );
  const [selectedMeta, setSelectedMeta] = React.useState<SelectMeta | null>(
    null
  );

  const [reports, setReports] = React.useState<FC>({
    type: "FeatureCollection",
    features: [],
  });

  const [reactionsById, setReactionsById] = React.useState<
    Record<string, ReactionInfo>
  >({});

  const { nws, quakes, eonet, firms } = useFeeds();

  const [myLL, setMyLL] = React.useState<[number, number] | null>(null);

  const sessionId = useSessionId();
  const {
    activeTab,
    setActiveTab,
    localUpdates,
    globalUpdates,
    loadingLocal,
    loadingGlobal,
  } = useUpdates(myLL);

  const {
    messages,
    draft,
    setDraft,
    isStreaming,
    hasFirstToken,
    chatBodyRef,
    send,
    pendingPhotoUrl,
    setPendingPhotoUrl,
    isUploading,
    onFileChosen,
  } = useChat(sessionId, selectedLL);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Try to get user location once at startup (silent fail if denied)
  React.useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setMyLL([pos.coords.latitude, pos.coords.longitude]),
      () => {}, // ignore errors; panel won't show without myLL
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 }
    );
  }, []);

  // Nearby alerts (2 miles, max 5)
  const {
    nearby,
    loading: loadingNearby,
    refetch: refetchNearby,
    setNearby,
  } = useProximityAlerts(myLL, { radiusMiles: 2, limit: 5, maxAgeHours: 48 });
  console.log("myLL:", myLL);

  const loadReports = React.useCallback(async () => {
    const fc = await fetch(REPORTS_URL)
      .then((r) => r.json())
      .catch(() => ({ type: "FeatureCollection", features: [] }));
    setReports(fc);
  }, []);

  // helper to hydrate reactions for the current lists
  const hydrateReactions = React.useCallback(
    async (items: UpdateItem[]) => {
      const ids = Array.from(
        new Set(items.map((u) => u.rid).filter(Boolean))
      ) as string[];
      if (ids.length === 0) return;
      const url = `${REACTIONS_URL}?ids=${ids.join(
        ","
      )}&session_id=${encodeURIComponent(sessionId)}`;
      const data = await fetch(url)
        .then((r) => r.json())
        .catch(() => ({}));
      setReactionsById((prev) => ({ ...prev, ...data }));
    },
    [sessionId]
  );

  // when updates change, hydrate reactions
  React.useEffect(() => {
    // hydrate both tabs so Selected card has data no matter the tab
    hydrateReactions(localUpdates);
    hydrateReactions(globalUpdates);
    hydrateReactions(nearby);
  }, [localUpdates, globalUpdates, nearby, hydrateReactions]);

  React.useEffect(() => {
    loadReports();
  }, [loadReports]);

  const selectPoint = React.useCallback(
    (ll: [number, number], meta: SelectMeta) => {
      if (meta?.kind === "mylocation") {
        setMyLL(ll); // anchor local updates to device location
      }
      setSelectedLL(ll);
      setSelectedMeta(meta);
    },
    []
  );

  const pickPhoto = React.useCallback(() => fileInputRef.current?.click(), []);
  const onSend = React.useCallback(async () => {
    const res = await send();
    if (res?.tool_used === "add_report") await loadReports();
  }, [send, loadReports]);

  // toggle handler (optimistic)
  const reactOnReport = React.useCallback(
    async (rid: string, action: "verify" | "clear") => {
      setReactionsById((prev) => {
        const cur = prev[rid] || {
          verify_count: 0,
          clear_count: 0,
          me: { verified: false, cleared: false },
        };
        const want = action === "verify" ? !cur.me.verified : !cur.me.cleared;

        const next: ReactionInfo = JSON.parse(JSON.stringify(cur));
        if (action === "verify") {
          if (want) {
            next.me.verified = true;
            next.verify_count += 1;
            if (next.me.cleared) {
              next.me.cleared = false;
              next.clear_count = Math.max(0, next.clear_count - 1);
            }
          } else {
            next.me.verified = false;
            next.verify_count = Math.max(0, next.verify_count - 1);
          }
        } else {
          if (want) {
            next.me.cleared = true;
            next.clear_count += 1;
            if (next.me.verified) {
              next.me.verified = false;
              next.verify_count = Math.max(0, next.verify_count - 1);
            }
          } else {
            next.me.cleared = false;
            next.clear_count = Math.max(0, next.clear_count - 1);
          }
        }
        return { ...prev, [rid]: next };
      });

      // commit to API; reconcile with truth
      try {
        const body = { action, value: true, session_id: sessionId };
        // Ensure "value" matches our intended state (toggle)
        const current = reactionsById[rid];
        const want =
          action === "verify" ? !current?.me.verified : !current?.me.cleared;
        body.value = want;
        // commit
        const j = await fetch(`${REACT_URL}/${encodeURIComponent(rid)}/react`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, value: want, session_id: sessionId }),
        }).then((r) => r.json());
        setReactionsById((prev) => ({ ...prev, [rid]: j }));
      } catch {
        // fallback re-hydrate
        const j = await fetch(
          `${REACTIONS_URL}?ids=${rid}&session_id=${encodeURIComponent(
            sessionId
          )}`
        )
          .then((r) => r.json())
          .catch(() => null);
        if (j && j[rid])
          setReactionsById((prev) => ({ ...prev, [rid]: j[rid] }));
      }
    },
    [sessionId, reactionsById]
  );

  const queue = useNearbyQueue(
    nearby,
    reactionsById,
    sessionId,
    reactOnReport,
    { limit: 5 }
  );
  React.useEffect(() => {
    if (!queue.open && queue.total > 0) queue.openQueue();
  }, [queue.open, queue.total]);

  const openedOnceRef = React.useRef(false);
  React.useEffect(() => {
    if (!openedOnceRef.current && queue.total > 0) {
      queue.openQueue();
      openedOnceRef.current = true;
    }
  }, [queue.total, queue.openQueue]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">PM</div>
          <div className="title">PulseMap Agent</div>
        </div>

        <SelectedLocationCard
          selectedLL={selectedLL}
          selectedMeta={selectedMeta}
          reactionsById={reactionsById}
          onClear={() => {
            setSelectedLL(null);
            setSelectedMeta(null);
          }}
        />

        <UpdatesPanel
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          localUpdates={localUpdates}
          globalUpdates={globalUpdates}
          loadingLocal={loadingLocal}
          loadingGlobal={loadingGlobal}
          selectedLL={myLL || selectedLL}
          onView={(u) =>
            selectPoint([u.lat, u.lon], {
              kind: u.kind as any,
              title: u.title,
              subtitle: (u as any).raw?.text || "",
              severity:
                typeof u.severity === "undefined" ? "" : String(u.severity),
              sourceUrl: u.sourceUrl,
              rid: u.rid, // <--- include rid for Selected card
            })
          }
          reactionsById={reactionsById}
          onReact={reactOnReport}
        />
      </aside>
      <NearbyAlertModal
        open={queue.open}
        leaving={queue.leaving}
        current={queue.current}
        index={queue.index}
        total={queue.total}
        myLL={myLL}
        onVerify={queue.verify}
        onClear={queue.clear}
        onSkip={queue.skip}
        onClose={queue.closeQueue}
      />

      <main className="main">
        <section className="mapWrap" style={{ position: "relative" }}>
          <MapCanvas
            selectedLL={selectedLL}
            selectedMeta={selectedMeta}
            setSelected={selectPoint}
            nws={nws}
            quakes={quakes}
            eonet={eonet}
            firms={firms}
            reports={reports}
          />
        </section>

        <ChatPanel
          messages={messages}
          draft={draft}
          setDraft={setDraft}
          isStreaming={isStreaming}
          hasFirstToken={hasFirstToken}
          chatBodyRef={chatBodyRef}
          onSend={onSend}
          pendingThumb={pendingPhotoUrl}
          onAttachClick={pickPhoto}
          onClearAttach={() => setPendingPhotoUrl(null)}
          isUploading={isUploading}
        />

        {/* hidden file input lives here */}
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
      </main>
    </div>
  );
}
