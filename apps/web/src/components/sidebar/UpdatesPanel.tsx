import type { UpdateItem } from "../../lib/types";
import { formatAgo } from "../../lib/utils";

export default function UpdatesPanel({
  activeTab,
  setActiveTab,
  localUpdates,
  globalUpdates,
  loadingLocal,
  loadingGlobal,
  selectedLL,
  onView,
}: {
  activeTab: "local" | "global";
  setActiveTab: (t: "local" | "global") => void;
  localUpdates: UpdateItem[];
  globalUpdates: UpdateItem[];
  loadingLocal: boolean;
  loadingGlobal: boolean;
  selectedLL: [number, number] | null;
  onView: (u: UpdateItem) => void;
}) {
  const renderList = (
    list: UpdateItem[],
    loading: boolean,
    emptyMsg: string
  ) => (
    <>
      {loading && <div className="muted">Loading…</div>}
      {!loading && list.length === 0 && <div className="muted">{emptyMsg}</div>}
      {!loading &&
        list.map((u, i) => (
          <div className="updateItem" key={`${activeTab}-${i}`}>
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
              <button className="btn btn-ghost" onClick={() => onView(u)}>
                View
              </button>
            </div>
          </div>
        ))}
    </>
  );

  return (
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
      <div
        className="updates"
        style={{
          flex: "0 0 auto",
          height: "50vh",
          overflowY: "auto",
          overflowX: "hidden",
          paddingRight: 4,
        }}
        onWheel={(e) => e.stopPropagation()}
      >
        {activeTab === "local" ? (
          selectedLL ? (
            renderList(localUpdates, loadingLocal, "No recent updates here.")
          ) : (
            <div className="muted">
              Pick a point (search/📍/click) to load local updates within 25
              miles (last 48h).
            </div>
          )
        ) : (
          renderList(
            globalUpdates,
            loadingGlobal,
            "No global updates right now."
          )
        )}
      </div>
    </div>
  );
}
