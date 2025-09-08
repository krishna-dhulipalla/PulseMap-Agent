export const GMAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
export const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
export const REPORTS_URL = `${API_BASE}/reports`;
export const CHAT_URL = `${API_BASE}/chat`;
export const NWS_URL = `${API_BASE}/feeds/nws`;
export const USGS_URL = `${API_BASE}/feeds/usgs`;
export const EONET_URL = `${API_BASE}/feeds/eonet`;
export const FIRMS_URL = `${API_BASE}/feeds/firms`;
export const UPLOAD_URL = `${API_BASE}/upload/photo`;
export const GEO_URL = `${API_BASE}/geo/tracts`;
// add:
export const REACTIONS_URL = `${API_BASE}/reports/reactions`;
export const REACT_URL = `${API_BASE}/reports`;

export const UPDATES_LOCAL_URL = `${API_BASE}/updates/local`;
export const UPDATES_GLOBAL_URL = `${API_BASE}/updates/global`;
