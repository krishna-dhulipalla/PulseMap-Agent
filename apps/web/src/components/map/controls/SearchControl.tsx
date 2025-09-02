import React from "react";
import { useMap } from "@vis.gl/react-google-maps";
import type { SelectMeta } from "../../../lib/types";

export default function SearchControl({
  onPlace,
}: {
  onPlace: (ll: [number, number], meta: SelectMeta) => void;
}) {
  const map = useMap();
  const onPlaceRef = React.useRef(onPlace);
  React.useEffect(() => {
    onPlaceRef.current = onPlace;
  }, [onPlace]);

  React.useEffect(() => {
    if (!map || !window.google) return;
    const container = document.createElement("div");
    Object.assign(container.style, {
      background: "#fff",
      borderRadius: "8px",
      boxShadow: "0 1px 4px rgba(0,0,0,.3)",
      margin: "10px",
      padding: "4px",
    });

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Search places…";
    input.setAttribute("aria-label", "Search places");
    Object.assign(input.style, {
      border: "0",
      outline: "0",
      padding: "10px 12px",
      width: "260px",
      borderRadius: "6px",
    } as CSSStyleDeclaration);

    container.appendChild(input);
    map.controls[google.maps.ControlPosition.TOP_LEFT].push(container);

    const ac = new google.maps.places.Autocomplete(input, {
      fields: ["geometry", "name", "formatted_address"],
      types: ["geocode"],
    });
    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const loc = place?.geometry?.location;
      if (loc) {
        const ll: [number, number] = [loc.lat(), loc.lng()];
        map.setCenter({ lat: ll[0], lng: ll[1] });
        map.setZoom(12);
        onPlaceRef.current(ll, {
          kind: "search",
          title: place.name || "Search result",
          subtitle: place.formatted_address,
          raw: place,
        });
      }
    });

    return () => {
      google.maps.event.removeListener(listener);
      const arr = map.controls[google.maps.ControlPosition.TOP_LEFT];
      for (let i = 0; i < arr.getLength(); i++) {
        if (arr.getAt(i) === (container as any)) {
          arr.removeAt(i);
          break;
        }
      }
    };
  }, [map]);

  return null;
}
