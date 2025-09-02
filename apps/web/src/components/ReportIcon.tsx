// components/ReportIcon.tsx
import * as Lucide from "lucide-react";

const pascal = (s: string) =>
  s.replace(/(^\w|-\w)/g, (m) => m.replace("-", "").toUpperCase());

export function ReportIcon({
  name = "info",
  size = 32,
}: {
  name?: string;
  size?: number;
}) {
  const key = (name || "info").toLowerCase();

  // 3D local PNGs: name like "3d:police-light"
  if (key.startsWith("3d-")) {
    const file = key; // "police-light"
    return (
      <img
        src={`/icons/3d/${file}.png`}
        alt={file}
        width={size}
        height={size}
        loading="lazy"
        style={{ display: "block" }}
      />
    );
  }

  // fallback to your existing Lucide logic
  const Comp = (Lucide as any)[pascal(key)] ?? (Lucide as any).Info;
  return <Comp size={size} />;
}
