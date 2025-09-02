import { useEffect } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import type { SelectMeta } from "../../../lib/types";

export default function MyLocationControl({
  onLocated,
}: {
  onLocated: (ll: [number, number], meta: SelectMeta) => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const btn = document.createElement("div");
    btn.style.margin = "10px";
    btn.innerHTML = `<button aria-label="My location" style="width:40px;height:40px;border-radius:50%;background:#fff;border:0;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:18px;">📍</button>`;
    map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(btn);

    const click = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const ll: [number, number] = [
            pos.coords.latitude,
            pos.coords.longitude,
          ];
          map.setCenter({ lat: ll[0], lng: ll[1] });
          map.setZoom(13);
          onLocated(ll, { kind: "mylocation", title: "My location" });
        },
        undefined,
        { enableHighAccuracy: true }
      );
    };
    btn.addEventListener("click", click);

    return () => {
      btn.removeEventListener("click", click);
      const arr = map.controls[google.maps.ControlPosition.RIGHT_BOTTOM];
      for (let i = 0; i < arr.getLength(); i++) {
        if (arr.getAt(i) === (btn as any)) {
          arr.removeAt(i);
          break;
        }
      }
    };
  }, [map, onLocated]);

  return null;
}
