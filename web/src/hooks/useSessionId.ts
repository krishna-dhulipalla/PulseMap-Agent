import { useState } from "react";
export const useSessionId = () => {
  const [sessionId] = useState(() => {
    const existing = localStorage.getItem("pulsemaps_session");
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    localStorage.setItem("pulsemaps_session", fresh);
    return fresh;
  });
  return sessionId;
};
