# NAMMA RVITM — Phase 2E Visual Realism QA Report

**Date**: 2026-11-27
**Target Hardware**: MacBook M4 Pro (24 GB RAM) — Apple Silicon macOS
**Build**: `namma-rvitm` (Vite + TypeScript + Three.js r172 + Rapier3D + Tailwind)

> Only results that actually ran are reported. Items that did not run are marked
> **NOT RUN**. Software-rendered headless FPS is **not** representative of the M4 Pro.

---

## 1. Character & Animation (audited, honest)

- **Protagonist**: procedural articulated college-student rig in `src/player/PlayerController.ts`
  (royal-blue hoodie + amber stripe, dark jeans, white sneakers, backpack). This is **procedural
  geometry, not a downloaded rigged GLB**.
- **`public/models/player.glb` audit** (parsed GLB JSON chunk): it is the legacy **Vanguard**
  tactical character — 2 meshes (`vanguard_Mesh`, `vanguard_visor`), 2 skins, 68 nodes, and
  exactly **4 animation clips: `Idle`, `Run`, `TPose`, `Walk`**. It is **not loaded at runtime**.
- **Real vs procedural (clearly separated)**: `AnimationController` tracks `realClipStates` via
  `hasRealClip()`. `TPose` is **never** mapped to `Idle` (source-guarded by `npm test`). No missing
  clip is faked — Sprint/Jump/Land/Turn/VehicleEnter/VehicleExit are **procedural** motion, not clips.
- **Grounded-state bug fixed**: `prevGrounded` captured before `castRay`, `wasGrounded` updated after
  takeoff/landing resolution (`resolveLocomotionState`). Takeoff/landing edges are correct.
- **Vehicle transition bug fixed**: `setInVehicle(inside)` plays `enter` on entry and `exit` on exit —
  never `VehicleExit` on entry (source-guarded).

## 2. Friend NPCs (preserved, 7)

`Arjun, Divya, Karthik, Sneha, Rohan, Ananya, Vikram` — distinct shirt/pants colours, varied skin
tones, hair colour + bun silhouettes, alternating backpacks, named `lArm`/`rArm` gesture meshes,
look-at-player rotation within 5.5 m, and idle sway. Generic fictional characters (no real likenesses).

## 3. World & City

- **Real 2 km OSM world** (see `BUILD_STATUS.md`): 10,255 buildings, 2,693 roads, 80 chunks.
- **Generated city**: extruded footprints + 0.45 m roof parapets + 0.45 m road kerbs + dashed lane
  markings on major roads + shared asphalt/bump textures at runtime. **No per-building windows** —
  OSM footprints do not encode architecture (documented, not faked).
- **Handcrafted campus preserved**: 7-floor Academic Block (window textures, concrete fins, plinth),
  Main Gate + Security Cabin + Boom Barrier, Central Library Canopy, Auditorium Plaza, Quadrangle +
  Flagpole, Canteen, Parking, Basketball Court, Cricket Turf, Terracotta Lounge Planters.

## 4. Automated Verification (actually ran)

| Check | Status | Details |
|---|---|---|
| `npm run fetch-osm` | **Passed (0)** | Real 2 km fetch via `lz4.overpass-api.de` (72,414 elements) |
| `npm run generate-world` | **Passed (0)** | `world.glb` 19.08 MB, 264,911 tris |
| `npm run split-world-chunks` | **Passed (0)** | 80 chunks |
| `npm run validate-world` | **Passed (0)** | 15 passed, 0 failed |
| `npm test` | **Passed (0)** | 5/5 + source guards |
| `npm run build` | **Passed (0)** | `tsc && vite build` ~1.4 s |
| `npm run test:browser` | **Passed (0)** | **23/23** real headless Chrome checks, 0 console errors |

## 5. Browser runtime (REAL headless Chrome + SwiftShader WebGL2)

- Resolution 1280×720, deviceScaleFactor 1, software rasteriser.
- **Measured FPS ≈ 5–7** (software; **NOT** the M4 Pro hardware figure).
- **JS heap ≈ 43 MB used**.
- Screenshots: `qa-screenshots/01-spawn-idle.png`, `02-far-corner.png`, `03-campus-return.png`.
- Verified live: WebGL2 boot, 80-chunk manifest, initial streaming, boundary crossing + unload,
  no duplicate chunks, collider register/remove, walk/sprint/jump, vehicle enter/accelerate/reverse/exit,
  **0 console errors, 0 page errors**.

## 6. NOT RUN (require hardware-accelerated interactive browser)

- Real M4 Pro FPS / memory under hardware GL.
- Mission start → checkpoints → completion → rewards.
- Collectible pickup, friend dialogue, save/load, pause menu, photo mode, clip recorder.
- Screenshots at each named campus landmark (only spawn / far-corner / return captured).

See `README.md` → "Manual playtest checklist" for exact steps.