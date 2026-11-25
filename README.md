# Namma RVITM 🛺🏫

A stylized low-poly 3D open-world browser game inspired by *Namma Benglooru* (`benglooru.com`), set at **RV Institute of Technology and Management (RVITM)** — Chaithanya Layout, 8th Phase, J.P. Nagar, Bengaluru (`12.8729154, 77.5757331`).

## Tech Stack
- **Vite + TypeScript**
- **Three.js (WebGL2)** with `InstancedMesh` props & capped `1024x1024` shadows
- **@dimforge/rapier3d-compat** arcade physics
- **Tailwind CSS** HUD, Smartphone, Map, Cheat Terminal, and Pause overlays
- **OpenStreetMap Overpass API** (`scripts/fetch-osm.mjs`) + **Open-Meteo API** live Bengaluru weather

## Quick Start
```bash
npm install
npm run dev
```

To refresh OpenStreetMap roads and building footprints around RVITM (`src/data/campus-osm.json`):
```bash
npm run fetch-osm
```

To build for production:
```bash
npm run build
```

## Controls
- `W / A / S / D` — Move on foot / Drive vehicles
- `Mouse` (click canvas to lock) — Third-person orbit/chase camera
- `Space` — Jump / Handbrake drift
- `Shift` — Sprint
- `F` — Enter / Exit nearest vehicle
- `E` — Interact / Start mission / Buy chai or snacks
- `H` — Vehicle horn (distinct scooter, auto, and bus horns)
- `P` — Smartphone (Side Gigs, Map directory, Cheat Dialer, Radio)
- `M` — Full Campus & JP Nagar 8th Phase Map
- `~` — Cheat Terminal
- `O` — Photo Mode (free camera + PNG snapshot)
- `B` — Save last 15s gameplay clip (`.webm`)
- `Esc` — Pause Menu (Mission Replay, Graphics Low/Med/High, Weather, Save Export/Import JSON)

## Kannada Cheat Codes (`~` or Phone Dialer)
- `AUTOWALA` — Spawns a yellow-green Auto-Rickshaw
- `BULLET` — Spawns a sport commuter bike
- `TANKER` — Spawns a Bengaluru Water Tanker
- `MALEBANTHU` — Triggers Bengaluru rain & wet road reflections
- `MACHA` — Super sprint speed + high jump
- `KASU` — Adds ₹10,000 cash
