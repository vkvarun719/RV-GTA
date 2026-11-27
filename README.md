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

## World Streaming Architecture (`src/world/`)
- `WorldCoordinateSystem.ts` — Local ENU coordinates anchored at RVITM (`12.8729154, 77.5757331`) and 500 m × 500 m chunk indexing.
- `WorldAssetLoader.ts` — Fetches `/world/generated/manifest.json` and chunk `.glb` files with in-flight deduplication.
- `WorldChunkManager.ts` — Streams chunks in/out based on player position (`loadRadiusM = 900`, `unloadRadiusM = 1300`) and disposes unloaded meshes.
- `WorldCollisionManager.ts` — Registers and removes Rapier static `trimesh` colliders for streamed building geometry.
- `WorldStreamer.ts` — Coordinates the single 4 km × 4 km terrain plane and chunk streaming in `src/main.ts`.
- `FriendNpcManager.ts` & `CollectiblesManager.ts` — 7 interactive RVITM student friends (`[E]`) and 6 hidden Golden RVITM Badges (`₹100` each).

To refresh OpenStreetMap roads and building footprints around RVITM (`src/data/campus-osm.json`), generate `public/world/generated/world.glb`, split into 500 m spatial chunks, and validate:
```bash
npm run fetch-osm
npm run generate-world
npm run split-world-chunks
npm run validate-world
# Or run all four in sequence:
npm run build-world
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
