# NAMMA RVITM — Build & Verification Status

**Last Verified**: 2026-11-27  
**Workspace**: `/Users/lucky/Desktop/gta rvitm`

## Command Execution Log

| Command | Exit Code | Result / Output Summary |
|---|---|---|
| `npm ci` | `0` | Installed cleanly (`0 vulnerabilities`) |
| `npm run fetch-osm` | `1` | **Blocked by network**: all Overpass mirrors unreachable (`overpass-api.de` aborted/406, `overpass.kumi.systems` timeout, `overpass.private.coffee` aborted, `maps.mail.ru` failed/504). Existing `250` m `src/data/campus-osm.json` preserved untouched. |
| `npm run generate-world` | `0` | Generated `public/world/generated/world.glb` (`235 KB` / `240,784` bytes, `9,912` vertices, `3,304` triangles, `282` buildings, `61` roads, `4` mesh groups) |
| `npm run split-world-chunks` | `0` | Removed stale chunks, clipped geometry into `4` valid 500 m × 500 m chunks (`chunk_-1_-1.glb` 106 KB, `chunk_-1_0.glb` 45 KB, `chunk_0_-1.glb` 55 KB, `chunk_0_0.glb` 55 KB) + `manifest.json` |
| `npm run validate-world` | `0` | `15 passed, 0 failed` (strict bounds, vertex integrity, no stale files, `3,556` chunk tris >= `3,304` source tris) |
| `npm run build` | `0` | `tsc && vite build` passed in `1.73s` (`dist/assets/index-BC7K84ok.js` `2,848.18 kB`, `44` modules transformed) |
| Live Browser Runtime Test | Not Run | Chrome DevTools remote debugging unavailable (`DevToolsActivePort` ENOENT) |

## Known Limitations
1. `src/data/campus-osm.json` covers `250` m (`282` buildings, `61` roads) until `npm run fetch-osm` is run from a network-connected machine.
2. `public/models/player.glb` contains `4` animation clips (`Idle`, `Walk`, `Run`, `TPose`); additional states use fallback mappings + procedural squash/lean.
3. Live in-browser FPS, chunk streaming, and building collision require manual testing via `npm run dev` or `npm run preview`.
