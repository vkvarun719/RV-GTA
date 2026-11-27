# NAMMA RVITM — Final Game QA Report

**Date**: 2026-11-26  
**Project**: `namma-rvitm` (Vite + TypeScript + Three.js + Rapier3D + Tailwind CSS)  
**Location**: `/Users/lucky/Desktop/gta rvitm`

---

## 1. Features Verified & Completed

- **3D Open-World Campus & JP Nagar 8th Phase (`src/world/`)**:
  - Real OpenStreetMap geometry (`src/data/campus-osm.json`) for RVITM campus parcel, compound walls, main gate with animated boom barrier, 7-floor Academic Block, Central Courtyard with animated flagpole, Canteen, Student Parking, Basketball Court, Cricket Practice Turf, and surrounding 80 Feet Road / Brookes Haven / Chaithanya Layout roads & buildings.
  - Parody hangout spots opposite the main gate (*Goli Chai & Bun Tapri*, *Benglooru Xerox & Records*, *Filter Kaapi & Toast Cafe*, *80 Ft Rd BMTC Bus Stop*).
  - Instanced green & Gulmohar flame trees and street lamps (`InstancedProps.ts`).
  - All 9 real RVITM facility & logo assets in `public/refs/` verified serving with HTTP 200.
- **Player & Camera (`src/player/`)**:
  - Third-person `WASD` movement, `Shift` sprint, `Space` jump, mouse-locked orbit/chase camera with Rapier raycast wall-avoidance, limb animation, footsteps, `MACHA` super-speed/jump mode, and out-of-bounds respawn guard.
- **5 Drivable Vehicles & AI Traffic (`src/vehicles/`)**:
  - **Activa Campus Scooter**, **Pulsar 150 Commuter**, **Namma Auto-Rickshaw** (with live ₹ meter & distance), **BMTC / RVITM Bus**, and **Bengaluru Water Tanker**.
  - Enter/Exit (`F`), acceleration/reverse/steering (`W/A/S/D`), handbrake drift (`Space`), vehicle-specific horns (`H`), headlight & brake-light emissives, plus a pooled `SpotLight` headlight beam for night/rain driving.
  - Kinematic AI road traffic, campus walkers, and Story 1 patrolling ID-card guard.
- **Missions & Side Gigs (`src/missions/`)**:
  - **Story 1**: *8:58 AM Attendance Sprint* (₹300, 45s, ID-card guard hazard)
  - **Story 2**: *Xerox & Record Hunt* (₹450, 80s, scooter + parking + porch)
  - **Story 3**: *Canteen Rush* (₹500, 85s, Canteen → Basketball Court → Cricket Turf → Porch)
  - **Side Story**: *Meter Mele* (₹600, 105s, Auto-Rickshaw pickups)
  - **4 Phone Gigs**: *Goli Chai Express*, *Last-Minute Assignment Print*, *BMTC Stop Auto Shuttle*, *Filter Kaapi & Maggi Run* (with +25% rain bonus).
- **UI, Audio, Weather & Persistence (`src/ui/`, `src/systems/`, `src/audio/`)**:
  - HUD (cash, zone resolver, weather, FPS, minimap radar, vehicle speedometer & auto meter).
  - NammaOS Smartphone (`P`) with Gigs, Inside RVITM photo gallery, Campus Directory/Map, Kannada Cheat Dialer, and Namma Campus Radio.
  - Full-screen Map (`M`), Cheat Terminal (`~`), Pause Menu (`Esc` with Mission Replay, Graphics Low/Med/High + Auto-scale, Weather Override, Save Export/Import/Reset), Photo Mode (`O`), and 15s `.webm` Clip Recorder (`B`).
  - Live Open-Meteo Bengaluru weather with 5s timeout and local time-of-day fallback.

---

## 2. Bugs Discovered & Fixed

| File | Bug / Issue | Fix Applied |
|------|-------------|-------------|
| `src/player/PlayerController.ts` | No out-of-bounds / fall-through guard if player leaves the `450×450` ground plane | Added `y < -10` / `|x| > 430` / `|z| > 430` safety respawn to `PLAYER_SPAWN` |
| `src/vehicles/VehicleController.ts` | Exiting a vehicle always placed player on left side, risking wall clipping | Added multi-candidate raycast exit check (left → right → behind → roof) |
| `src/vehicles/VehicleController.ts` | Vehicles had no out-of-bounds guard and only emissive headlights at night | Added bounds respawn guard and a pooled `SpotLight` headlight beam for night/rain driving |
| `src/main.ts` & `src/vehicles/VehicleController.ts` | Cheat-spawned vehicles (`4.5m` / `7.2m`) sat right at the `4.6m` `findNearest` threshold | Tuned cheat spawn distance to `3.6m` (`5.6m` for bus/tanker) and `findNearest` radius to `5.4m` |
| `src/systems/PhotoMode.ts` | Exiting Photo Mode (`O` / `Exit`) forced an automatic PNG download | Removed auto-download on exit; `Snap PNG` and `Enter` handle downloads cleanly |
| `src/main.ts` | Gameplay actions (`F`, `E`, `H`) still triggered while in Photo Mode | Guarded `vehicleToggle`, `interact`, and `horn` against `photoMode.active` |
| `src/main.ts` | `onImportSave` didn't clear old `completedIds` or sync radio; `onResetSave` didn't cancel active mission or reset `superMachaMode` | Full state synchronization on both `onImportSave` and `onResetSave` |
| `src/ui/PhoneOverlay.ts` | Pressing `Enter` in the Phone Cheat Dialer input didn't submit the code | Added `keydown` `Enter` handler on `#phone-cheat-input` |
| `src/systems/WeatherSystem.ts` | `fetchOpenMeteo()` had no request timeout | Added 5-second `AbortController` timeout with clean local fallback |

