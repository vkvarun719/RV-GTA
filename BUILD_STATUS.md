# NAMMA RVITM — Build & Verification Status

**Last Verified**: 2026-11-27  
**Workspace**: `/Users/lucky/Desktop/gta rvitm`

## Command Execution Log

| Command | Exit Code | Result / Output Summary |
|---|---|---|
| `npm ci` | `0` | Installed cleanly (`0 vulnerabilities`) |
| `npm test` | `0` | `5/5` animation & grounded-state edge tests passed (`scripts/test-animation-state.mjs`) |
| `npm run fetch-osm` | `1` | **Blocked by network**: all Overpass mirrors unreachable. Existing `250` m `src/data/campus-osm.json` preserved untouched. |
| `npm run generate-world` | `0` | Generated `public/world/generated/world.glb` (`507.7 KB`, `21,006` vertices, `7,002` triangles, `282` buildings with roof parapets, `61` roads with kerbs & lane markings) |
| `npm run split-world-chunks` | `0` | Clipped geometry into `4` valid 500 m × 500 m chunks (`chunk_-1_-1.glb`, `chunk_-1_0.glb`, `chunk_0_-1.glb`, `chunk_0_0.glb`; `7,518` total tris) + `manifest.json` |
| `npm run validate-world` | `0` | `15 passed, 0 failed` |
| `npm run build` | `0` | `tsc && vite build` passed in `1.73s` (`dist/assets/index-D4t8jIO7.js` `2,847.39 kB`, `43` modules transformed) |
| Live Browser Runtime Test | Not Run | Chrome DevTools remote debugging unavailable (`DevToolsActivePort` ENOENT) |

## Known Limitations
1. `src/data/campus-osm.json` covers `250` m (`282` buildings, `61` roads) until `npm run fetch-osm` is run from a network-connected machine.
2. Player protagonist uses an articulated procedural college-student rig; `public/models/player.glb` (`Soldier.glb` with `4` clips) remains on disk as an unused legacy asset.
3. Live in-browser FPS, screenshots, chunk streaming, and building collision require manual testing via `npm run dev` or `npm run preview`.
