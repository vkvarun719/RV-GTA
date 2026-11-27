// validate-world.mjs
// Validates world.glb, all chunk GLBs, manifest.json, spatial containment,
// geometry preservation, and absence of duplicated ground planes.
// Exits 0 on success, 1 on any failure.

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const GLB_PATH   = path.resolve(ROOT, 'public/world/generated/world.glb');
const MANIFEST   = path.resolve(ROOT, 'public/world/generated/manifest.json');
const CHUNKS_DIR = path.resolve(ROOT, 'public/world/generated/chunks');

const CELL_TOLERANCE_M = 0.05; // 5 cm tolerance for floating-point clipping
const MAX_CHUNK_SPAN_M = 500 + CELL_TOLERANCE_M * 2;
const MIN_MEANINGFUL_VERTS = 18; // > 12 vertices (rejects bare 2-tri ground stubs)

if (typeof global.self === 'undefined') global.self = global;

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

let passed = 0;
let failed = 0;

function pass(msg) {
  console.log('  ✅  ' + msg);
  passed++;
}

function fail(msg) {
  console.error('  ❌  ' + msg);
  failed++;
}

function warn(msg) {
  console.warn('  ⚠️   ' + msg);
}

async function loadGlb(filePath) {
  const buf = await fs.readFile(filePath);
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) =>
    loader.parse(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      '',
      resolve,
      reject
    )
  );
}

function inspectGeometry(gltf) {
  let totalVerts = 0;
  let totalTris = 0;
  let nanFound = false;
  let infFound = false;
  let buildingMeshes = 0;
  let roadMeshes = 0;
  const box = new THREE.Box3();

  gltf.scene.updateWorldMatrix(true, true);
  gltf.scene.traverse((obj) => {
    if (!obj.isMesh) return;
    if (obj.name.startsWith('buildings')) buildingMeshes++;
    if (obj.name.startsWith('roads')) roadMeshes++;

    const pos = obj.geometry.getAttribute('position');
    if (!pos) return;
    const idx = obj.geometry.index;
    totalTris += idx ? idx.count / 3 : pos.count / 3;

    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld);
      if (Number.isNaN(v.x) || Number.isNaN(v.y) || Number.isNaN(v.z)) nanFound = true;
      if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) infFound = true;
      box.expandByPoint(v);
    }
    totalVerts += pos.count;
  });

  return { totalVerts, totalTris, nanFound, infFound, buildingMeshes, roadMeshes, box };
}

async function checkWorldGlb() {
  console.log('\n── World GLB ──────────────────────────────────────────');

  let stat;
  try {
    stat = await fs.stat(GLB_PATH);
  } catch {
    fail(`world.glb not found at ${GLB_PATH}`);
    return null;
  }
  if (stat.size < 1000) {
    fail(`world.glb is suspiciously small: ${stat.size} bytes`);
    return null;
  }
  pass(`world.glb exists (${(stat.size / 1e3).toFixed(1)} KB)`);

  let gltf;
  try {
    gltf = await loadGlb(GLB_PATH);
  } catch (e) {
    fail(`world.glb failed to parse: ${e.message}`);
    return null;
  }
  pass('world.glb parsed successfully');

  const info = inspectGeometry(gltf);
  if (info.totalVerts === 0) {
    fail('world.glb: no vertices found');
    return null;
  }
  pass(`world.glb: ${info.totalVerts.toLocaleString()} vertices, ${info.totalTris.toLocaleString()} triangles`);

  if (info.nanFound) fail('world.glb: NaN values in vertex positions');
  else pass('world.glb: no NaN positions');

  if (info.infFound) fail('world.glb: Infinite values in vertex positions');
  else pass('world.glb: no Infinite positions');

  if (info.buildingMeshes === 0 || info.roadMeshes === 0) {
    fail(`world.glb missing building or road meshes (buildings=${info.buildingMeshes}, roads=${info.roadMeshes})`);
  } else {
    pass(`world.glb has ${info.buildingMeshes} building group(s) and ${info.roadMeshes} road group(s)`);
  }

  const b = info.box;
  pass(`world.glb bbox: X[${b.min.x.toFixed(1)}…${b.max.x.toFixed(1)}] Z[${b.min.z.toFixed(1)}…${b.max.z.toFixed(1)}]`);

  return info;
}

