// components/map/controls/LegendControl.tsx
import { useEffect } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import { SEVERITY_COLORS } from "../../../lib/severity";

export default function LegendControl() {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const el = document.createElement("div");
    el.style.margin = "2px";
    el.style.padding = "6px 8px";
    el.style.borderRadius = "8px";
    el.style.background = "#fff";
    el.style.boxShadow = "0 1px 4px rgba(0,0,0,.3)";
    el.style.font = "10px/1.2 system-ui, sans-serif";
    el.innerHTML = `
      <div style="font-weight:600;margin-bottom:4px">Zone Severity</div>
      <div style="display:flex;gap:10px;align-items:center">
        <span style="display:inline-flex;align-items:center;gap:6px">
          <span style="width:10px;height:10px;background:${SEVERITY_COLORS[2]};opacity:.6;border-radius:2px;display:inline-block"></span> High
        </span>
        <span style="display:inline-flex;align-items:center;gap:6px">
          <span style="width:10px;height:10px;background:${SEVERITY_COLORS[1]};opacity:.6;border-radius:2px;display:inline-block"></span> Med
        </span>
        <span style="display:inline-flex;align-items:center;gap:6px">
          <span style="width:10px;height:10px;background:${SEVERITY_COLORS[0]};opacity:.6;border-radius:2px;display:inline-block"></span> Low
        </span>
      </div>
    `;
    map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(el);
    return () => {
      const arr = map.controls[google.maps.ControlPosition.LEFT_BOTTOM];
      for (let i = 0; i < arr.getLength(); i++) {
        if (arr.getAt(i) === (el as any)) {
          arr.removeAt(i);
          break;
        }
      }
    };
  }, [map]);
  return null;
}
