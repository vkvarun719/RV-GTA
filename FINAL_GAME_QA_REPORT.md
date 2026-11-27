# NAMMA RVITM — Final Game QA Report

**Date**: 2026-11-27
**Project**: `namma-rvitm` (Vite + TypeScript + Three.js r172 + Rapier3D + Tailwind)
**Location**: `/Users/lucky/Desktop/gta rvitm`

> Only tests that actually ran are reported as passed. A successful build is **not** treated as proof
> of gameplay. Items marked **NOT RUN** require a hardware-accelerated interactive browser.

---

## 1. World Pipeline (real 2 km) — PASSED

| Step | Result |
|---|---|
| `npm run fetch-osm` | **Real 2 km fetch** via `lz4.overpass-api.de` — 72,414 elements → **10,255 buildings, 2,693 roads, 361 landuse, 324 POIs**, `radiusMeters: 2000`. `overpass.osm.ch` returned empty; other mirrors 502/timeout. Old data untouched on failure. |
| Geographic extent | X `[-2368.9 … 2230.8]` m, Z `[-2699.5 … 2597.9]` m (boundary-crossing ways extend past the 2 km radius — expected for `around` queries). |
| Height sources | `mapped-height=10`, `mapped-levels=57`, `estimated-default-3m=10188` (explicitly flagged). |
| `npm run generate-world` | `world.glb` **19.08 MB**, **794,733 verts, 264,911 tris**, 10 mesh groups. |
| `npm run split-world-chunks` | **80** chunks (500 m × 500 m), 287,476 total chunk tris. |
| `npm run validate-world` | **15 passed, 0 failed** (parse, NaN/Inf, bbox, containment ±0.05 m, no 12-vert stubs, geometry preserved, campus origin present). |

## 2. Build & Unit Tests — PASSED

- `npm run build` (`tsc && vite build`): **passed** ~1.4 s. JS 5.52 MB (gzip 1.35 MB), CSS 30.86 kB, 43 modules.
- `npm test`: **5/5** grounded-state/locomotion tests + **source-level regression guards**
  (vehicle enter→`enter`/exit→`exit`, `prevGrounded` before `isGrounded`, `wasGrounded` after, no `TPose` as idle).

## 3. Live Browser Runtime — PASSED (real headless Chrome)

`npm run test:browser` (puppeteer-core + system Google Chrome, SwiftShader WebGL2, 1280×720):

- **23/23 checks passed, 0 console errors, 0 uncaught page errors.**
- World streamer ready; manifest = **80** chunks; initial chunks loaded; **0** failed.
- **Building colliders registered** on load, **removed** on unload (count tracks loaded chunks).
- **Streaming across boundaries**: teleport 1.5 km → new chunks load, distant unload, **no duplicate keys**.
- **Mechanics (real keyboard events)**: walk, sprint (`currentAnim=Sprint`), jump (+1.1 m), vehicle
  enter, accelerate, reverse (signed −2.5 km/h), exit.
- **Measured FPS ≈ 5–7** (software SwiftShader — **not** the M4 Pro figure). **JS heap ≈ 43 MB**.
- Screenshots: `qa-screenshots/01-spawn-idle.png`, `02-far-corner.png`, `03-campus-return.png`.
- Full log: `BROWSER_SMOKE_REPORT.md`.

## 4. Bugs Fixed This Phase

| File | Bug | Fix |
|---|---|---|
| `scripts/fetch-osm.mjs` | 2 km query aborted at 25 s; working mirrors missing | Added `overpass.osm.ch` + `lz4.overpass-api.de`, 120 s timeout, accurate failure log; non-destructive. |
| `src/world/*`, `src/ui/*` (4 files) | Build broke on new JSON shape (`number[][]` vs `[number,number][]`) | Cast via `unknown` (`as unknown as OsmDataset`). |
| `src/vehicles/VehicleController.ts` / telemetry | Reverse not observable (`speedKmh` is `abs`) | Added signed `forwardSpeedKmh` to `VehicleTelemetry`. |
| `index.html` | Headless console 404 (`/favicon.ico`) | Added `<link rel="icon">` to the RVITM logo. |
| `src/player/PlayerController.ts` | (verified already fixed) grounded-state + vehicle enter/exit | Confirmed + source-guarded by tests. |

## 5. NOT RUN (require hardware-accelerated interactive browser)

- Real M4 Pro FPS / memory under hardware GL.
- Mission start → checkpoints → completion → rewards; collectible pickup; friend dialogue;
  save/load; pause menu; photo mode; clip recorder.
- Landmark screenshots (only spawn / far-corner / return captured).

See `README.md` → "Manual playtest checklist" for exact steps.

## 6. Honest Feature Status

- **Protagonist**: procedural student rig (NOT a downloaded rigged GLB). `player.glb` (Vanguard,
  clips `Idle`/`Run`/`TPose`/`Walk`) is unused. No missing animation is faked; `TPose` never used as idle.
- **City buildings**: extruded footprints + parapets/kerbs/markings; **no** per-building windows
  (OSM has no architecture). Handcrafted campus has window textures/fins/signage.
- **Friends**: 7 distinct students preserved. **Vehicles**: 5 types. **Missions**: 9 story/side + 4 gigs (code present, not auto-playtested).

## 7. How to Run
```bash
npm ci
npm run dev        # dev
npm run build && npm run preview   # prod on :4173
npm test && npm run test:browser   # unit + real browser QA
```