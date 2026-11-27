// split-world-chunks.mjs — pure Node.js ES module
//
// Splits public/world/generated/world.glb into 500 m × 500 m spatial chunks
// using exact Sutherland-Hodgman 2D polygon clipping against each cell's bounds
// [minX, maxX] × [minZ, maxZ].
//
// - Skips any ground plane mesh (ground is handled separately at runtime).
// - Removes stale chunk_*.glb files before regenerating.
// - Preserves materials, normals, and world coordinates.
// - Calculates each chunk's real bounding box from its clipped geometry.
//
// Outputs:
//   public/world/generated/chunks/chunk_<cx>_<cz>.glb
//   public/world/generated/manifest.json

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const INPUT_GLB  = path.resolve(ROOT, 'public/world/generated/world.glb');
const OUTPUT_DIR = path.resolve(ROOT, 'public/world/generated/chunks');
const MANIFEST   = path.resolve(ROOT, 'public/world/generated/manifest.json');

const CHUNK_SIZE  = 500;   // metres
const WORLD_LIMIT = 2500;  // metres

if (typeof global.self === 'undefined') global.self = global;
if (typeof global.DOMParser === 'undefined') {
  global.DOMParser = class {
    parseFromString() { return {}; }
  };
}

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

function cellKey(cx, cz) {
  return `${cx}_${cz}`;
}

function cellBounds(cx, cz) {
  return {
    minX: cx * CHUNK_SIZE,
    maxX: (cx + 1) * CHUNK_SIZE,
    minZ: cz * CHUNK_SIZE,
    maxZ: (cz + 1) * CHUNK_SIZE,
  };
}

function cellsForTriangle(ax, az, bx, bz, cx2, cz2) {
  const minX = Math.min(ax, bx, cx2);
  const maxX = Math.max(ax, bx, cx2);
  const minZ = Math.min(az, bz, cz2);
  const maxZ = Math.max(az, bz, cz2);

  const startCX = Math.floor(minX / CHUNK_SIZE);
  const endCX   = Math.floor((maxX - 1e-6) / CHUNK_SIZE);
  const startCZ = Math.floor(minZ / CHUNK_SIZE);
  const endCZ   = Math.floor((maxZ - 1e-6) / CHUNK_SIZE);

  const cells = [];
  for (let ccx = startCX; ccx <= endCX; ccx++) {
    for (let ccz = startCZ; ccz <= endCZ; ccz++) {
      cells.push({ cx: ccx, cz: ccz });
    }
  }
  return cells;
}

// ─── Sutherland-Hodgman 2D triangle clipping against [minX, maxX] × [minZ, maxZ] ───

function lerpVertex(a, b, t) {
  const nx = a.nx + (b.nx - a.nx) * t;
  const ny = a.ny + (b.ny - a.ny) * t;
  const nz = a.nz + (b.nz - a.nz) * t;
  const len = Math.hypot(nx, ny, nz) || 1;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
    nx: nx / len,
    ny: ny / len,
    nz: nz / len,
  };
}

function clipPolyAgainstPlane(poly, insideFn, intersectFn) {
  if (poly.length === 0) return [];
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];
    const curIn = insideFn(cur);
    const prevIn = insideFn(prev);
    if (curIn) {
      if (!prevIn) out.push(intersectFn(prev, cur));
      out.push(cur);
    } else if (prevIn) {
      out.push(intersectFn(prev, cur));
    }
  }
  return out;
}

function clipTriangleToBounds(v0, v1, v2, b) {
  let poly = [v0, v1, v2];

  // Left: x >= minX
  poly = clipPolyAgainstPlane(
    poly,
    (v) => v.x >= b.minX,
    (p, c) => lerpVertex(p, c, (b.minX - p.x) / (c.x - p.x || 1e-12))
  );
  // Right: x <= maxX
  poly = clipPolyAgainstPlane(
    poly,
    (v) => v.x <= b.maxX,
    (p, c) => lerpVertex(p, c, (b.maxX - p.x) / (c.x - p.x || 1e-12))
  );
  // Top: z >= minZ
  poly = clipPolyAgainstPlane(
    poly,
    (v) => v.z >= b.minZ,
    (p, c) => lerpVertex(p, c, (b.minZ - p.z) / (c.z - p.z || 1e-12))
  );
  // Bottom: z <= maxZ
  poly = clipPolyAgainstPlane(
    poly,
    (v) => v.z <= b.maxZ,
    (p, c) => lerpVertex(p, c, (b.maxZ - p.z) / (c.z - p.z || 1e-12))
  );

  if (poly.length < 3) return [];

  // Fan-triangulate convex clipped polygon, filtering zero-area slivers
  const tris = [];
  for (let i = 1; i < poly.length - 1; i++) {
    const a = poly[0];
    const d = poly[i];
    const e = poly[i + 1];
    // 3D cross product area check
    const ux = d.x - a.x, uy = d.y - a.y, uz = d.z - a.z;
    const vx = e.x - a.x, vy = e.y - a.y, vz = e.z - a.z;
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    if (cx * cx + cy * cy + cz * cz > 1e-10) {
      tris.push([a, d, e]);
    }
  }
  return tris;
}

