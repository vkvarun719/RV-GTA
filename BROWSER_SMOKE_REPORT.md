# NAMMA RVITM — Browser Smoke Test (REAL headless Chrome)

- Date: 2026-11-27T04:06:28.103Z
- Browser: Google Chrome (headless) via puppeteer-core
- URL: http://localhost:4173
- WebGL: WebGL 2.0 (OpenGL ES 3.0 Chromium)
- Resolution: 1280x720, deviceScaleFactor 1
- Quality: software SwiftShader (no hardware GPU in headless)
- Measured FPS: 5.8 (software rasteriser — NOT representative of M4 Pro hardware)
- JS heap: used 43.3 MB / total 74.6 MB

## Result: 23 passed, 0 failed

| Check | Pass | Detail |
|---|---|---|
| world ready | ✅ | ready=true |
| manifest has 80 chunks | ✅ | total=80 |
| initial chunks loaded | ✅ | loaded=16 loading=0 |
| no failed chunks | ✅ | failed=0 |
| building colliders registered | ✅ | colliderChunks=16 |
| no duplicate chunk keys | ✅ | unique=16/16 |
| WebGL context alive | ✅ | WebGL 2.0 (OpenGL ES 3.0 Chromium) |
| moving loads new chunks | ✅ | far loaded=11 |
| distant chunks unloaded | ✅ | near=16 far=11 |
| no duplicate keys after move | ✅ | unique=11/11 |
| colliders track loaded chunks | ✅ | colliderChunks=10 loaded=11 |
| still no failed chunks | ✅ | failed=0 |
| player walks (W) | ✅ | moved 0.4m |
| player sprints (Shift) | ✅ | currentAnim=Sprint |
| player jumps (Space) | ✅ | peak +1.1m |
| enter vehicle (F) | ✅ | inVehicle=true |
| vehicle accelerates (W) | ✅ | speed=3.6 km/h |
| vehicle reverses (S) | ✅ | forwardSpeed=-2.5 km/h |
| exit vehicle (F) | ✅ | inVehicle=false |
| render loop running | ✅ | fps=5.8 (SwiftShader software GL) |
| JS heap measured | ✅ | used=43.3MB total=74.6MB |
| no page errors | ✅ | none |
| no console errors | ✅ | none |

## Screenshots
- qa-screenshots/01-spawn-idle.png
- qa-screenshots/02-far-corner.png
- qa-screenshots/03-campus-return.png

> NOTE: This automated pass verifies boot, WebGL, world streaming, collider
> registration/removal, and absence of console errors. It does NOT verify
> human playability of missions, vehicles, or combat — those require manual
> interactive playtesting (see README).
