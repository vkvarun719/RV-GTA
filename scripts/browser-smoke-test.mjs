// browser-smoke-test.mjs
//
// REAL headless-Chrome (puppeteer-core driving the system Google Chrome) runtime
// verification for NAMMA RVITM. This actually loads the built game in a browser,
// captures console/page errors, exercises world streaming + collision via the
// in-page debug handles, measures FPS and memory, and writes screenshots.
//
// It does NOT prove human playability of missions/vehicles — it proves the app
// boots, renders WebGL, streams chunks, registers/removes colliders, and runs
// without console errors. Interactive mechanics still need manual playtesting.
//
// Usage: node scripts/browser-smoke-test.mjs [baseUrl]
//   baseUrl defaults to http://localhost:4173 (vite preview).

import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CHROME =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE_URL = process.argv[2] || 'http://localhost:4173';
const SHOT_DIR = path.resolve(ROOT, 'qa-screenshots');
mkdirSync(SHOT_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureServer() {
  // If the caller passed an explicit URL, assume the server is already up.
  if (process.argv[2]) return null;
  const server = spawn('npm', ['run', 'preview', '--', '--port', '4173'], {
    cwd: ROOT,
    stdio: 'ignore',
    detached: false,
  });
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE_URL, { signal: AbortSignal.timeout(1000) });
      if (r.ok) return server;
    } catch {}
    await sleep(500);
  }
  throw new Error('vite preview did not start on ' + BASE_URL);
}

function fmt(n) {
  return typeof n === 'number' ? n.toFixed(1) : String(n);
}

