# PulseMap Agent

PulseMap Agent is an AI-powered, map-based assistant for real-time community hazard reporting. It crowdsources local incident reports and merges them with official data feeds to build a shared, live picture of what is happening on the ground.

## Features
- Report hazards, crimes, accidents, or blocked roads by searching, using GPS, or clicking on the map.
- Upload photos; images are stored and linked to map markers.
- View live global hazard feeds from USGS earthquakes, National Weather Service alerts, NASA EONET events, and FIRMS fire hotspots.
- Chat with an AI assistant that decides when to add a report or fetch nearby reports, classifies incidents, assigns icons, and summarizes tool actions.
- Persistent conversation memory using SQLite so sessions survive page refreshes.
- Sidebar presents report cards with titles, categories, severity, confidence, sources, and attached images.

## Project structure
- `apps/api` – FastAPI backend that aggregates hazard feeds, manages reports, and exposes chat endpoints.
- `apps/web` – React + TypeScript frontend powered by Vite for the interactive map and UI.
- `packages` – Shared Python modules for agents, feeds, schemas, and utilities.
- `data` – Upload directory for user-submitted images.

## Getting started
### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### Installation
```bash
git clone <repo>
cd PulseMap-Agent
```
Install Python dependencies:
```bash
pip install fastapi uvicorn pydantic python-dateutil
```
Install web dependencies:
```bash
cd apps/web
npm install
```

## Running locally
Start the backend API:
```bash
uvicorn apps.api.main:app --reload
```
Start the frontend in another terminal:
```bash
cd apps/web
npm run dev
```
Open the printed URL (typically http://localhost:5173) to view the app.

## Contributing
Pull requests and issues are welcome. Please open an issue to discuss major changes before submitting.
