# NAMMA RVITM — Browser Smoke Test (REAL headless Chrome)

- Date: 2026-11-27T07:20:29.055Z
- Browser: Google Chrome (headless) via puppeteer-core
- URL: http://localhost:4173
- WebGL: WebGL 2.0 (OpenGL ES 3.0 Chromium)
- Resolution: 1280x720, deviceScaleFactor 1
- Quality: software SwiftShader (no hardware GPU in headless)
- Measured FPS: 1.7 (software rasteriser — NOT representative of M4 Pro hardware)
- JS heap: used 52.0 MB / total 68.7 MB

## Result: 23 passed, 1 failed

| Check | Pass | Detail |
|---|---|---|
| world ready | ✅ | ready=true |
| manifest has 80 chunks | ✅ | total=80 |
| initial chunks loaded | ✅ | loaded=3 loading=3 |
| no failed chunks | ✅ | failed=0 |
| building colliders registered | ✅ | colliderChunks=3 |
| no duplicate chunk keys | ✅ | unique=3/3 |
| WebGL context alive | ✅ | WebGL 2.0 (OpenGL ES 3.0 Chromium) |
| moving loads new chunks | ✅ | far loaded=11 |
| distant chunks unloaded | ✅ | near=3 far=11 |
| no duplicate keys after move | ✅ | unique=11/11 |
| colliders track loaded chunks | ✅ | colliderChunks=10 loaded=11 |
| still no failed chunks | ✅ | failed=0 |
| player walks (W) | ✅ | moved 0.4m |
| player sprints (Shift) | ✅ | currentAnim=Sprint |
| player jumps (Space) | ✅ | peak +0.7m |
| enter vehicle (F) | ✅ | inVehicle=true |
| vehicle accelerates (W) | ✅ | speed=3.6 km/h |
| vehicle reverses (S) | ✅ | forwardSpeed=-2.1 km/h |
| exit vehicle (F) | ✅ | inVehicle=false |
| skinned student GLB active | ✅ | usingSkinnedModel=true |
| render loop running | ❌ | fps=1.7 (SwiftShader software GL) |
| JS heap measured | ✅ | used=52.0MB total=68.7MB |
| no page errors | ✅ | none |
| no console errors | ✅ | none |

## Screenshots
- qa-screenshots/01-spawn-idle.png
- qa-screenshots/02-far-corner.png
- qa-screenshots/03-campus-return.png
- qa-screenshots/04-main-gate.png
- qa-screenshots/05-academic-block.png
- qa-screenshots/06-library.png
- qa-screenshots/07-auditorium.png
- qa-screenshots/08-quadrangle.png
- qa-screenshots/09-city-street.png
- qa-screenshots/10-player-closeup.png
- qa-screenshots/11-vehicle-driving.png

> NOTE: This automated pass verifies boot, WebGL, world streaming, collider
> registration/removal, and absence of console errors. It does NOT verify
> human playability of missions, vehicles, or combat — those require manual
> interactive playtesting (see README).
