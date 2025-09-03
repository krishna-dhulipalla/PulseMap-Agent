import { useEffect } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import type { SelectMeta } from "../../../lib/types";

export default function SingleSelect({
  onPick,
}: {
  onPick: (ll: [number, number], meta: SelectMeta) => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    map.setOptions({ disableDoubleClickZoom: true });
    const onClick = map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      onPick([e.latLng.lat(), e.latLng.lng()], {
        kind: "click",
        title: "Selected point",
      });
    });
    const onDbl = map.addListener(
      "dblclick",
      (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        onPick([e.latLng.lat(), e.latLng.lng()], {
          kind: "click",
          title: "Selected point",
        });
      }
    );
    return () => {
      google.maps.event.removeListener(onClick);
      google.maps.event.removeListener(onDbl);
    };
  }, [map, onPick]);

  return null;
}
