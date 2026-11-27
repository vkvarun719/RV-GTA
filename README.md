# Namma RVITM

A stylized low-poly 3D open-world browser game set at **RV Institute of Technology and Management (RVITM)** — Chaithanya Layout, 8th Phase, J.P. Nagar, Bengaluru (`12.8729154, 77.5757331`), with a real **2 km OpenStreetMap** world streamed around the player.

## Tech Stack
- **Vite + TypeScript**
- **Three.js (WebGL2)** with `InstancedMesh` props & capped shadows
- **@dimforge/rapier3d-compat** arcade physics
- **Tailwind CSS** HUD, Smartphone, Map, Cheat Terminal, Pause overlays
- **OpenStreetMap Overpass API** (`scripts/fetch-osm.mjs`) + **Open-Meteo** live weather

## Quick Start
```bash
npm ci
npm run dev        # http://localhost:5173
```

## World Pipeline (real 2 km)
```bash
npm run fetch-osm          # 2 km Overpass fetch (non-destructive; keeps old data on failure)
npm run generate-world     # -> public/world/generated/world.glb (19.08 MB, 264,911 tris)
npm run split-world-chunks # -> 80 spatial 500 m x 500 m chunks + manifest.json
npm run validate-world     # 15 checks (bounds, NaN, containment, geometry preservation)
# or all four:
npm run build-world
```

### World streaming (`src/world/`)
- `WorldCoordinateSystem.ts` — local ENU anchored at RVITM, 500 m chunk indexing.
- `WorldAssetLoader.ts` — fetches `manifest.json` + chunk `.glb` with in-flight dedup.
- `WorldChunkManager.ts` — streams chunks in/out (`loadRadiusM = 900`, `unloadRadiusM = 1300`), disposes unloaded GPU resources.
- `WorldCollisionManager.ts` — registers/removes Rapier `trimesh` building colliders per chunk.
- `WorldStreamer.ts` — single 4 km terrain plane + chunk streaming; `getStats()` for QA.
- Current dataset: **2,000 m radius, 10,255 buildings, 2,693 roads, 80 chunks**.

## Tests
```bash
npm test           # animation/grounded-state unit + source-guard tests (5/5)
npm run test:browser   # REAL headless Chrome: streaming, colliders, mechanics (23/23)
npm run build      # tsc && vite build
```
`test:browser` uses `puppeteer-core` to drive the system Google Chrome (software WebGL2). It verifies
boot, world streaming, collider register/remove, and core mechanics with **real keyboard events**, and
writes `BROWSER_SMOKE_REPORT.md` + `qa-screenshots/`. It does **not** verify missions or human feel.

## Controls
- `W/A/S/D` move / drive, `Mouse` (click to lock) camera, `Space` jump / handbrake, `Shift` sprint
- `F` enter/exit vehicle, `E` interact/talk/start mission, `H` horn
- `P` phone, `M` map, `~` cheat terminal, `O` photo mode, `B` clip recorder, `Esc` pause menu

## Cheat Codes (`~` or Phone Dialer)
`AUTOWALA` auto-rickshaw · `BULLET` bike · `TANKER` water tanker · `MALEBANTHU` rain · `MACHA` super speed/jump · `KASU` +₹10,000

## Manual playtest checklist (NOT auto-tested — do this on hardware)
> Automated tests cover boot/streaming/collision/mechanics but **not** missions, collectibles,
> dialogue, save/load, or hardware FPS. On your MacBook M4 Pro:
```bash
npm run preview   # http://localhost:4173
```
- [ ] Walk/sprint/jump; camera collision against walls.
- [ ] Enter/exit all 5 vehicles; accelerate, steer, reverse, brake; auto meter.
- [ ] Talk (`E`) to all 7 friends; collect all 6 Golden Badges (+₹100).
- [ ] Start a story mission, hit checkpoints, finish, collect reward; pause menu replay.
- [ ] Save export/import/reset; pause (Esc); photo mode (O); clip (B).
- [ ] Record FPS + memory (Chrome DevTools) at each campus landmark; report resolution/quality.

## Performance notes
- Target: MacBook M4 Pro 24 GB. Headless software FPS (~5–7) is **not** representative; measure on hardware.
- Initial JS bundle is ~5.52 MB (gzip 1.35 MB) because the 6.3 MB OSM JSON is inlined for the minimap.
  Recommended optimization: serve a roads-only minimap asset (not done, to avoid regressions).

## Deliverables
`NAMMA_RVITM_PHASE_2D.zip`, `NAMMA_RVITM_PHASE_2E_VISUAL_REALISM.zip`, `BUILD_STATUS.md`,
`FINAL_GAME_QA_REPORT.md`, `VISUAL_QA_REPORT.md`, `CHANGELOG.md`, `ASSET_LICENSES.md`,
`BROWSER_SMOKE_REPORT.md`.