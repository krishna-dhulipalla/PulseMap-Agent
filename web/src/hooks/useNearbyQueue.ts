import * as React from "react";
import type { UpdateItem, ReactionInfo } from "../lib/types";

export type NearbyQueueOptions = {
  limit?: number; // max items to show in one run (default 5)
  storageNamespace?: string; // localStorage key prefix
};

function readSeenSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeSeenSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    // ignore quota errors
  }
}

export function useNearbyQueue(
  nearby: UpdateItem[],
  reactionsById: Record<string, ReactionInfo>,
  sessionId: string,
  onReact: (rid: string, action: "verify" | "clear") => void | Promise<void>,
  opts: NearbyQueueOptions = {}
) {
  const { limit = 5, storageNamespace = "pm_seen_v1" } = opts;
  const storageKey = React.useMemo(
    () => `${storageNamespace}:${sessionId || "anon"}`,
    [storageNamespace, sessionId]
  );

  // persistent set of rids shown to the user in this session
  const seenRef = React.useRef<Set<string>>(readSeenSet(storageKey));
  React.useEffect(() => {
    // if sessionId changes, reload the seen set
    seenRef.current = readSeenSet(storageKey);
  }, [storageKey]);

  const [queue, setQueue] = React.useState<UpdateItem[]>([]);
  const [index, setIndex] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);

  // build a fresh queue whenever inputs change
  React.useEffect(() => {
    const out: UpdateItem[] = [];
    for (const u of nearby) {
      if (!u || u.kind !== "report" || !u.rid) continue;
      const r = reactionsById[u.rid];
      const already = !!(r?.me?.verified || r?.me?.cleared);
      if (already) continue; // don't nag if already handled this session
      if (seenRef.current.has(u.rid)) continue; // don't re-show in this session
      out.push(u);
      if (out.length >= limit) break;
    }
    setQueue(out);
    setIndex(0);
    setLeaving(false);
  }, [nearby, reactionsById, limit]);

  const current = queue[index] || null;
  const total = queue.length;

  const markSeen = React.useCallback(
    (rid?: string | null) => {
      if (!rid) return;
      if (!seenRef.current.has(rid)) {
        seenRef.current.add(rid);
        writeSeenSet(storageKey, seenRef.current);
      }
    },
    [storageKey]
  );

  const advance = React.useCallback(() => {
    setIndex((i) => {
      const next = i + 1;
      return next < total ? next : i;
    });
  }, [total]);

  const openQueue = React.useCallback(() => {
    if (total > 0) setOpen(true);
  }, [total]);

  const closeQueue = React.useCallback(() => {
    // fully dismiss: stop animations, clear queue, reset index
    setOpen(false);
    setLeaving(false);
    setQueue([]);
    setIndex(0);
  }, []);

  // unified action handler with small exit animation
  async function act(action: "verify" | "clear" | "skip") {
    if (!current) return;
    const rid = current.rid!;
    setLeaving(true);
    if (action === "verify" || action === "clear") {
      try {
        await onReact(rid, action);
      } catch {
        // ignore; reconcile via hydration later
      }
    }
    // mark as seen so we won't show it again
    markSeen(rid);
    // wait for the CSS transition (keep in sync with component styles)
    await new Promise((r) => setTimeout(r, 220));

    // move to next or close
    if (index + 1 < total) {
      setLeaving(false);
      setIndex((i) => i + 1);
    } else {
      // last one: clear queue so it won't auto-reopen
      setQueue([]);
      setIndex(0);
      closeQueue();
    }
  }

  const verify = React.useCallback(() => act("verify"), [current, act]);
  const clear = React.useCallback(() => act("clear"), [current, act]);
  const skip = React.useCallback(() => act("skip"), [current, act]);

  return {
    // state
    open,
    leaving,
    current,
    index,
    total,
    queue,
    // actions
    openQueue,
    closeQueue,
    verify,
    clear,
    skip,
    // helpers
    markSeen,
  } as const;
}
