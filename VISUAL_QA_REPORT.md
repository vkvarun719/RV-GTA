# NAMMA RVITM — Phase 2E Visual Realism QA Report

**Date**: 2026-11-27  
**Target Hardware**: MacBook M4 Pro (24 GB RAM) — Apple Silicon macOS

---

## 1. Visual & Character Upgrades Implemented

1. **College-Student Protagonist (`src/player/PlayerController.ts`)**:
   - Replaced the tactical `Soldier.glb` (`vanguard_Mesh` + `vanguard_visor`) visual usage with an articulated college-student character (RVITM royal blue hoodie with amber stripe, dark jeans, white/dark-sole sneakers, and backpack).
   - Fixed the `wasGrounded` state-edge bug: `prevGrounded` is now captured before `physics.castRay(...)` and `this.wasGrounded` is updated after all takeoff/landing transitions.
   - Fixed `setInVehicle(inside)` so `VehicleEnter` is triggered on entry and `VehicleExit` on exit.
   - `src/animation/AnimationController.ts` no longer maps `T-Pose` as an `Idle` fallback and cleanly separates real skeletal clips (`hasRealClip`) from procedural motion.
2. **Friend NPCs (`src/world/FriendNpcManager.ts`)**:
   - Upgraded all `7` student friends (`Arjun`, `Divya`, `Karthik`, `Sneha`, `Rohan`, `Ananya`, `Vikram`) with varied skin tones, hair colors/bun silhouettes, sneakers, alternating student backpacks, and arm-gesture animations during nearby `[E]` interaction.
3. **Generated City Realism (`scripts/generate-world.mjs`, `src/world/WorldAssetLoader.ts`)**:
   - Added `0.45 m` architectural roof parapet rims on all extruded OSM buildings.
   - Added `0.45 m` raised road kerbs on all roads and dashed center lane markings on major (`primary`/`secondary`/`tertiary`) roads.
   - Applied shared runtime asphalt & micro-noise bump textures (`Textures.ts`) to streamed chunk meshes.
4. **Handcrafted RVITM Campus (`src/world/CampusBuilder.ts`)**:
   - Preserved 7-floor Academic Block, Main Gate + Security Cabin + Boom Barrier, Central Quadrangle + Flagpole, Canteen, Student Parking, Basketball Court, Cricket Turf, Central Library Canopy, Auditorium Plaza, and Terracotta Brick Lounge Planters.

---

## 2. Automated Verification Results

| Check | Status | Details |
|---|---|---|
| `npm ci` | **Passed** (`0`) | Clean install, `0 vulnerabilities` |
| `npm test` (`scripts/test-animation-state.mjs`) | **Passed** (`0`) | `5/5` grounded-state edge & locomotion tests passed |
| `npm run fetch-osm` | **Failed** (`1`) | Overpass API unreachable from sandbox (`406`/`504`/timeout); `250 m` dataset retained |
| `npm run generate-world` | **Passed** (`0`) | `world.glb` (`507.7 KB`, `21,006` verts, `7,002` tris, `282` buildings, `61` roads) |
| `npm run split-world-chunks` | **Passed** (`0`) | `4` clipped 500 m × 500 m chunks (`22,554` verts, `7,518` tris) |
| `npm run validate-world` | **Passed** (`0`) | `15 passed, 0 failed` |
| `npm run build` | **Passed** (`0`) | `tsc && vite build` in `1.73s` (`dist/assets/index-D4t8jIO7.js` `2,847.39 kB`) |

---

## 3. Manual Browser Verification Checklist (Not Run in Sandbox)

Chrome DevTools remote debugging was unavailable (`DevToolsActivePort` ENOENT), so live screenshots, FPS, and memory were **not** captured automatically. Run locally to verify:

```bash
npm run preview
# Open http://localhost:4173/ in Chrome
```

Verify in-browser:
- [ ] Main Gate, 7-floor Academic Block, Central Library, Auditorium, Quadrangle, and 80 Feet Road render cleanly with kerbs, lane markings, and roof parapets.
- [ ] Student protagonist walks, sprints (`Shift`), jumps (`Space`), lands, and enters/exits (`F`) all 5 vehicles.
- [ ] Talk (`[E]`) to all 7 Friend NPCs and collect all 6 Golden RVITM Badges (`+₹100` each).
- [ ] Record FPS, browser version, and resolution on MacBook M4 Pro.
