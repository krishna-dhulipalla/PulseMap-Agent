import { useCallback, useRef, useState } from "react";
import { CHAT_URL, UPLOAD_URL } from "../lib/constants";
import type { Message } from "../lib/types";

export function useChat(
  sessionId: string,
  selectedLL: [number, number] | null
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasFirstToken, setHasFirstToken] = useState(false);
  const [pendingPhotoUrl, setPendingPhotoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const chatBodyRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback(() => {
    const el = chatBodyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const typeOut = useCallback(
    async (fullText: string) => {
      const step = fullText.length > 1200 ? 6 : fullText.length > 400 ? 3 : 1;
      const delayMs =
        fullText.length > 1200 ? 4 : fullText.length > 400 ? 8 : 15;
      let firstTokenSet = false;
      for (let i = 0; i < fullText.length; i += step) {
        const acc = fullText.slice(0, i + step);
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
    },
    [scrollToBottom]
  );

  const onFileChosen = useCallback(async (file: File) => {
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(UPLOAD_URL, { method: "POST", body: fd }).then(
        (r) => r.json()
      );
      const url =
        res?.url ||
        (res?.path
          ? (import.meta.env.VITE_API_BASE || "http://localhost:8000") +
            res.path
          : "");
      if (url) setPendingPhotoUrl(url);
    } finally {
      setIsUploading(false);
    }
  }, []);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;

    const attached = pendingPhotoUrl; // capture now
    setPendingPhotoUrl(null); // clear immediately
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

    let finalText = text;
    if (selectedLL)
      finalText += `\n\n[COORDS lat=${selectedLL[0]} lon=${selectedLL[1]}]`;

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
    return res; // caller can react to tool_used (e.g., reload reports)
  }, [draft, pendingPhotoUrl, selectedLL, sessionId, scrollToBottom, typeOut]);

  return {
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
  };
}
