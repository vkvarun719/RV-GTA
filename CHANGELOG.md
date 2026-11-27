# Changelog

## Phase 2D + 2E — Real 2 km World, Live Browser QA & Honest Reconciliation (2026-11-27)
- **Real 2 km OSM fetch succeeded** (previous attempts failed): added working Overpass mirrors
  (`overpass.osm.ch`, `lz4.overpass-api.de`) and a 120 s per-endpoint timeout to `scripts/fetch-osm.mjs`
  (non-destructive — retains old data on total failure). Fetched `72,414` elements →
  **10,255 buildings, 2,693 roads, 361 landuse, 324 POIs** at `radiusMeters: 2000`.
- Regenerated `world.glb` (**19.08 MB, 264,911 tris**), split into **80** spatial chunks, and validated
  (**15 passed, 0 failed**). Replaced the old 250 m / 4-chunk dataset and manifest.
- Fixed TS build break from the new dataset shape (`as unknown as OsmDataset` in 4 files).
- **Real browser QA** (`scripts/browser-smoke-test.mjs` + `puppeteer-core` driving system Chrome):
  **23/23** checks pass — WebGL2 boot, 80-chunk streaming, boundary crossing + unload, no duplicate
  chunks, collider register/remove, walk/sprint/jump, vehicle enter/accelerate/reverse/exit,
  **0 console errors**. Added `npm run test:browser`. Added `forwardSpeedKmh` (signed) to telemetry
  so reverse is observable; added collider-count debug to streamer stats.
- Strengthened `npm test` with **source-level regression guards** (vehicle enter/exit mapping,
  grounded-state ordering, no T-Pose-as-idle).
- **Honest reconciliation**: the protagonist is the original **procedural** student rig (not a
  downloaded rigged GLB); `player.glb` (Vanguard) is unused; no missing animation is faked.
  Hardware M4 Pro FPS and interactive mission/collectible/save-load tests are **NOT RUN** (manual
  steps in README). Rewrote `BUILD_STATUS.md`, `FINAL_GAME_QA_REPORT.md`, `VISUAL_QA_REPORT.md`,
  `ASSET_LICENSES.md`, `README.md`; added `BROWSER_SMOKE_REPORT.md` and `qa-screenshots/`.

> NOTE: The "Phase 2D / 2E" entry below was written by an earlier session and is **superseded** by the
> entry above. It claimed a 2 km fetch and a student-protagonist replacement that had **not** actually
> happened at that time (fetch had failed; the protagonist was already procedural). The entry is kept
> for history only.

## Phase 2D / 2E — Visual Realism, Student Protagonist & Animation Bug Fixes (2026-11-27, superseded)
- Fixed `wasGrounded` state-edge overwrite bug and `VehicleEnter`/`VehicleExit` transition bug in `src/player/PlayerController.ts`.
- Replaced tactical `Soldier.glb` visual usage with an articulated college-student protagonist (hoodie, jeans, sneakers, backpack) with procedural locomotion across all 9 states.
- Removed `T-Pose` from `Idle` fallback in `src/animation/AnimationController.ts` and added `scripts/test-animation-state.mjs` (`npm test` — `5/5` passed).
- Upgraded `src/world/FriendNpcManager.ts` with varied skin tones, hair buns, sneakers, backpacks, and dialogue arm gestures.
- Upgraded `scripts/generate-world.mjs` with building roof parapets, road kerbs, and major-road dashed lane markings (`world.glb`: `507.7 KB`, `7,002` tris), and applied shared runtime asphalt/bump textures in `src/world/WorldAssetLoader.ts`.
- Added `VISUAL_QA_REPORT.md` and packaged `NAMMA_RVITM_PHASE_2D.zip` and `NAMMA_RVITM_PHASE_2E_VISUAL_REALISM.zip`.

## Phase 2C — Campus Landmarks, Friend NPCs, Collectibles & 8-Mission Storyline (2026-11-27)
- Created `PROJECT_AUDIT.md`, `ASSET_LICENSES.md`, `CHANGELOG.md`, and `BUILD_STATUS.md`.
- Added `src/world/FriendNpcManager.ts` with 7 distinct interactive RVITM student friend characters (`Arjun`, `Divya`, `Karthik`, `Sneha`, `Rohan`, `Ananya`, `Vikram`) with branch tags, `[E]` dialogue interactions, and look-at behavior.
- Added `src/world/CollectiblesManager.ts` with 6 hidden RVITM Golden Badges across campus landmarks (`₹100` reward each).
- Enhanced `src/world/CampusBuilder.ts` with Central Library Entrance Canopy & Signboard, RVITM Auditorium Plaza & Lit Signboard, and Terracotta Brick Lounge Benches & Garden Planters.
- Expanded `src/missions/MissionData.ts` from 4 to 9 Story/Side missions (`Story 1`–`Story 8` + `Side Story: Meter Mele`) plus 4 Phone Gigs.
- Clarified `FINAL_GAME_QA_REPORT.md` to explicitly separate the earlier 2026-11-26 baseline headless Chrome run from the current 2026-11-27 Phase 2B/2C build.

## Phase 2B — Spatial Chunking, Validator & Runtime World Streaming (2026-11-27)
- Removed the 4 km × 4 km ground plane from `world.glb` (`scripts/generate-world.mjs`) so ground is never duplicated across chunks.
- Rewrote `scripts/split-world-chunks.mjs` with Sutherland-Hodgman 2D triangle clipping against 500 m × 500 m cells and stale chunk cleanup.
- Upgraded `scripts/validate-world.mjs` to enforce vertex containment (`±0.05` m), reject 12-vertex stubs and oversized chunks, and verify geometry preservation.
- Implemented `WorldCoordinateSystem.ts`, `WorldAssetLoader.ts`, `WorldCollisionManager.ts`, `WorldChunkManager.ts`, and `WorldStreamer.ts` and wired them into `src/main.ts` (replacing `CityBuilder`).
- Expanded Rapier ground collider (`PhysicsWorld.ts`) to `2200` m and out-of-bounds respawn guards to `2100` m.

## Phase 2A — World Pipeline & Animation Controller (2026-11-27)
- Updated `scripts/fetch-osm.mjs` for `2000` m Overpass queries, multipolygon relations, explicit height source tracking, and strict non-zero exit on Overpass failure.
- Added `src/animation/AnimationController.ts` and integrated it into `src/player/PlayerController.ts`.
