# NAMMA RVITM — Asset Licenses & Attribution

| Asset / Source | Location | License / Terms | Attribution |
|---|---|---|---|
| **OpenStreetMap Building & Road Data** | `src/data/campus-osm.json`, `public/world/generated/*` | Open Database License (ODbL 1.0) | © OpenStreetMap contributors (`https://www.openstreetmap.org/copyright`). Fetched live from Overpass (`lz4.overpass-api.de`) on 2026-11-27. |
| **Legacy `player.glb` (UNUSED at runtime)** | `public/models/player.glb` | Three.js example `Soldier.glb` (MIT, via three.js examples) | Three.js (`https://threejs.org/`). Audited: Vanguard character, clips `Idle`/`Run`/`TPose`/`Walk`. **Not loaded**; the runtime protagonist is the original procedural student rig in `PlayerController.ts`. |
| **Runtime protagonist & friend NPCs** | `src/player/PlayerController.ts`, `src/world/FriendNpcManager.ts` | Original procedural geometry (MIT) | Authored for this project. No third-party character assets. |
| **RVITM Reference Photos & Crest** | `public/refs/*` | Official RVITM facility photos used for educational reference | RV Institute of Technology and Management (`https://rvitm.edu.in/`) |
| **Procedural Audio & Textures** | `src/audio/AudioEngine.ts`, `src/world/Textures.ts` | Original procedural Web Audio API & Canvas 2D code (MIT) | Generated at runtime in-browser |
| **Open-Meteo Weather API** | `src/systems/WeatherSystem.ts` | CC BY 4.0 (free, non-commercial) | Weather data by Open-Meteo.com |
| **Three.js / Rapier3D / Vite / Tailwind** | `package.json` | MIT / Apache-2.0 | Respective open-source maintainers |
| **puppeteer-core (dev/test only)** | `devDependencies` | Apache-2.0 | Drives the system Google Chrome for `npm run test:browser`. Not shipped in `dist/`. |

## Notes

- No paid/mandatory APIs are used. Overpass and Open-Meteo are free public services.
- No real-person likenesses are used for any character; all NPCs are generic fictional students.
- The 2 km OSM dataset is the only third-party geospatial input and is ODbL-attributed above.