async function checkManifest() {
  console.log('\n── Manifest ───────────────────────────────────────────');

  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8'));
  } catch (e) {
    fail(`manifest.json not found or invalid JSON: ${e.message}`);
    return null;
  }
  pass('manifest.json exists and is valid JSON');

  if (!Array.isArray(manifest.chunks) || manifest.chunks.length === 0) {
    fail('manifest.json has no chunks array');
    return null;
  }
  pass(`manifest.json lists ${manifest.chunks.length} chunks`);
  return manifest;
}

async function checkChunks(manifest, worldInfo) {
  console.log('\n── Chunk spatial & geometry validation ────────────────');

  if (!manifest) return;

  const referencedFiles = new Set();
  const unionBox = new THREE.Box3();
  let totalChunkTris = 0;
  let totalChunkBuildings = 0;
  let totalChunkRoads = 0;
  let chunkFailures = 0;

  for (const entry of manifest.chunks) {
    const fpath = path.resolve(ROOT, 'public/world/generated', entry.file);
    referencedFiles.add(path.basename(entry.file));

    let stat;
    try {
      stat = await fs.stat(fpath);
    } catch {
      fail(`Missing chunk: ${entry.file}`);
      chunkFailures++;
      continue;
    }
    if (stat.size < 100) {
      fail(`Chunk too small: ${entry.file} (${stat.size} bytes)`);
      chunkFailures++;
      continue;
    }

    let gltf;
    try {
      gltf = await loadGlb(fpath);
    } catch (e) {
      fail(`Chunk parse error: ${entry.file} — ${e.message}`);
      chunkFailures++;
      continue;
    }

    const info = inspectGeometry(gltf);
    if (info.nanFound || info.infFound) {
      fail(`Chunk ${entry.file} contains NaN/Infinity vertices`);
      chunkFailures++;
      continue;
    }

    if (info.totalVerts < MIN_MEANINGFUL_VERTS) {
      fail(`Chunk ${entry.file} lacks meaningful geometry (${info.totalVerts} vertices < ${MIN_MEANINGFUL_VERTS})`);
      chunkFailures++;
      continue;
    }

    const cb = entry.cellBounds;
    if (!cb) {
      fail(`Chunk ${entry.file} missing cellBounds in manifest`);
      chunkFailures++;
      continue;
    }

    // Check every vertex lies inside declared cellBounds
    let outOfBoundsCount = 0;
    gltf.scene.traverse((obj) => {
      if (!obj.isMesh) return;
      const pos = obj.geometry.getAttribute('position');
      if (!pos) return;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld);
        if (
          v.x < cb.minX - CELL_TOLERANCE_M || v.x > cb.maxX + CELL_TOLERANCE_M ||
          v.z < cb.minZ - CELL_TOLERANCE_M || v.z > cb.maxZ + CELL_TOLERANCE_M
        ) {
          outOfBoundsCount++;
        }
      }
    });

    if (outOfBoundsCount > 0) {
      fail(`Chunk ${entry.file} has ${outOfBoundsCount} vertices outside cellBounds [${cb.minX}..${cb.maxX}, ${cb.minZ}..${cb.maxZ}]`);
      chunkFailures++;
      continue;
    }

    // Check no chunk contains giant 4 km ground plane
    const spanX = info.box.max.x - info.box.min.x;
    const spanZ = info.box.max.z - info.box.min.z;
    if (spanX > MAX_CHUNK_SPAN_M || spanZ > MAX_CHUNK_SPAN_M) {
      fail(`Chunk ${entry.file} spans ${spanX.toFixed(1)}m × ${spanZ.toFixed(1)}m (exceeds ${MAX_CHUNK_SPAN_M}m)`);
      chunkFailures++;
      continue;
    }

    // Check manifest bbox matches actual geometry
    if (entry.bbox) {
      const tol = 0.1;
      const match =
        Math.abs(info.box.min.x - entry.bbox.min.x) < tol &&
        Math.abs(info.box.min.z - entry.bbox.min.z) < tol &&
        Math.abs(info.box.max.x - entry.bbox.max.x) < tol &&
        Math.abs(info.box.max.z - entry.bbox.max.z) < tol;
      if (!match) {
        fail(`Chunk ${entry.file}: manifest bbox does not match actual GLB geometry`);
        chunkFailures++;
        continue;
      }
    }

    unionBox.union(info.box);
    totalChunkTris += info.totalTris;
    totalChunkBuildings += info.buildingMeshes;
    totalChunkRoads += info.roadMeshes;
    console.log(
      `  • ${entry.file}: ${info.totalVerts} verts, ${info.totalTris} tris, ` +
      `X[${info.box.min.x.toFixed(1)}..${info.box.max.x.toFixed(1)}] ` +
      `Z[${info.box.min.z.toFixed(1)}..${info.box.max.z.toFixed(1)}]`
    );
  }

  if (chunkFailures === 0) {
    pass(`All ${manifest.chunks.length} chunks passed spatial, bounds, and geometry checks`);
  }

  // Check for stale unreferenced chunk files on disk
  const diskFiles = (await fs.readdir(CHUNKS_DIR)).filter((f) => f.endsWith('.glb'));
  const stale = diskFiles.filter((f) => !referencedFiles.has(f));
  if (stale.length > 0) {
    fail(`Found ${stale.length} stale unreferenced chunk files in ${CHUNKS_DIR}: ${stale.slice(0, 5).join(', ')}`);
  } else {
    pass('No stale unreferenced chunk files on disk');
  }

  // Verify building & road geometry preserved
  if (totalChunkBuildings === 0 || totalChunkRoads === 0) {
    fail(`Partitioned chunks missing building or road geometry (buildings=${totalChunkBuildings}, roads=${totalChunkRoads})`);
  } else {
    pass(`Building & road geometry preserved across chunks (${totalChunkTris.toLocaleString()} total tris)`);
  }

  if (worldInfo) {
    if (totalChunkTris < worldInfo.totalTris) {
      fail(`Chunk triangle count (${totalChunkTris}) is less than world.glb (${worldInfo.totalTris}) — geometry was lost`);
    } else {
      pass(`No geometry lost during partitioning (${totalChunkTris} chunk tris >= ${worldInfo.totalTris} source tris)`);
    }

    const tol = 0.2;
    const coversWorld =
      unionBox.min.x <= worldInfo.box.min.x + tol &&
      unionBox.max.x >= worldInfo.box.max.x - tol &&
      unionBox.min.z <= worldInfo.box.min.z + tol &&
      unionBox.max.z >= worldInfo.box.max.z - tol;
    if (!coversWorld) {
      fail('Union of chunk bounding boxes does not cover world.glb bounding box');
    } else {
      pass('Union of chunk bounding boxes covers world.glb');
    }

    if (unionBox.containsPoint(new THREE.Vector3(0, 0, 0))) {
      pass('Chunked world contains campus origin (0,0,0)');
    } else {
      warn('Chunked world does not contain (0,0,0)');
    }
  }
}

async function main() {
  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║   NAMMA RVITM – World Validator       ║');
  console.log('╚═══════════════════════════════════════╝');

  const worldInfo = await checkWorldGlb();
  const manifest  = await checkManifest();
  await checkChunks(manifest, worldInfo);

  console.log('\n──────────────────────────────────────────────────────');
  console.log(`Result: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.error('\nValidation FAILED.\n');
    process.exit(1);
  }
  console.log('\nValidation PASSED.\n');
}

main().catch((e) => {
  console.error('validate-world.mjs error:', e);
  process.exit(1);
});
