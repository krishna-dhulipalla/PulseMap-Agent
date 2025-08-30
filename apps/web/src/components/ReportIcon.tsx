// components/ReportIcon.tsx
import React from "react";
import * as Lucide from "lucide-react";

type LucideIconComp = React.ComponentType<{
  size?: number;
  strokeWidth?: number;
  className?: string;
}>;

// Map backend keys (or emojis you might still send) to real Lucide export names
const NAME_ALIASES: Record<string, string[]> = {
  // canonical key -> list of Lucide export names to try (in order)
  gun: ["Siren", "ShieldAlert", "AlertTriangle"],
  "car-accident": ["Car", "CarFront"],
  ambulance: ["Ambulance"],
  "traffic-cone": ["TrafficCone"],
  construction: ["Construction", "Hammer", "Wrench"],
  "help-circle": ["HelpCircle", "CircleHelp"],
  "alert-triangle": ["AlertTriangle", "TriangleAlert"],
  info: ["Info", "CircleInfo"],
  "user-x": ["UserX"],
  "user-search": ["UserSearch", "UserRoundSearch"],
  "shield-alert": ["ShieldAlert", "Shield"],
  eye: ["Eye"],
  search: ["Search"],
};

// Turn "alert-triangle" -> "AlertTriangle"
function kebabToPascal(name: string) {
  return (
    name.charAt(0).toUpperCase() +
    name.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase())
  );
}

export function ReportIcon({
  name = "info",
  size = 20,
}: {
  name?: string;
  size?: number;
}) {
  const key = (name || "info").toLowerCase();

  const candidates: string[] = [
    kebabToPascal(key), // try direct pascal case first
    ...(NAME_ALIASES[key] ?? []), // then aliases
  ];

  let Icon: LucideIconComp | undefined;
  for (const c of candidates) {
    const comp = (Lucide as Record<string, LucideIconComp | undefined>)[c];
    if (comp) {
      Icon = comp;
      break;
    }
  }

  if (!Icon) {
    Icon = (Lucide as any).Info || (Lucide as any).HelpCircle;
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(
        `[ReportIcon] Unknown icon name '${name}'. Tried: ${candidates.join(
          ", "
        )}. Using Info.`
      );
    }
  }

  return <Icon size={size} strokeWidth={2} />;
}
