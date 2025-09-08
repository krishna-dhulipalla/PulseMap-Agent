import * as React from "react";
import type { UpdateItem } from "../../lib/types";
import { haversineMiles, timeAgo } from "../../lib/geo";

export type NearbyAlertModalProps = {
  open: boolean;
  leaving?: boolean;
  onClose: () => void;
  onVerify: () => void;
  onClear: () => void;
  onSkip: () => void;
  current: UpdateItem | null;
  index: number;
  total: number;
  myLL: [number, number] | null;
};

export default function NearbyAlertModal(props: NearbyAlertModalProps) {
  const {
    open,
    leaving,
    onClose,
    onVerify,
    onClear,
    onSkip,
    current,
    index,
    total,
    myLL,
  } = props;
  const cardRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  React.useEffect(() => {
    if (open && cardRef.current) {
      // focus first actionable element (Verify) for accessibility
      const btn = cardRef.current.querySelector<HTMLButtonElement>(
        "button[data-primary]"
      );
      btn?.focus();
    }
  }, [open, current]);

  if (!open || !current) return null;

  const dist = myLL ? haversineMiles(myLL, [current.lat, current.lon]) : null;
  const when = timeAgo(current.time);

  const raw: any = (current as any).raw || {};
  const thumb =
    raw.photo_url || raw.photoUrl || raw.image_url || raw.imageUrl || null;

  return (
    <div
      className="nearby-modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "grid",
        placeItems: "center",
        zIndex: 50,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        className={`nearby-modal-card ${leaving ? "leaving" : ""}`}
        style={{
          width: "min(92vw, 520px)",
          borderRadius: 16,
          background: "var(--card-bg, #111)",
          color: "var(--card-fg, #fff)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          overflow: "hidden",
          transform: leaving
            ? "translateY(-6px) scale(0.98)"
            : "translateY(0) scale(1)",
          opacity: leaving ? 0 : 1,
          transition: "transform .2s ease, opacity .2s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "12px 14px",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 20 }}>{current.emoji || "📍"}</div>
          <div style={{ fontWeight: 700, fontSize: 16, flex: 1 }}>
            {current.title || "Nearby alert"}
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            style={{
              background: "transparent",
              border: 0,
              color: "inherit",
              fontSize: 18,
              opacity: 0.8,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {thumb ? (
          <img
            src={thumb}
            alt=""
            style={{ width: "100%", height: 220, objectFit: "cover" }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}

        <div style={{ padding: "12px 14px", display: "grid", gap: 8 }}>
          <div style={{ opacity: 0.9, fontSize: 13 }}>
            Reported within <strong>2 miles</strong>
            {typeof dist === "number" ? (
              <>
                {" "}
                • approximately <strong>{dist.toFixed(1)} mi</strong> away
              </>
            ) : null}{" "}
            • {when}
          </div>
          {raw?.text ? (
            <div style={{ fontSize: 14, lineHeight: 1.35, opacity: 0.95 }}>
              {raw.text}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 12px 14px",
            gap: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              opacity: 0.8,
              fontSize: 12,
            }}
          >
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  display: "inline-block",
                  background: i === index ? "#fff" : "rgba(255,255,255,0.35)",
                }}
              />
            ))}
            <span style={{ marginLeft: 6 }}>
              {index + 1} of {total}
            </span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onClear}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
            <button
              data-primary
              onClick={onVerify}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: 0,
                background: "#4ade80",
                color: "#0b1",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Verify
            </button>
            <button
              onClick={onSkip}
              style={{
                padding: "8px 8px",
                borderRadius: 8,
                border: 0,
                background: "transparent",
                color: "inherit",
                opacity: 0.8,
                cursor: "pointer",
              }}
              title="Skip"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
