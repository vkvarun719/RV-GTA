# Changelog

## Phase 2D / 2E — Visual Realism, Student Protagonist & Animation Bug Fixes (2026-11-27)
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