async function loadGlb(glbPath) {
  const buf = await fs.readFile(glbPath);
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      '',
      resolve,
      reject
    );
  });
}

function getMaterialKeyAndProps(mat, meshName) {
  const m = Array.isArray(mat) ? mat[0] : mat;
  if (!m) {
    return {
      key: `${meshName}_default`,
      name: meshName || 'default',
      color: [0.55, 0.55, 0.55, 1.0],
      metallic: 0.0,
      roughness: 0.9,
    };
  }
  const c = m.color ? [m.color.r, m.color.g, m.color.b, m.opacity ?? 1.0] : [0.55, 0.55, 0.55, 1.0];
  const metallic = typeof m.metalness === 'number' ? m.metalness : 0.0;
  const roughness = typeof m.roughness === 'number' ? m.roughness : 0.9;
  const name = meshName || m.name || `mat_${c.map((v) => v.toFixed(3)).join('_')}`;
  const key = `${name}_${c.map((v) => v.toFixed(4)).join('_')}_${metallic.toFixed(2)}_${roughness.toFixed(2)}`;
  return { key, name, color: c, metallic, roughness };
}

function extractPrimitives(gltf) {
  const result = [];
  gltf.scene.updateWorldMatrix(true, true);
  gltf.scene.traverse((obj) => {
    if (!obj.isMesh) return;
    if (obj.name && obj.name.toLowerCase() === 'ground') return;

    const geom = obj.geometry.clone();
    geom.applyMatrix4(obj.matrixWorld);
    if (!geom.getAttribute('normal')) {
      geom.computeVertexNormals();
    }
    const pos = geom.getAttribute('position');
    const norm = geom.getAttribute('normal');
    if (!pos) return;

    let indices = null;
    if (geom.index) {
      const idx = geom.index.array;
      indices = idx instanceof Uint32Array ? new Uint32Array(idx) : new Uint32Array(idx);
    }

    result.push({
      positions: new Float32Array(pos.array),
      normals: norm ? new Float32Array(norm.array) : null,
      indices,
      matInfo: getMaterialKeyAndProps(obj.material, obj.name),
    });
  });
  return result;
}

