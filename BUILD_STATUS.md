# NAMMA RVITM — Build & Verification Status

**Last Verified**: 2026-11-27
**Workspace**: `/Users/lucky/Desktop/gta rvitm`
**Phase**: 2D (World Expansion & Playability) + 2E (Visual Realism)

> This file records **only commands that actually ran** in this environment, with
> their real exit codes and outputs. Anything that did **not** run is marked
> **NOT RUN** with the reason. A green TypeScript build is **not** treated as proof
> of gameplay.

## Command Execution Log

| Command | Exit | Result / Output Summary |
|---|---|---|
| `npm run fetch-osm` | `0` | **SUCCESS (real 2 km fetch)**. `overpass.osm.ch` returned empty; `lz4.overpass-api.de` returned `72,414` elements. Saved `src/data/campus-osm.json`: **10,255 buildings, 2,693 roads, 361 landuse, 324 POIs**, `radiusMeters: 2000`. |
| `npm run generate-world` | `0` | `world.glb` = **19.08 MB** (18.2 MiB), **794,733 vertices, 264,911 triangles**, 10 mesh groups (4 building + 6 road), 10,255 buildings / 2,693 roads, 0 skipped. |
| `npm run split-world-chunks` | `0` | **80** spatial chunks (500 m × 500 m) written; stale chunks cleaned; `manifest.json` written. |
| `npm run validate-world` | `0` | **15 passed, 0 failed**. 80 chunks, 287,476 chunk tris ≥ 264,911 source tris, bbox/containment/NaN checks pass. |
| `npm test` | `0` | **5/5** animation & grounded-state tests + **source-level regression guards** (vehicle enter/exit mapping, grounded-state ordering, no T-Pose-as-idle). |
| `npm run build` | `0` | `tsc && vite build` passed in ~1.4 s. `dist/assets/index-*.js` **5.52 MB** (gzip **1.35 MB**), CSS 30.86 kB, 43 modules. |
| `npm run test:browser` | `0` | **REAL headless Google Chrome** (puppeteer-core + SwiftShader WebGL2). **23/23 checks passed**, 0 console errors, 0 page errors. See `BROWSER_SMOKE_REPORT.md`. |
| Live hardware-accelerated FPS (M4 Pro) | — | **NOT RUN**. Headless Chrome uses software SwiftShader (~5–7 fps); real M4 Pro FPS requires an interactive hardware-accelerated browser (manual). |

## What the automated browser test actually verified (real)

- App boots, WebGL 2.0 context created, render loop running.
- World streamer ready; manifest = **80** chunks; initial chunks loaded; **0** failed chunks.
- **Building colliders registered** on load and **removed** on unload (collider count tracks loaded chunks).
- **Streaming across boundaries**: teleporting 1.5 km loads new chunks and unloads distant ones; **no duplicate chunk keys**.
- **Playable mechanics via real DOM keyboard events**: walk (W), sprint (Shift, `currentAnim=Sprint`), jump (Space, +1.1 m peak), vehicle enter (F), accelerate (W), reverse (S, signed −2.5 km/h), exit (F).
- **No console errors, no uncaught page errors.**
- JS heap measured (~43 MB used).

## Known Limitations (honest)

1. **Player character is a procedural articulated student rig** (hoodie/jeans/sneakers/backpack) built in `PlayerController.ts`. It is **not** a downloaded rigged student GLB. `public/models/player.glb` is the legacy **Vanguard** tactical character (real clips: `Idle`, `Run`, `TPose`, `Walk`) and is **unused** at runtime. No missing animation is faked: all 9 locomotion states are procedural; `TPose` is never used as idle. Sourcing a free, licensed, rigged student GLB with 8 named clips was not possible in this environment and is **not** claimed.
2. **OSM city buildings are extruded footprints** with roof parapets, road kerbs and dashed lane markings. They do **not** have per-building windows/doors/balconies — OSM footprints do not encode architecture, and adding window geometry to 10,255 buildings would bloat the 19 MB GLB. The **handcrafted campus** (academic block, library, auditorium, gate) already has window textures, fins, plinths and signage.
3. **FPS/memory on the target MacBook M4 Pro were not measured** (no hardware-accelerated browser session). Headless software FPS (~5–7) is **not** representative.
4. **Missions, collectibles, friend dialogue, save/load and pause menu were not auto-tested** — they require interactive play. Precise manual test steps are in `README.md` → "Manual playtest checklist".
5. **Initial JS bundle is 5.52 MB** because the 6.3 MB `campus-osm.json` is inlined for the minimap/campus builder. Recommended optimization: split the minimap to a lightweight roads-only asset (not done here to avoid regressions).