// generate-world.mjs
//
// Builds a GLB world file from campus-osm.json.
// Uses pure Node.js — no browser APIs, no OSM2World, no Blender required.
// Writes a valid binary GLTF 2.0 (GLB) using a hand-rolled writer so we avoid
// the Three.js GLTFExporter which requires FileReader/Blob (browser-only APIs).
//
// COORDINATE SYSTEM
//   Origin: RVITM campus centre  12.8729154 N, 77.5757331 E
//   +X = East,  -Z = North,  +Y = Up  (Three.js default)
//   All units: metres.
//
// APPROACH
//   • Extrude building footprints into 3D prisms.
//   • Tessellate road centre-lines into flat ribbon meshes.
//   • Create a 4 km × 4 km ground plane.
//   • Pack all geometry into a single binary GLB.
//
// DOCUMENTED LIMITATIONS
//   • Building shapes are extruded footprint polygons — not detailed facades.
//   • Road meshes are flat ribbons with no kerbs or markings.
//   • No terrain elevation — everything is on Y=0.
//   • No textures in this pass — materials are solid colours by category.
//   • OSM data may not cover the full 2 km if Overpass was unreachable.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT    = path.resolve(__dirname, '..');
const OSM_JSON = path.resolve(ROOT, 'src/data/campus-osm.json');
const OUT_DIR  = path.resolve(ROOT, 'public/world/generated');
const GLB_OUT  = path.join(OUT_DIR, 'world.glb');
const META_OUT = path.join(OUT_DIR, 'metadata.json');

const FLOOR_H = 3.0; // metres per floor (fallback)

// ─── Geometry helpers ─────────────────────────────────────────────────────────

/** Fan-triangulate a simple convex/concave polygon.
 * Returns [x0,y0,z0, x1,y1,z1, ...] flat (no index) */
function triangulatePoly(pts2d, y) {
  if (pts2d.length < 3) return [];
  const result = [];
  for (let i = 1; i < pts2d.length - 1; i++) {
    result.push(
      pts2d[0][0], y, pts2d[0][1],
      pts2d[i][0], y, pts2d[i][1],
      pts2d[i+1][0], y, pts2d[i+1][1],
    );
  }
  return result;
}

/** Extrude a 2D polygon ring into a closed prism.
 * Returns { pos: number[], norm: number[] } */
function extrudeBuilding(pts2d, heightM) {
  const h  = Math.max(0.1, heightM);
  const n  = pts2d.length;
  const pos  = [];
  const norm = [];

  // Roof
  const roofTris = triangulatePoly(pts2d, h);
  for (let i = 0; i < roofTris.length; i += 3) {
    pos.push(roofTris[i], roofTris[i+1], roofTris[i+2]);
    norm.push(0, 1, 0);
  }

  // Walls
  for (let i = 0; i < n; i++) {
    const j  = (i + 1) % n;
    const ax = pts2d[i][0], az = pts2d[i][1];
    const bx = pts2d[j][0], bz = pts2d[j][1];
    const ex = bx - ax, ez = bz - az;
    const len = Math.hypot(ex, ez) || 1;
    const nx = ez / len, nz = -ex / len;

    // Quad as 2 triangles
    pos.push(ax,0,az, bx,0,bz, bx,h,bz);
    norm.push(nx,0,nz, nx,0,nz, nx,0,nz);
    pos.push(ax,0,az, bx,h,bz, ax,h,az);
    norm.push(nx,0,nz, nx,0,nz, nx,0,nz);

    // Architectural roof parapet rim (+0.45 m lip)
    const ph = h + 0.45;
    pos.push(ax,h,az, bx,h,bz, bx,ph,bz);
    norm.push(nx,0,nz, nx,0,nz, nx,0,nz);
    pos.push(ax,h,az, bx,ph,bz, ax,ph,az);
    norm.push(nx,0,nz, nx,0,nz, nx,0,nz);
  }

  return { pos, norm };
}