---

## 3. Earlier Baseline Build & Browser QA Results (2026-11-26 Pre-Phase 2A/2B/2C)

> **Note**: The headless Chrome run below was executed on the **2026-11-26 baseline build** before `WorldStreamer`, spatial chunking, `FriendNpcManager`, and `CollectiblesManager` were added. See Sections 7 and 8 for the current build's verification status.

- **TypeScript (`npx tsc --noEmit`)**: Passed with 0 errors.
- **Production Build (`npm run build`)**: Passed (`vite build` in ~1.13s, `dist/index.html`, `dist/assets/*.css`, `dist/assets/*.js`).
- **Live Headless Chrome + WebGL (SwiftShader) Verification**:
  - Verified WebGL canvas initialization (`1280×657`), HUD rendering, and `localStorage` save persistence (`namma-rvitm-save-v1`).
  - Verified all 9 `public/refs/*` assets return HTTP `200`.
  - Verified Smartphone (`P`) tabs (`Inside` gallery with 7 images, `Cheats` dialer `KASU` & `AUTOWALA`), Cheat Terminal (`~`), Full Map (`M`), Photo Mode (`O` HUD hide/restore), and Pause Menu (`Esc` Weather Rain, Graphics Medium, Mission list).
  - **Console Errors**: `0` (`[]`).
  - **Uncaught Exceptions**: `0` (`[]`).

---

## 4. Remaining Notes / Observations

- In headless SwiftShader software WebGL, `requestAnimationFrame` ticks slowly between synthetic CDP key events, so manual interactive playtesting in a hardware-accelerated desktop browser is recommended for tuning vehicle feel and mission timers.
- `ClipRecorder` (`B`) relies on `HTMLCanvasElement.captureStream()` and `MediaRecorder`, which requires a browser supporting `video/webm` capture.

---

## 5. How to Run, Build & Deploy

### Development
```bash
npm install
npm run dev
```
Open `http://localhost:5173/` in a WebGL2-capable browser.

### Refresh OpenStreetMap Data (Optional)
```bash
npm run fetch-osm
```

### Production Build & Preview
```bash
npm run build
npm run preview
```
Deploy the generated `dist/` directory to any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages, or Firebase Hosting).

---

## 6. Phase 2A World Pipeline & Animation Reconciliation (2026-11-27)

- **World Pipeline (`scripts/`)**:
  - `scripts/fetch-osm.mjs`: Configured for `12.8729154, 77.5757331` with a `2000` m radius, multipolygon relation handling, and explicit height source tracking (`mapped-height`, `mapped-levels`, `estimated-default-3m`). Fails with exit code `1` if Overpass is unreachable without overwriting existing data.
  - `scripts/generate-world.mjs`: Pure Node.js binary GLTF 2.0 (`world.glb`) generator extruding building footprints and road ribbons from `src/data/campus-osm.json` without requiring OSM2World or Blender.
  - `scripts/split-world-chunks.mjs`: Pure JavaScript 500 m × 500 m triangle-level spatial chunk splitter preserving materials and world transforms and writing `public/world/generated/manifest.json`.
  - `scripts/validate-world.mjs`: Validates `world.glb` and all chunk GLBs (parse, vertex/NaN/Infinity checks, bounding box, manifest consistency, and campus origin containment).
- **Verified Outputs**:
  - `public/world/generated/world.glb` (`0.24 MB`, 9,918 vertices, 282 buildings, 61 roads)
  - `public/world/generated/chunks/chunk_*.glb` (64 chunk files) and `public/world/generated/manifest.json`
  - `npm run validate-world`: 10 passed, 0 failed.
  - `npm run build`: `tsc` + `vite build` passed in 1.72s.