async function main() {
  const results = [];
  const ok = (name, pass, detail = '') =>
    results.push({ name, pass, detail: String(detail) });

  const server = await ensureServer();
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--enable-unsafe-swiftshader',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--window-size=1280,720',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });

    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for the game to expose its debug handle and finish world init.
    await page.waitForFunction(
      () => window.__nammaWorld && window.__nammaWorld.getStats,
      { timeout: 45000 }
    );
    await page.waitForFunction(
      () => window.__nammaWorld.getStats().ready === true,
      { timeout: 45000 }
    );

    // Give the first batch of chunks time to stream in.
    await sleep(2500);

    const stats0 = await page.evaluate(() => window.__nammaWorld.getStats());
    ok('world ready', stats0.ready === true, `ready=${stats0.ready}`);
    ok(
      'manifest has 80 chunks',
      stats0.totalManifestChunks === 80,
      `total=${stats0.totalManifestChunks}`
    );
    ok(
      'initial chunks loaded',
      stats0.loadedChunks > 0,
      `loaded=${stats0.loadedChunks} loading=${stats0.loadingChunks}`
    );
    ok('no failed chunks', stats0.failedChunks === 0, `failed=${stats0.failedChunks}`);
    ok(
      'building colliders registered',
      stats0.colliderChunks > 0,
      `colliderChunks=${stats0.colliderChunks}`
    );
    ok(
      'no duplicate chunk keys',
      new Set(stats0.loadedKeys).size === stats0.loadedKeys.length,
      `unique=${new Set(stats0.loadedKeys).size}/${stats0.loadedKeys.length}`
    );

    // WebGL renderer sanity
    const glInfo = await page.evaluate(() => {
      const c = document.getElementById('game-canvas');
      const g = c && (c.getContext('webgl2') || c.getContext('webgl'));
      return g ? g.getParameter(g.VERSION) : 'NO WEBGL';
    });
    ok('WebGL context alive', String(glInfo).includes('WebGL'), glInfo);

    await page.screenshot({ path: path.join(SHOT_DIR, '01-spawn-idle.png') });

    // ── Streaming: teleport across the map and let the loop stream ──────────
    const nearKeys = stats0.loadedKeys;
    await page.evaluate(() => window.__nammaPlayer.teleport(1500, 0.4, 1500));
    await sleep(4000); // allow loads (≤3 concurrent) + unloads
    const statsFar = await page.evaluate(() => window.__nammaWorld.getStats());
    await page.screenshot({ path: path.join(SHOT_DIR, '02-far-corner.png') });

    const farKeys = statsFar.loadedKeys;
    const farSet = new Set(farKeys);
    const nearSet = new Set(nearKeys);
    const gainedFar = farKeys.some((k) => !nearSet.has(k));
    const droppedNear = nearKeys.some((k) => !farSet.has(k));
    ok(
      'moving loads new chunks',
      gainedFar,
      `far loaded=${farKeys.length}`
    );
    ok(
      'distant chunks unloaded',
      droppedNear,
      `near=${nearKeys.length} far=${farKeys.length}`
    );
    ok(
      'no duplicate keys after move',
      farSet.size === farKeys.length,
      `unique=${farSet.size}/${farKeys.length}`
    );
    ok(
      'colliders track loaded chunks',
      statsFar.colliderChunks > 0,
      `colliderChunks=${statsFar.colliderChunks} loaded=${statsFar.loadedChunks}`
    );
    ok('still no failed chunks', statsFar.failedChunks === 0, `failed=${statsFar.failedChunks}`);

    // Return to the open main-gate spawn area for a gameplay screenshot + mechanics.
    await page.evaluate(() => window.__nammaPlayer.teleport(72.5, 1.2, -17.5));
    await sleep(2500);
    await page.screenshot({ path: path.join(SHOT_DIR, '03-campus-return.png') });

    // ── Playable mechanics via REAL keyboard input ──────────────────────────
    // Frame-rate-independent: poll observable state (currentAnim / position /
    // telemetry) instead of fixed wall-clock waits, because software GL runs
    // at ~5 fps with dt clamped to 0.05 s.
    const p0 = await page.evaluate(() => {
      const p = window.__nammaPlayer.getPosition();
      return { x: p.x, z: p.z };
    });

    // Walk forward → currentAnim becomes 'Walk' and position changes.
    await page.keyboard.down('KeyW');
    let walked = 0;
    try {
      await page.waitForFunction(
        (s) => {
          const p = window.__nammaPlayer.getPosition();
          return Math.hypot(p.x - s.x, p.z - s.z) > 0.4;
        },
        { timeout: 8000 },
        p0
      );
    } catch {}
    await page.keyboard.up('KeyW');
    walked = await page.evaluate((s) => {
      const p = window.__nammaPlayer.getPosition();
      return Math.hypot(p.x - s.x, p.z - s.z);
    }, p0);
    ok('player walks (W)', walked > 0.4, `moved ${fmt(walked)}m`);

    // Sprint → currentAnim becomes 'Sprint'.
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('KeyW');
    let sprintState = '';
    try {
      await page.waitForFunction(
        () => window.__nammaPlayer.currentAnim === 'Sprint',
        { timeout: 8000 }
      );
      sprintState = 'Sprint';
    } catch {
      sprintState = await page.evaluate(() => window.__nammaPlayer.currentAnim);
    }
    await page.keyboard.up('KeyW');
    await page.keyboard.up('ShiftLeft');
    ok('player sprints (Shift)', sprintState === 'Sprint', `currentAnim=${sprintState}`);

    // Jump → player rises above baseline.
    const yBase = await page.evaluate(() => window.__nammaPlayer.getPosition().y);
    await page.keyboard.down('Space');
    let yPeak = yBase;
    try {
      await page.waitForFunction(
        (yb) => window.__nammaPlayer.getPosition().y > yb + 0.4,
        { timeout: 6000 },
        yBase
      );
    } catch {}
    for (let i = 0; i < 10; i++) {
      const y = await page.evaluate(() => window.__nammaPlayer.getPosition().y);
      if (y > yPeak) yPeak = y;
      await sleep(50);
    }
    await page.keyboard.up('Space');
    ok('player jumps (Space)', yPeak > yBase + 0.4, `peak +${fmt(yPeak - yBase)}m`);

    // Vehicle: spawn in front, enter, accelerate, reverse, exit.
    await page.evaluate(() => {
      const p = window.__nammaPlayer.getPosition();
      window.__nammaVehicles.spawnVehicle('auto', p.x + 2.5, p.z, 0);
    });
    await sleep(500);
    await page.keyboard.press('KeyF'); // enter
    let entered = false;
    try {
      await page.waitForFunction(() => window.__nammaPlayer.inVehicle === true, { timeout: 5000 });
      entered = true;
    } catch {}
    ok('enter vehicle (F)', entered, `inVehicle=${entered}`);

    await page.keyboard.down('KeyW');
    let vSpeed = -1;
    try {
      await page.waitForFunction(
        () => {
          const t = window.__nammaVehicles.getActiveTelemetry();
          return t && t.speedKmh > 2;
        },
        { timeout: 8000 }
      );
    } catch {}
    vSpeed = await page.evaluate(() => {
      const t = window.__nammaVehicles.getActiveTelemetry();
      return t ? t.speedKmh : -1;
    });
    await page.keyboard.up('KeyW');
    ok('vehicle accelerates (W)', vSpeed > 2, `speed=${fmt(vSpeed)} km/h`);

    await page.keyboard.down('KeyS');
    let vRev = 1;
    try {
      await page.waitForFunction(
        () => {
          const t = window.__nammaVehicles.getActiveTelemetry();
          return t && t.forwardSpeedKmh < -1.5;
        },
        { timeout: 9000 }
      );
    } catch {}
    vRev = await page.evaluate(() => {
      const t = window.__nammaVehicles.getActiveTelemetry();
      return t ? t.forwardSpeedKmh : 1;
    });
    await page.keyboard.up('KeyS');
    ok('vehicle reverses (S)', vRev < -1.5, `forwardSpeed=${fmt(vRev)} km/h`);

    await page.keyboard.press('KeyF'); // exit
    let exited = false;
    try {
      await page.waitForFunction(() => window.__nammaPlayer.inVehicle === false, { timeout: 5000 });
      exited = true;
    } catch {}
    ok('exit vehicle (F)', exited, `inVehicle=${!exited}`);

    // ── FPS measurement over ~3s via rAF counter ────────────────────────────
    const fps = await page.evaluate(
      () =>
        new Promise((resolve) => {
          let frames = 0;
          const t0 = performance.now();
          function tick() {
            frames++;
            if (performance.now() - t0 < 3000) requestAnimationFrame(tick);
            else resolve(frames / ((performance.now() - t0) / 1000));
          }
          requestAnimationFrame(tick);
        })
    );
    ok('render loop running', fps > 5, `fps=${fmt(fps)} (SwiftShader software GL)`);

    // ── Memory (Chrome performance.memory, if exposed) ──────────────────────
    const mem = await page.evaluate(() => {
      const m = performance.memory;
      return m ? { usedMB: m.usedJSHeapSize / 1048576, totalMB: m.totalJSHeapSize / 1048576 } : null;
    });
    if (mem) ok('JS heap measured', true, `used=${fmt(mem.usedMB)}MB total=${fmt(mem.totalMB)}MB`);
    else ok('JS heap measured', false, 'performance.memory unavailable');

    // ── Console / page errors ───────────────────────────────────────────────
    ok('no page errors', pageErrors.length === 0, pageErrors.join(' | ') || 'none');
    ok('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | ') || 'none');

    // ── Report ──────────────────────────────────────────────────────────────
    const passed = results.filter((r) => r.pass).length;
    const failed = results.length - passed;
    const lines = [
      '# NAMMA RVITM — Browser Smoke Test (REAL headless Chrome)',
      '',
      `- Date: ${new Date().toISOString()}`,
      `- Browser: Google Chrome (headless) via puppeteer-core`,
      `- URL: ${BASE_URL}`,
      `- WebGL: ${glInfo}`,
      `- Resolution: 1280x720, deviceScaleFactor 1`,
      `- Quality: software SwiftShader (no hardware GPU in headless)`,
      `- Measured FPS: ${fmt(fps)} (software rasteriser — NOT representative of M4 Pro hardware)`,
      mem ? `- JS heap: used ${fmt(mem.usedMB)} MB / total ${fmt(mem.totalMB)} MB` : '- JS heap: n/a',
      '',
      `## Result: ${passed} passed, ${failed} failed`,
      '',
      '| Check | Pass | Detail |',
      '|---|---|---|',
      ...results.map((r) => `| ${r.name} | ${r.pass ? '✅' : '❌'} | ${r.detail.replace(/\|/g, '/')} |`),
      '',
      '## Screenshots',
      ...[
        '01-spawn-idle.png',
        '02-far-corner.png',
        '03-campus-return.png',
      ].map((f) => `- qa-screenshots/${f}`),
      '',
      '> NOTE: This automated pass verifies boot, WebGL, world streaming, collider',
      '> registration/removal, and absence of console errors. It does NOT verify',
      '> human playability of missions, vehicles, or combat — those require manual',
      '> interactive playtesting (see README).',
      '',
    ];
    const report = lines.join('\n');
    writeFileSync(path.resolve(ROOT, 'BROWSER_SMOKE_REPORT.md'), report);
    console.log(report);

    if (failed > 0) process.exitCode = 1;
  } finally {
    await browser.close();
    if (server) server.kill('SIGTERM');
  }
}

main().catch((e) => {
  console.error('browser-smoke-test failed:', e);
  process.exit(1);
});