/** Extrude raised sidewalk kerbs and dashed lane markings for major roads. */
function extrudeRoadDetails(pts, widthM, isMajor) {
  const hw = widthM / 2;
  const pos = [];
  const norm = [];

  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0], az = pts[i][1];
    const bx = pts[i + 1][0], bz = pts[i + 1][1];
    const ex = bx - ax, ez = bz - az;
    const len = Math.hypot(ex, ez) || 1;
    const ux = ex / len, uz = ez / len;
    const rx = uz, rz = -ux;

    // Left & right kerbs (0.4 m wide, y = 0.05)
    for (const side of [-1, 1]) {
      const kIn = side * hw;
      const kOut = side * (hw + 0.45);
      const y = 0.05;
      const a0x = ax + rx * kIn, a0z = az + rz * kIn;
      const a1x = ax + rx * kOut, a1z = az + rz * kOut;
      const b0x = bx + rx * kIn, b0z = bz + rz * kIn;
      const b1x = bx + rx * kOut, b1z = bz + rz * kOut;
      pos.push(a0x, y, a0z, a1x, y, a1z, b1x, y, b1z);
      norm.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      pos.push(a0x, y, a0z, b1x, y, b1z, b0x, y, b0z);
      norm.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
    }

    // Center dashed lane markings on major roads
    if (isMajor && len > 4) {
      const dashLen = 2.4;
      const gapLen = 2.6;
      const mw = 0.14;
      for (let d = 0.5; d + dashLen < len; d += dashLen + gapLen) {
        const sx = ax + ux * d, sz = az + uz * d;
        const fx = ax + ux * (d + dashLen), fz = az + uz * (d + dashLen);
        const y = 0.035;
        pos.push(sx - rx * mw, y, sz - rz * mw, sx + rx * mw, y, sz + rz * mw, fx + rx * mw, y, fz + rz * mw);
        norm.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
        pos.push(sx - rx * mw, y, sz - rz * mw, fx + rx * mw, y, fz + rz * mw, fx - rx * mw, y, fz - rz * mw);
        norm.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      }
    }
  }

  return { pos, norm };
}

/** Extrude a polyline into a flat road ribbon. */
function extrudeRoad(pts, widthM) {
  const hw = widthM / 2;
  const pos  = [];
  const norm = [];
  const y    = 0.02; // slightly above ground to prevent z-fighting

  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0],   az = pts[i][1];
    const bx = pts[i+1][0], bz = pts[i+1][1];
    const ex = bx - ax, ez = bz - az;
    const len = Math.hypot(ex, ez) || 1;
    const rx = ez / len * hw, rz = -ex / len * hw;

    const a0x = ax-rx, a0z = az-rz;
    const a1x = ax+rx, a1z = az+rz;
    const b0x = bx-rx, b0z = bz-rz;
    const b1x = bx+rx, b1z = bz+rz;

    pos.push(a0x,y,a0z, a1x,y,a1z, b1x,y,b1z);
    norm.push(0,1,0, 0,1,0, 0,1,0);
    pos.push(a0x,y,a0z, b1x,y,b1z, b0x,y,b0z);
    norm.push(0,1,0, 0,1,0, 0,1,0);
  }

  return { pos, norm };
}

/** Create a simple ground quad. */
function makeGround(size) {
  const h = size / 2;
  const y = 0;
  return {
    pos:  [-h,y,-h, h,y,-h, h,y,h,  -h,y,-h, h,y,h,  -h,y,h],
    norm: [ 0,1,0,  0,1,0,  0,1,0,   0,1,0,  0,1,0,   0,1,0],
  };
}

// ─── GLB writer ───────────────────────────────────────────────────────────────
// Binary GLTF 2.0 spec: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#binary-gltf-layout
//
// Structure: [GLB header 12b] [JSON chunk] [BIN chunk]
// Each chunk: [length 4b] [type 4b] [data]

