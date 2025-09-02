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
import ChatPanel from "./components/chat/ChatPanel";

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
  const { nws, quakes, eonet, firms } = useFeeds();

  const sessionId = useSessionId();
  const {
    activeTab,
    setActiveTab,
    localUpdates,
    globalUpdates,
    loadingLocal,
    loadingGlobal,
  } = useUpdates(selectedLL);

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

  const loadReports = React.useCallback(async () => {
    const fc = await fetch(REPORTS_URL)
      .then((r) => r.json())
      .catch(() => ({ type: "FeatureCollection", features: [] }));
    setReports(fc);
  }, []);

  React.useEffect(() => {
    loadReports();
  }, [loadReports]);

  const selectPoint = React.useCallback(
    (ll: [number, number], meta: SelectMeta) => {
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
          selectedLL={selectedLL}
          onView={(u) =>
            selectPoint([u.lat, u.lon], {
              kind: u.kind as any,
              title: u.title,
              subtitle: (u as any).raw?.text || "",
              severity:
                typeof u.severity === "undefined" ? "" : String(u.severity),
              sourceUrl: u.sourceUrl,
            })
          }
        />
      </aside>

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
