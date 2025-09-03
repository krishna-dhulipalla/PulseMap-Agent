import TypingDots from "./TypingDots";
import type { Message } from "../../lib/types";

export default function ChatPanel({
  messages,
  draft,
  setDraft,
  isStreaming,
  hasFirstToken,
  chatBodyRef,
  onSend,
  pendingThumb,
  onAttachClick,
  onClearAttach,
  isUploading,
}: {
  messages: Message[];
  draft: string;
  setDraft: (s: string) => void;
  isStreaming: boolean;
  hasFirstToken: boolean;
  chatBodyRef: React.RefObject<HTMLDivElement>;
  onSend: () => void;
  pendingThumb?: string | null;
  onAttachClick: () => void;
  onClearAttach: () => void;
  isUploading: boolean;
}) {
  return (
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
                          maxWidth: 220,
                          maxHeight: 220,
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
          onKeyDown={(e) => e.key === "Enter" && onSend()}
        />
        <button
          className="btn btn-ghost"
          onClick={onAttachClick}
          disabled={isUploading}
        >
          {isUploading ? "Uploading…" : "Attach"}
        </button>
        {pendingThumb && (
          <div className="flex items-center gap-2 px-2">
            <img
              src={pendingThumb}
              alt="attachment"
              style={{
                width: 36,
                height: 36,
                objectFit: "cover",
                borderRadius: 6,
              }}
            />
            <button className="btn btn-ghost" onClick={onClearAttach}>
              ✕
            </button>
          </div>
        )}
        <button className="btn" onClick={onSend}>
          Send
        </button>
      </div>
    </section>
  );
}