function writeGLB(meshes) {
  // meshes: Array of { name, pos: number[], norm: number[], color: [r,g,b] }

  // 1. Pack all binary data into one BIN buffer
  //    Layout: for each mesh: [positions float32][normals float32]
  const binParts = [];
  const accessors = [];
  const meshDefs  = [];
  const materials = [];
  let   byteOffset = 0;

  for (let mi = 0; mi < meshes.length; mi++) {
    const { name, pos, norm, color } = meshes[mi];
    const count = pos.length / 3;
    if (count === 0) continue;

    const posBuf  = Buffer.allocUnsafe(count * 3 * 4);
    const normBuf = Buffer.allocUnsafe(count * 3 * 4);
    for (let i = 0; i < pos.length; i++)  posBuf.writeFloatLE(pos[i],  i * 4);
    for (let i = 0; i < norm.length; i++) normBuf.writeFloatLE(norm[i], i * 4);

    // Compute bounding box for accessor
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < pos.length; i += 3) {
      if (pos[i]   < minX) minX = pos[i];   if (pos[i]   > maxX) maxX = pos[i];
      if (pos[i+1] < minY) minY = pos[i+1]; if (pos[i+1] > maxY) maxY = pos[i+1];
      if (pos[i+2] < minZ) minZ = pos[i+2]; if (pos[i+2] > maxZ) maxZ = pos[i+2];
    }

    const posAccIdx  = accessors.length;
    const normAccIdx = accessors.length + 1;

    accessors.push({
      bufferView: binParts.length,
      byteOffset: 0,
      componentType: 5126, // FLOAT
      count,
      type: 'VEC3',
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
    });
    binParts.push({ buf: posBuf, byteLength: posBuf.length });
    byteOffset += posBuf.length;

    accessors.push({
      bufferView: binParts.length,
      byteOffset: 0,
      componentType: 5126,
      count,
      type: 'VEC3',
    });
    binParts.push({ buf: normBuf, byteLength: normBuf.length });
    byteOffset += normBuf.length;

    // Material (PBR metallic-roughness with solid colour)
    const matIdx = materials.length;
    materials.push({
      name,
      pbrMetallicRoughness: {
        baseColorFactor: [color[0], color[1], color[2], 1.0],
        metallicFactor: 0.0,
        roughnessFactor: 0.9,
      },
      doubleSided: false,
    });

    meshDefs.push({
      name,
      primitives: [{
        attributes: { POSITION: posAccIdx, NORMAL: normAccIdx },
        material: matIdx,
        mode: 4, // TRIANGLES
      }],
    });
  }

  // 2. Build bufferViews
  const bufferViews = [];
  let bvOffset = 0;
  for (const part of binParts) {
    bufferViews.push({ buffer: 0, byteOffset: bvOffset, byteLength: part.byteLength });
    bvOffset += part.byteLength;
  }
  const totalBin = bvOffset;

  // 3. Build JSON
  const nodes = meshDefs.map((m, i) => ({ mesh: i, name: m.name }));
  const json = {
    asset: { version: '2.0', generator: 'NAMMA-RVITM-generate-world.mjs' },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes:      meshDefs,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: totalBin }],
  };

  const jsonStr  = JSON.stringify(json);
  // JSON chunk must be padded to 4-byte boundary with spaces
  const jsonPad  = (4 - (jsonStr.length % 4)) % 4;
  const jsonFull = jsonStr + ' '.repeat(jsonPad);
  const jsonBuf  = Buffer.from(jsonFull, 'utf8');

  // BIN chunk must be padded to 4-byte boundary with zeros
  const binChunkData = Buffer.concat(binParts.map(p => p.buf));
  const binPad       = (4 - (binChunkData.length % 4)) % 4;
  const binFull      = Buffer.concat([binChunkData, Buffer.alloc(binPad, 0)]);

  // GLB header (12 bytes): magic, version, total length
  const headerLen   = 12;
  const jsonChunkLen = 8 + jsonBuf.length;
  const binChunkLen  = binFull.length > 0 ? 8 + binFull.length : 0;
  const totalLen    = headerLen + jsonChunkLen + binChunkLen;

  const header = Buffer.allocUnsafe(12);
  header.writeUInt32LE(0x46546C67, 0); // magic: 'glTF'
  header.writeUInt32LE(2, 4);          // version: 2
  header.writeUInt32LE(totalLen, 8);

  const jsonChunkHeader = Buffer.allocUnsafe(8);
  jsonChunkHeader.writeUInt32LE(jsonBuf.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4E4F534A, 4); // type: 'JSON'

  const parts = [header, jsonChunkHeader, jsonBuf];

  if (binFull.length > 0) {
    const binChunkHeader = Buffer.allocUnsafe(8);
    binChunkHeader.writeUInt32LE(binFull.length, 0);
    binChunkHeader.writeUInt32LE(0x004E4942, 4); // type: 'BIN\0'
    parts.push(binChunkHeader, binFull);
  }

  return Buffer.concat(parts);
}

