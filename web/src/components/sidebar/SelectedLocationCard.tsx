import type { SelectMeta } from "../../lib/types";

const isEmoji = (s: string) => !!s && /\p{Extended_Pictographic}/u.test(s);
const cleanTitle = (t?: string) => {
  if (!t) return t;
  return t
    .replace(/^(?:[a-z0-9]+-){1,3}(?=[A-Z])/i, "") // slug stuck to title (no space)
    .replace(/^(?:[a-z0-9]+-){1,3}\s+/i, ""); // slug + space
};

export default function SelectedLocationCard({
  selectedLL,
  selectedMeta,
  onClear,
}: {
  selectedLL: [number, number] | null;
  selectedMeta: SelectMeta | null;
  onClear: () => void;
}) {
  const photoSrc =
    selectedMeta?.raw?.photo_url ??
    selectedMeta?.raw?.photoUrl ??
    selectedMeta?.raw?.image_url ??
    selectedMeta?.raw?.imageUrl ??
    (selectedMeta as any)?.photo_url ??
    (selectedMeta as any)?.photoUrl ??
    null;

  const showEmoji =
    selectedMeta?.emoji && isEmoji(String(selectedMeta.emoji))
      ? String(selectedMeta.emoji)
      : null;

  const displayTitle = cleanTitle(selectedMeta?.title) || "Selected";

  return (
    <div className="block">
      <label className="label">Selected location</label>
      <div className="locationCard">
        {selectedLL ? (
          <>
            <div className="locName flex items-center gap-2">
              {showEmoji ? (
                <span style={{ fontSize: 18, lineHeight: "18px" }}>
                  {showEmoji}
                </span>
              ) : null}
              <span>{displayTitle}</span>
            </div>

            {selectedMeta?.subtitle && (
              <div className="muted">{selectedMeta.subtitle}</div>
            )}

            <div className="locLL">
              {selectedLL[0].toFixed(4)}, {selectedLL[1].toFixed(4)}
            </div>

            <div className="mt-2 text-sm space-y-1">
              {(selectedMeta?.category || selectedMeta?.raw?.category) && (
                <div>
                  <b>Category:</b>{" "}
                  {selectedMeta.category || selectedMeta.raw?.category}
                </div>
              )}
              {(selectedMeta?.severity !== undefined ||
                selectedMeta?.raw?.severity !== undefined) && (
                <div>
                  <b>Severity/Mag:</b>{" "}
                  {String(
                    selectedMeta?.severity ?? selectedMeta?.raw?.severity
                  )}
                </div>
              )}
              <div>
                <b>Confidence:</b>{" "}
                {(() => {
                  const k = selectedMeta?.kind;
                  const fromMeta =
                    selectedMeta?.confidence ?? selectedMeta?.raw?.confidence;
                  const official =
                    k && ["nws", "quake", "eonet", "fire"].includes(k);
                  const val = fromMeta ?? (official ? 1 : undefined);
                  return val !== undefined ? String(val) : "—";
                })()}
              </div>
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
          </>
        ) : (
          <div className="locDetecting">Use search, 📍, or click the map.</div>
        )}

        {photoSrc && (
          <div className="mt-2" style={{ maxHeight: 220, overflow: "auto" }}>
            <img
              src={photoSrc}
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

        <div className="hint">
          Only one point is active. Drag 📍 to fine-tune; chat uses this point.
        </div>

        {selectedLL && (
          <div className="mt-2">
            <button className="btn btn-ghost" onClick={onClear}>
              Clear selection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
