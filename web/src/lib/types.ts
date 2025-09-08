export type Feature = {
  type: "Feature";
  geometry: { type: "Point" | "Polygon" | "MultiPolygon"; coordinates: any };
  properties: Record<string, any>;
};
export type FC = { type: "FeatureCollection"; features: Feature[] };

export type SelectMeta = {
  kind:
    | "search"
    | "mylocation"
    | "click"
    | "quake"
    | "fire"
    | "eonet"
    | "report"
    | "nws";
  title?: string;
  subtitle?: string;
  severity?: string | number;
  sourceUrl?: string;
  confidence?: number;
  emoji?: string;
  category?: string;
  raw?: any;
  id?: string;
  rid?: string;
};

export type Message = {
  role: "user" | "assistant";
  text: string;
  image?: string;
};

export type ReactionInfo = {
  verify_count: number;
  clear_count: number;
  me: { verified: boolean; cleared: boolean };
};

export type UpdateItem = {
  kind: "report" | "quake" | "nws" | "eonet" | "fire";
  title: string;
  emoji: string;
  time: string;
  lat: number;
  lon: number;
  severity?: string | number;
  sourceUrl?: string;
  rid?: string;
};