function distributeTriangles(primitives) {
  const cellData = new Map();

  for (const prim of primitives) {
    const { positions, normals, indices, matInfo } = prim;
    const triCount = indices ? indices.length / 3 : positions.length / 9;

    for (let t = 0; t < triCount; t++) {
      let i0, i1, i2;
      if (indices) {
        i0 = indices[t * 3];
        i1 = indices[t * 3 + 1];
        i2 = indices[t * 3 + 2];
      } else {
        i0 = t * 3;
        i1 = t * 3 + 1;
        i2 = t * 3 + 2;
      }

      const v0 = {
        x: positions[i0 * 3], y: positions[i0 * 3 + 1], z: positions[i0 * 3 + 2],
        nx: normals ? normals[i0 * 3] : 0, ny: normals ? normals[i0 * 3 + 1] : 1, nz: normals ? normals[i0 * 3 + 2] : 0,
      };
      const v1 = {
        x: positions[i1 * 3], y: positions[i1 * 3 + 1], z: positions[i1 * 3 + 2],
        nx: normals ? normals[i1 * 3] : 0, ny: normals ? normals[i1 * 3 + 1] : 1, nz: normals ? normals[i1 * 3 + 2] : 0,
      };
      const v2 = {
        x: positions[i2 * 3], y: positions[i2 * 3 + 1], z: positions[i2 * 3 + 2],
        nx: normals ? normals[i2 * 3] : 0, ny: normals ? normals[i2 * 3 + 1] : 1, nz: normals ? normals[i2 * 3 + 2] : 0,
      };

      const cells = cellsForTriangle(v0.x, v0.z, v1.x, v1.z, v2.x, v2.z);

      for (const { cx: ccx, cz: ccz } of cells) {
        const b = cellBounds(ccx, ccz);
        if (
          b.maxX < -WORLD_LIMIT || b.minX > WORLD_LIMIT ||
          b.maxZ < -WORLD_LIMIT || b.minZ > WORLD_LIMIT
        ) {
          continue;
        }

        const clippedTris = clipTriangleToBounds(v0, v1, v2, b);
        if (clippedTris.length === 0) continue;

        const key = cellKey(ccx, ccz);
        let cell = cellData.get(key);
        if (!cell) {
          cell = {
            cx: ccx,
            cz: ccz,
            minX: Infinity, minY: Infinity, minZ: Infinity,
            maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity,
            triCount: 0,
            matGroups: new Map(),
          };
          cellData.set(key, cell);
        }

        let group = cell.matGroups.get(matInfo.key);
        if (!group) {
          group = { matInfo, pos: [], norm: [] };
          cell.matGroups.set(matInfo.key, group);
        }

        for (const [a, d, e] of clippedTris) {
          group.pos.push(a.x, a.y, a.z, d.x, d.y, d.z, e.x, e.y, e.z);
          group.norm.push(a.nx, a.ny, a.nz, d.nx, d.ny, d.nz, e.nx, e.ny, e.nz);
          cell.triCount++;

          for (const v of [a, d, e]) {
            if (v.x < cell.minX) cell.minX = v.x;
            if (v.x > cell.maxX) cell.maxX = v.x;
            if (v.y < cell.minY) cell.minY = v.y;
            if (v.y > cell.maxY) cell.maxY = v.y;
            if (v.z < cell.minZ) cell.minZ = v.z;
            if (v.z > cell.maxZ) cell.maxZ = v.z;
          }
        }
      }
    }
  }

  return cellData;
}

function writeChunkGLB(matGroups) {
  const binParts = [];
  const accessors = [];
  const meshDefs = [];
  const materials = [];

  for (const group of matGroups.values()) {
    const { matInfo, pos, norm } = group;
    const count = pos.length / 3;
    if (count === 0) continue;

    const posBuf = Buffer.allocUnsafe(count * 3 * 4);
    const normBuf = Buffer.allocUnsafe(count * 3 * 4);
    for (let i = 0; i < pos.length; i++) posBuf.writeFloatLE(pos[i], i * 4);
    for (let i = 0; i < norm.length; i++) normBuf.writeFloatLE(norm[i], i * 4);

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < pos.length; i += 3) {
      if (pos[i] < minX) minX = pos[i];
      if (pos[i] > maxX) maxX = pos[i];
      if (pos[i + 1] < minY) minY = pos[i + 1];
      if (pos[i + 1] > maxY) maxY = pos[i + 1];
      if (pos[i + 2] < minZ) minZ = pos[i + 2];
      if (pos[i + 2] > maxZ) maxZ = pos[i + 2];
    }

    const posAccIdx = accessors.length;
    const normAccIdx = accessors.length + 1;

    accessors.push({
      bufferView: binParts.length,
      byteOffset: 0,
      componentType: 5126,
      count,
      type: 'VEC3',
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
    });
    binParts.push({ buf: posBuf, byteLength: posBuf.length });

    accessors.push({
      bufferView: binParts.length,
      byteOffset: 0,
      componentType: 5126,
      count,
      type: 'VEC3',
    });
    binParts.push({ buf: normBuf, byteLength: normBuf.length });

    const matIdx = materials.length;
    materials.push({
      name: matInfo.name,
      pbrMetallicRoughness: {
        baseColorFactor: matInfo.color,
        metallicFactor: matInfo.metallic,
        roughnessFactor: matInfo.roughness,
      },
      doubleSided: false,
    });

    meshDefs.push({
      name: matInfo.name,
      primitives: [{
        attributes: { POSITION: posAccIdx, NORMAL: normAccIdx },
        material: matIdx,
        mode: 4,
      }],
    });
  }

  const bufferViews = [];
  let bvOffset = 0;
  for (const part of binParts) {
    bufferViews.push({ buffer: 0, byteOffset: bvOffset, byteLength: part.byteLength });
    bvOffset += part.byteLength;
  }

  const nodes = meshDefs.map((m, i) => ({ mesh: i, name: m.name }));
  const json = {
    asset: { version: '2.0', generator: 'NAMMA-RVITM-split-world-chunks.mjs' },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes: meshDefs,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: bvOffset }],
  };

  const jsonStr = JSON.stringify(json);
  const jsonPad = (4 - (jsonStr.length % 4)) % 4;
  const jsonBuf = Buffer.from(jsonStr + ' '.repeat(jsonPad), 'utf8');

  const binChunkData = Buffer.concat(binParts.map((p) => p.buf));
  const binPad = (4 - (binChunkData.length % 4)) % 4;
  const binFull = Buffer.concat([binChunkData, Buffer.alloc(binPad, 0)]);

  const totalLen = 12 + 8 + jsonBuf.length + (binFull.length > 0 ? 8 + binFull.length : 0);

  const header = Buffer.allocUnsafe(12);
  header.writeUInt32LE(0x46546C67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLen, 8);

  const jsonChunkHeader = Buffer.allocUnsafe(8);
  jsonChunkHeader.writeUInt32LE(jsonBuf.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4E4F534A, 4);

  const parts = [header, jsonChunkHeader, jsonBuf];
  if (binFull.length > 0) {
    const binChunkHeader = Buffer.allocUnsafe(8);
    binChunkHeader.writeUInt32LE(binFull.length, 0);
    binChunkHeader.writeUInt32LE(0x004E4942, 4);
    parts.push(binChunkHeader, binFull);
  }

  return Buffer.concat(parts);
}