- **Player Animation (`src/animation/AnimationController.ts`)**:
  - Integrated into `src/player/PlayerController.ts` using the existing `public/models/player.glb` clips (`Idle`, `Walk`, `Run`, `TPose`) with fallback mapping for `Sprint` → `Run` and `Land`/`Turn`/`VehicleEnter`/`VehicleExit` → `Idle` plus procedural tilt/squash.
- **Known Limitations**:
  - Overpass API endpoints were unreachable from the build environment, so `src/data/campus-osm.json` currently on disk remains the previously fetched `250` m dataset (282 buildings, 61 roads) with its pre-existing `levels` values. Run `npm run fetch-osm` from a network-connected environment to populate the full `2000` m dataset and regenerate `world.glb` / chunks.
  - Separate Mixamo animation GLB files are not included; only the clips bundled in `public/models/player.glb` (`Idle`, `Walk`, `Run`, `TPose`) are present.

---

## 7. Phase 2B Spatial Chunking & World Streaming Integration (2026-11-27)

- **Spatial Chunking (`scripts/generate-world.mjs`, `scripts/split-world-chunks.mjs`)**:
  - Removed the 4 km × 4 km ground plane from `world.glb` so ground is never duplicated across chunks.
  - Implemented Sutherland-Hodgman 2D polygon clipping against each 500 m × 500 m cell `[minX, maxX] × [minZ, maxZ]`, preserving materials, normals, and world coordinates.
  - Cleans stale `chunks/*.glb` files before regenerating.
  - Current 250 m OSM dataset produces **4** spatial chunks (`chunk_-1_-1.glb`, `chunk_-1_0.glb`, `chunk_0_-1.glb`, `chunk_0_0.glb`) with real building & road geometry and **0** 12-vertex ground-only stubs.
- **Validation (`scripts/validate-world.mjs`)**:
  - Enforces vertex containment within declared `cellBounds` (`±0.05` m tolerance), rejects 12-vertex stubs and oversized chunks (`> 500.1` m), verifies manifest `bbox` matches actual geometry, checks for stale unreferenced chunk files, and verifies geometry preservation (`3,556` chunk tris >= `3,304` source tris).
  - `npm run validate-world`: **15 passed, 0 failed**.
- **Runtime World Streaming (`src/world/`)**:
  - Implemented `WorldCoordinateSystem.ts`, `WorldAssetLoader.ts`, `WorldCollisionManager.ts` (Rapier `trimesh` building colliders per chunk), `WorldChunkManager.ts`, and `WorldStreamer.ts`.
  - Connected `WorldStreamer` to `src/main.ts` (replacing `CityBuilder` to avoid overlapping procedural & generated worlds while preserving `CampusBuilder` landmarks, `InstancedProps`, vehicles, traffic, missions, UI, audio, weather, save/load, and photo mode).
  - Expanded ground physics collider (`PhysicsWorld.ts`) to `2200` m half-extents and player/vehicle out-of-bounds respawn guards to `2100` m.
- **Build & Runtime Verification**:
  - `npm ci`: exited `0` (`0 vulnerabilities`).
  - `npm run generate-world && npm run split-world-chunks && npm run validate-world`: exited `0` (`15 passed, 0 failed`).
  - `npm run build`: exited `0` (`tsc && vite build` in `1.73s`).
  - **Live Browser Runtime Test**: Could not run in Chrome because Chrome DevTools remote debugging was not enabled (`DevToolsActivePort` ENOENT). Live in-browser chunk streaming, collision, and FPS checks require running `npm run preview` in a desktop browser.

---

## 8. Phase 2C Campus Reconstruction, Friends, Collectibles & 8-Mission Storyline (2026-11-27)

- **Added Systems**:
  - `src/world/FriendNpcManager.ts`: `7` interactive RVITM friend NPCs (`Arjun`, `Divya`, `Karthik`, `Sneha`, `Rohan`, `Ananya`, `Vikram`) with `[E]` dialogue.
  - `src/world/CollectiblesManager.ts`: `6` hidden Golden RVITM Badges (`₹100` reward each).
  - `src/world/CampusBuilder.ts`: Central Library Entrance Canopy, RVITM Auditorium Plaza & Lit Signboard, and Quadrangle Terracotta Brick Lounge & Planters.
  - `src/missions/MissionData.ts`: Expanded to `9` Story/Side missions (`Story 1`–`Story 8` + `Side Story: Meter Mele`) and `4` Phone Gigs.
- **Current Build Verification (`2026-11-27`)**:
  - **Passed**: `npm run generate-world` (0), `npm run split-world-chunks` (0), `npm run validate-world` (0 — `15 passed, 0 failed`), `npm run build` (0 — `tsc && vite build` in `1.73s`).
  - **Failed (External Network)**: `npm run fetch-osm` exited `1` (Overpass API unreachable).
  - **Not Run**: Live Chrome browser test & FPS measurement (`DevToolsActivePort` ENOENT).
