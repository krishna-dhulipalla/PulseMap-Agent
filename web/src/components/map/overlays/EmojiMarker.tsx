import { AdvancedMarker, Marker } from "@vis.gl/react-google-maps";

export default function EmojiMarker(props: {
  position: google.maps.LatLngLiteral;
  emoji: string;
  title?: string;
  draggable?: boolean;
  onDragEnd?: (ll: [number, number]) => void;
  onClick?: () => void;
}) {
  const {
    position,
    emoji,
    title,
    draggable = false,
    onDragEnd,
    onClick,
  } = props;
  const hasAdvanced =
    typeof window !== "undefined" &&
    !!(window as any).google?.maps?.marker?.AdvancedMarkerElement;

  if (hasAdvanced) {
    return (
      <AdvancedMarker
        position={position}
        draggable={draggable as any}
        onDragEnd={(e: any) => {
          if (onDragEnd && e.latLng)
            onDragEnd([e.latLng.lat(), e.latLng.lng()]);
        }}
        onClick={onClick}
        zIndex={100}
      >
        <div
          title={title}
          style={{
            fontSize: "24px",
            lineHeight: "24px",
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,.35))",
            cursor: onClick ? "pointer" : "default",
            userSelect: "none",
          }}
        >
          {emoji}
        </div>
      </AdvancedMarker>
    );
  }

  return (
    <Marker
      position={position}
      label={emoji}
      draggable={draggable}
      onDragEnd={(e) => {
        if (onDragEnd && e.latLng) onDragEnd([e.latLng.lat(), e.latLng.lng()]);
      }}
      onClick={onClick}
      title={title}
    />
  );
}