async function cleanStaleChunks() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const existing = await fs.readdir(OUTPUT_DIR);
  let removed = 0;
  for (const name of existing) {
    if (name.endsWith('.glb')) {
      await fs.unlink(path.join(OUTPUT_DIR, name));
      removed++;
    }
  }
  if (removed > 0) {
    console.log(`Removed ${removed} stale chunk files`);
  }
}

async function main() {
  console.log('\n=== NAMMA RVITM – Spatial Chunk Splitter (Clipped) ===\n');

  await cleanStaleChunks();

  const hasGlb = await fs.access(INPUT_GLB).then(() => true).catch(() => false);
  if (!hasGlb) {
    console.error(`world.glb not found at ${INPUT_GLB}`);
    console.error('Run `npm run generate-world` first.');
    process.exit(1);
  }

  console.log('Loading', INPUT_GLB, '…');
  const gltf = await loadGlb(INPUT_GLB);

  console.log('Extracting building & road primitives …');
  const primitives = extractPrimitives(gltf);
  console.log(`  Found ${primitives.length} primitives`);

  if (primitives.length === 0) {
    console.error('No mesh geometry found in world.glb. Cannot create chunks.');
    process.exit(1);
  }

  console.log('Clipping & distributing triangles to 500 m × 500 m cells …');
  const cellData = distributeTriangles(primitives);
  console.log(`  ${cellData.size} occupied cells`);

  const manifest = {
    generatedAt: new Date().toISOString(),
    chunkSize: CHUNK_SIZE,
    chunks: [],
  };

  let written = 0;
  for (const [key, cell] of cellData) {
    if (cell.triCount === 0) continue;

    const glbBuf = writeChunkGLB(cell.matGroups);
    const fname = `chunk_${key}.glb`;
    const fpath = path.join(OUTPUT_DIR, fname);
    await fs.writeFile(fpath, glbBuf);

    manifest.chunks.push({
      file: `chunks/${fname}`,
      chunkKey: key,
      cx: cell.cx,
      cz: cell.cz,
      cellBounds: cellBounds(cell.cx, cell.cz),
      bbox: {
        min: { x: cell.minX, y: cell.minY, z: cell.minZ },
        max: { x: cell.maxX, y: cell.maxY, z: cell.maxZ },
      },
      triangles: cell.triCount,
    });
    written++;
  }

  manifest.chunks.sort((a, b) => a.chunkKey.localeCompare(b.chunkKey));

  console.log(`  ${written} chunk files written to ${OUTPUT_DIR}`);
  await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
  console.log('Manifest written →', MANIFEST);
  console.log('\n=== Chunk splitting complete ===\n');
}

main().catch((e) => {
  console.error('split-world-chunks.mjs failed:', e);
  process.exit(1);
});