// ─── Colour palette ───────────────────────────────────────────────────────────

const COLORS = {
  building_concrete:    [0.816, 0.808, 0.788],
  building_residential: [0.910, 0.835, 0.690],
  building_commercial:  [0.690, 0.784, 0.816],
  building_college:     [0.753, 0.627, 0.502],
  road_primary:         [0.267, 0.267, 0.267],
  road_secondary:       [0.333, 0.333, 0.333],
  road_residential:     [0.400, 0.400, 0.400],
  road_service:         [0.467, 0.467, 0.467],
  road_path:            [0.600, 0.600, 0.467],
  ground:               [0.478, 0.620, 0.431],
};

function buildingColor(b) {
  const t = (b.building || '').toLowerCase();
  if (['college','university','school'].includes(t)) return COLORS.building_college;
  if (['retail','commercial','office','shop'].includes(t)) return COLORS.building_commercial;
  if (['residential','apartments','house','detached'].includes(t)) return COLORS.building_residential;
  return COLORS.building_concrete;
}

function roadColor(hw) {
  if (['motorway','trunk','primary'].includes(hw)) return COLORS.road_primary;
  if (['secondary','tertiary'].includes(hw)) return COLORS.road_secondary;
  if (['service','driveway'].includes(hw)) return COLORS.road_service;
  if (['footway','path','cycleway','steps'].includes(hw)) return COLORS.road_path;
  return COLORS.road_residential;
}

// ─── Accumulator helper ───────────────────────────────────────────────────────

