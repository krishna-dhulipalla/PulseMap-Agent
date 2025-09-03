import { useCallback, useEffect, useState } from "react";
import type { UpdateItem } from "../lib/types";
import { UPDATES_LOCAL_URL, UPDATES_GLOBAL_URL } from "../lib/constants";
import { toQuery } from "../lib/utils";

export function useUpdates(selectedLL: [number, number] | null) {
  const [activeTab, setActiveTab] = useState<"local" | "global">("local");
  const [localUpdates, setLocal] = useState<UpdateItem[]>([]);
  const [globalUpdates, setGlobal] = useState<UpdateItem[]>([]);
  const [loadingLocal, setLLoad] = useState(false);
  const [loadingGlobal, setGLoad] = useState(false);

  const loadLocal = useCallback(async (ll: [number, number]) => {
    setLLoad(true);
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
      setLocal(j.updates || []);
    } catch {
      setLocal([]);
    } finally {
      setLLoad(false);
    }
  }, []);

  const loadGlobal = useCallback(async () => {
    setGLoad(true);
    try {
      const j = await fetch(UPDATES_GLOBAL_URL + "?limit=200").then((r) =>
        r.json()
      );
      setGlobal(j.updates || []);
    } catch {
      setGlobal([]);
    } finally {
      setGLoad(false);
    }
  }, []);

  useEffect(() => {
    loadGlobal();
  }, [loadGlobal]);
  useEffect(() => {
    if (selectedLL) loadLocal(selectedLL);
  }, [selectedLL, loadLocal]);

  return {
    activeTab,
    setActiveTab,
    localUpdates,
    globalUpdates,
    loadingLocal,
    loadingGlobal,
  };
}
