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
    const btn = document.createElement("button");
    btn.setAttribute("aria-label", "My location");
    btn.style.width = "40px";
    btn.style.height = "40px";
    btn.style.borderRadius = "50%";
    btn.style.background = "#fff";
    btn.style.border = "0";
    btn.style.cursor = "pointer";
    btn.style.boxShadow = "0 1px 4px rgba(0,0,0,.3)";
    btn.style.display = "flex";
    btn.style.alignItems = "center";
    btn.style.justifyContent = "center";
    btn.style.fontSize = "18px";
    btn.style.marginRight = "10px";
    btn.textContent = "📌";

    map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(btn);

    let locating = false;
    const click = () => {
      if (locating) return;
      locating = true;

      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          locating = false;
          const ll: [number, number] = [
            pos.coords.latitude,
            pos.coords.longitude,
          ];
          map.setCenter({ lat: ll[0], lng: ll[1] });
          map.setZoom(13);
          onLocated(ll, { kind: "mylocation", title: "My location" });
        },
        () => {
          locating = false;
        },
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