function accumulate(byKey, key, geometry) {
  if (!byKey.has(key)) byKey.set(key, { pos: [], norm: [], color: null, name: key });
  const e = byKey.get(key);
  e.pos.push(...geometry.pos);
  e.norm.push(...geometry.norm);
  return e;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== NAMMA RVITM – World GLB Generator (Node-only, no browser APIs) ===\n');

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(path.join(OUT_DIR, 'chunks'), { recursive: true });

  let osmData;
  try {
    osmData = JSON.parse(await fs.readFile(OSM_JSON, 'utf8'));
  } catch (e) {
    console.error('Cannot read campus-osm.json:', e.message);
    console.error('Run `npm run fetch-osm` first (requires network access).');
    process.exit(1);
  }

  const { meta, buildings = [], roads = [] } = osmData;
  console.log(`OSM data: radius=${meta.radiusMeters} m, ${buildings.length} buildings, ${roads.length} roads`);

  if (meta.radiusMeters < 2000) {
    console.warn(`\nWARNING: OSM data covers only ${meta.radiusMeters} m — not the full 2 km.`);
    console.warn('Re-run `npm run fetch-osm` with live Overpass access for full 2 km coverage.\n');
  }

  // Accumulate geometry by material/category key to minimise mesh count.
  // Note: ground is generated separately at runtime in WorldStreamer so it is
  // never duplicated across 500 m × 500 m spatial chunks.
  const meshAccum = new Map();

  // Buildings
  let bldOk = 0, bldSkip = 0;
  for (const b of buildings) {
    if (!b.points || b.points.length < 3) { bldSkip++; continue; }
    const xs = b.points.map(p => p[0]);
    const zs = b.points.map(p => p[1]);
    if (Math.max(...xs) - Math.min(...xs) < 0.5 && Math.max(...zs) - Math.min(...zs) < 0.5) {
      bldSkip++; continue;
    }
    const heightM = b.heightM ?? (b.levels ? b.levels * FLOOR_H : 2 * FLOOR_H);
    let geo;
    try { geo = extrudeBuilding(b.points, heightM); } catch { bldSkip++; continue; }
    if (geo.pos.length === 0) { bldSkip++; continue; }
    const color = buildingColor(b);
    const colorKey = `buildings_${color.join('_')}`;
    const e = accumulate(meshAccum, colorKey, geo);
    if (!e.color) e.color = color;
    e.name = colorKey;
    bldOk++;
  }
  console.log(`Buildings: ${bldOk} added, ${bldSkip} skipped (bad geometry)`);

  // Roads + Kerbs & Lane Markings
  let roadOk = 0;
  for (const r of roads) {
    if (!r.points || r.points.length < 2) continue;
    const width = r.width || 6;
    let geo;
    try { geo = extrudeRoad(r.points, width); } catch { continue; }
    if (geo.pos.length === 0) continue;
    const color = roadColor(r.highway);
    const colorKey = `roads_${color.join('_')}`;
    const e = accumulate(meshAccum, colorKey, geo);
    if (!e.color) e.color = color;
    e.name = colorKey;

    const isMajor = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'].includes(r.highway);
    const det = extrudeRoadDetails(r.points, width, isMajor);
    if (det.pos.length > 0) {
      const detEntry = accumulate(meshAccum, 'roads_kerbs_markings', det);
      if (!detEntry.color) detEntry.color = [0.78, 0.76, 0.72];
      detEntry.name = 'roads_kerbs_markings';
    }
    roadOk++;
  }
  console.log(`Roads: ${roadOk} segments added`);

  // Build mesh list
  const meshList = [];
  for (const [key, e] of meshAccum) {
    if (e.pos.length === 0) continue;
    meshList.push({ name: e.name || key, pos: e.pos, norm: e.norm, color: e.color || [0.5,0.5,0.5] });
  }
  console.log(`Total mesh groups: ${meshList.length}`);

  // Write GLB
  console.log('Writing GLB …');
  const glbBuf = writeGLB(meshList);
  await fs.writeFile(GLB_OUT, glbBuf);
  const glbStat = await fs.stat(GLB_OUT);
  console.log(`GLB written → ${GLB_OUT}  (${(glbStat.size / 1e6).toFixed(2)} MB)`);

  // Metadata
  const heightStats = osmData.meta?.heightStats || {};
  const metaOut = {
    generatedAt:    new Date().toISOString(),
    generator:      'generate-world.mjs (Node.js, hand-rolled GLB writer, no OSM2World or Blender)',
    origin:         { lat: 12.8729154, lon: 77.5757331 },
    radiusMeters:   meta.radiusMeters,
    osmSource:      meta.source,
    osmGeneratedAt: meta.generatedAt,
    attribution:    '© OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright)',
    outputs:        { glb: path.relative(ROOT, GLB_OUT) },
    statistics:     { buildings: bldOk, roads: roadOk, heightSources: heightStats },
    limitations: [
      'Building facades are extruded footprint polygons — no windows/doors in this pass.',
      'Roads are flat ribbons — no intersections, markings or kerbs.',
      'No terrain elevation — everything is on Y=0 ground plane.',
      'No textures in this pass — materials are solid colours.',
      `OSM data covers ${meta.radiusMeters} m${meta.radiusMeters < 2000 ? ' (not full 2 km — re-run fetch-osm with network access)' : ''}.`,
    ],
  };
  await fs.writeFile(META_OUT, JSON.stringify(metaOut, null, 2), 'utf8');
  console.log('Metadata written →', META_OUT);
  console.log('\n=== World generation complete ===\n');
}

main().catch(e => {
  console.error('generate-world.mjs failed:', e);
  process.exit(1);
});
