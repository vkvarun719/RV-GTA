import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.resolve(__dirname, '../src/data/campus-osm.json');

const ORIGIN_LAT = 12.8729154;
const ORIGIN_LON = 77.5757331;
const RADIUS_M   = 2000; // 2 km radius

const METERS_PER_LAT = 111132;
const METERS_PER_LON = 111320 * Math.cos((ORIGIN_LAT * Math.PI) / 180);

function projectToXZ(lat, lon) {
  const x = Math.round((lon - ORIGIN_LON) * METERS_PER_LON * 10) / 10;
  const z = Math.round((ORIGIN_LAT - lat) * METERS_PER_LAT * 10) / 10;
  return [x, z];
}

function pointLineDist(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const lenSq = dx * dx + dz * dz;
  if (lenSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / lenSq));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz));
}

function simplifyLine(pts, tolerance = 0.8) {
  if (pts.length <= 2) return pts;
  let maxD = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = pointLineDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > tolerance) {
    const left  = simplifyLine(pts.slice(0, idx + 1), tolerance);
    const right = simplifyLine(pts.slice(idx), tolerance);
    return [...left.slice(0, -1), ...right];
  }
  return [pts[0], pts[pts.length - 1]];
}

// ─── Overpass query: 2 km, all relevant features ────────────────────────────
// Using [out:json] with full relation members via ">;" so we can resolve
// all node references for ways and multipolygon relations.
const OVERPASS_QUERY = `[out:json][timeout:180];
(
  way[building](around:${RADIUS_M},${ORIGIN_LAT},${ORIGIN_LON});
  relation[building](around:${RADIUS_M},${ORIGIN_LAT},${ORIGIN_LON});
  way["building:part"](around:${RADIUS_M},${ORIGIN_LAT},${ORIGIN_LON});
  way[highway](around:${RADIUS_M},${ORIGIN_LAT},${ORIGIN_LON});
  way[landuse](around:${RADIUS_M},${ORIGIN_LAT},${ORIGIN_LON});
  way[leisure](around:${RADIUS_M},${ORIGIN_LAT},${ORIGIN_LON});
  way[natural](around:${RADIUS_M},${ORIGIN_LAT},${ORIGIN_LON});
  way[waterway](around:${RADIUS_M},${ORIGIN_LAT},${ORIGIN_LON});
  way[amenity](around:${RADIUS_M},${ORIGIN_LAT},${ORIGIN_LON});
  node[public_transport](around:${RADIUS_M},${ORIGIN_LAT},${ORIGIN_LON});
  node[name][amenity](around:${RADIUS_M},${ORIGIN_LAT},${ORIGIN_LON});
  node[name][shop](around:${RADIUS_M},${ORIGIN_LAT},${ORIGIN_LON});
  way[barrier](around:${RADIUS_M},${ORIGIN_LAT},${ORIGIN_LON});
);
out body;
>;
out skel qt;`;

const ENDPOINTS = [
  // Fast, reliable public mirrors first (verified reachable 2026-11-27).
  'https://overpass.osm.ch/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

// Per-endpoint wall-clock budget. A full 2 km query with all building/road
// features can take 30-90 s on busy public servers, so this is deliberately
// generous. The Overpass query itself carries [timeout:180].
const ENDPOINT_TIMEOUT_MS = 120000;

async function fetchFromOverpass() {
  for (const url of ENDPOINTS) {
    try {
      console.log(`  Trying ${url} …`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ENDPOINT_TIMEOUT_MS);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'NammaRVITM-OSM-Fetcher/2.0 (educational game)',
        },
        body: 'data=' + encodeURIComponent(OVERPASS_QUERY),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        console.log(`    HTTP ${res.status} — skipping`);
        continue;
      }
      const text = await res.text();
      if (!text.trim().startsWith('{')) {
        console.log('    Non-JSON response — skipping');
        continue;
      }
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed.elements) || parsed.elements.length === 0) {
        console.log('    Empty elements — skipping');
        continue;
      }
      console.log(`    Got ${parsed.elements.length} elements from ${url}`);
      return { data: parsed, endpoint: url };
    } catch (e) {
      console.log(`    Error: ${e.message}`);
    }
  }
  return null;
}

// ─── Height derivation (no pseudo-random) ───────────────────────────────────
// Priority:
//   1. building:height (metres, explicit)
//   2. building:levels × 3.0 m/floor
//   3. height tag (metres, some mappers use "height" not "building:height")
//   4. Document as estimated with a flag
//
// DEFAULT_LEVELS_ESTIMATE is used only as a last resort and is EXPLICITLY
// labelled heightSource: 'estimated-default-3m' in the output so downstream
// code can treat it differently from real data.
const DEFAULT_ESTIMATE_LEVELS = 2;

function deriveHeight(tags) {
  // Explicit height in metres
  const h = parseFloat(tags['building:height'] || tags['height'] || '');
  if (Number.isFinite(h) && h > 0) {
    return { levels: Math.round(h / 3.0), heightM: h, heightSource: 'mapped-height' };
  }
  // Explicit floor count
  const lv = parseInt(tags['building:levels'] || tags['levels'] || '', 10);
  if (Number.isFinite(lv) && lv > 0) {
    return { levels: lv, heightM: lv * 3.0, heightSource: 'mapped-levels' };
  }
  // No height data at all — use documented default, flagged explicitly
  return {
    levels: DEFAULT_ESTIMATE_LEVELS,
    heightM: DEFAULT_ESTIMATE_LEVELS * 3.0,
    heightSource: 'estimated-default-3m',
  };
}

function buildDataset(osm, endpoint) {
  // Build node lookup: id → {lat, lon} and id → [x, z]
  const nodeCoords   = new Map(); // id → [x, z]
  const nodeLatLon   = new Map(); // id → {lat, lon}
  const pois         = [];

  for (const el of osm.elements) {
    if (el.type !== 'node') continue;
    const xz = projectToXZ(el.lat, el.lon);
    nodeCoords.set(el.id, xz);
    nodeLatLon.set(el.id, { lat: el.lat, lon: el.lon });
    if (el.tags && (el.tags.name || el.tags.amenity || el.tags.shop || el.tags.public_transport)) {
      pois.push({
        osmId:  el.id,
        name:   el.tags.name || null,
        type:   el.tags.amenity || el.tags.shop || el.tags.public_transport || 'poi',
        x:      xz[0],
        z:      xz[1],
        lat:    el.lat,
        lon:    el.lon,
      });
    }
  }

  let campusPolygon = null;
  let academicBuilding = null;
  const roads     = [];
  const buildings = [];
  const landuse   = [];

  // Track which way IDs have been used as building parts of relations
  // so we don't double-add them as standalone buildings.
  const relationMemberWayIds = new Set();

  // First pass: find relation members
  for (const el of osm.elements) {
    if (el.type !== 'relation') continue;
    if (el.members) {
      for (const m of el.members) {
        if (m.type === 'way') relationMemberWayIds.add(m.ref);
      }
    }
  }

  // Process ways
  for (const el of osm.elements) {
    if (el.type !== 'way' || !el.nodes || !el.tags) continue;
    const pts = el.nodes.map(id => nodeCoords.get(id)).filter(Boolean);
    if (pts.length < 2) continue;

    // Campus boundary detection
    if (
      el.tags.amenity === 'college' ||
      el.tags.amenity === 'university' ||
      (el.tags.name && el.tags.name.toLowerCase().includes('rv institute'))
    ) {
      campusPolygon = pts.slice(0, -1);
      continue;
    }

    if (el.tags.building || el.tags['building:part']) {
      const closed = pts[0] === pts[pts.length - 1] ? pts.slice(0, -1) : pts;
      if (closed.length < 3) continue;

      const cx = closed.reduce((s, p) => s + p[0], 0) / closed.length;
      const cz = closed.reduce((s, p) => s + p[1], 0) / closed.length;

      // Identify RVITM main academic block
      if (
        Math.abs(cx) < 28 && cz > -35 && cz < 45 &&
        closed.length >= 4 && !academicBuilding
      ) {
        academicBuilding = simplifyLine(closed, 0.4);
        // Still add it to buildings array
      }

      const hd = deriveHeight(el.tags);
      buildings.push({
        id:          el.id,
        name:        el.tags.name || null,
        building:    el.tags.building || el.tags['building:part'] || 'yes',
        levels:      hd.levels,
        heightM:     hd.heightM,
        heightSource: hd.heightSource,
        roofShape:   el.tags['roof:shape'] || null,
        amenity:     el.tags.amenity || null,
        points:      simplifyLine(closed, 0.5),
      });
      continue;
    }

    if (el.tags.highway) {
      const hw = el.tags.highway;
      // Skip tiny features not useful for rendering/collision
      if (['footway', 'path', 'steps', 'cycleway', 'platform'].includes(hw)) {
        // Still include pedestrian paths but mark them
      }
      const lanesTag = parseInt(el.tags.lanes || '', 10);
      const widthTag = parseFloat(el.tags.width || el.tags.est_width || '');
      const defaultWidth =
        hw === 'motorway' || hw === 'trunk'  ? 12 :
        hw === 'primary'  || hw === 'secondary' ? 9.5 :
        hw === 'tertiary' ? 8 :
        hw === 'residential' || hw === 'unclassified' ? 6 :
        hw === 'service' ? 4 :
        3;
      roads.push({
        id:      el.id,
        name:    el.tags.name || null,
        highway: hw,
        ref:     el.tags.ref || null,
        oneway:  el.tags.oneway || null,
        access:  el.tags.access || null,
        lanes:   Number.isFinite(lanesTag) ? lanesTag : (hw === 'secondary' || hw === 'primary' ? 2 : 1),
        width:   Number.isFinite(widthTag) ? widthTag : defaultWidth,
        points:  simplifyLine(pts, 0.9),
      });
      continue;
    }

    if (el.tags.landuse || el.tags.leisure || el.tags.natural) {
      const closed = pts[0] === pts[pts.length - 1] ? pts.slice(0, -1) : pts;
      if (closed.length < 3) continue;
      landuse.push({
        id:      el.id,
        type:    el.tags.landuse || el.tags.leisure || el.tags.natural,
        name:    el.tags.name || null,
        points:  simplifyLine(closed, 1.0),
      });
    }
  }

  // Process multipolygon building relations
  for (const el of osm.elements) {
    if (el.type !== 'relation' || !el.tags || !el.tags.building) continue;
    if (!el.members) continue;

    // Collect outer ring nodes
    const outerNodes = [];
    for (const m of el.members) {
      if (m.type !== 'way' || m.role !== 'outer') continue;
      // Find the way element
      const way = osm.elements.find(w => w.type === 'way' && w.id === m.ref);
      if (!way || !way.nodes) continue;
      const pts2 = way.nodes.map(id => nodeCoords.get(id)).filter(Boolean);
      if (outerNodes.length > 0 && pts2.length > 0) {
        // Skip duplicate junction node
        outerNodes.push(...pts2.slice(1));
      } else {
        outerNodes.push(...pts2);
      }
    }
    if (outerNodes.length < 3) continue;
    const closed = outerNodes[0] === outerNodes[outerNodes.length - 1]
      ? outerNodes.slice(0, -1) : outerNodes;
    const hd = deriveHeight(el.tags);
    buildings.push({
      id:          el.id,
      name:        el.tags.name || null,
      building:    el.tags.building || 'yes',
      levels:      hd.levels,
      heightM:     hd.heightM,
      heightSource: hd.heightSource,
      roofShape:   el.tags['roof:shape'] || null,
      amenity:     el.tags.amenity || null,
      relation:    true,
      points:      simplifyLine(closed, 0.5),
    });
  }

  // Count height sources for transparency
  const heightStats = { 'mapped-height': 0, 'mapped-levels': 0, 'estimated-default-3m': 0 };
  for (const b of buildings) heightStats[b.heightSource] = (heightStats[b.heightSource] || 0) + 1;

  return {
    meta: {
      source:          'overpass-api',
      endpoint,
      origin:          { lat: ORIGIN_LAT, lon: ORIGIN_LON },
      radiusMeters:    RADIUS_M,
      generatedAt:     new Date().toISOString(),
      attribution:     '© OpenStreetMap contributors, ODbL 1.0',
      heightStats,
      note: 'heightSource field on each building: mapped-height=real data, mapped-levels=real level count×3m, estimated-default-3m=no OSM data available',
    },
    campusPolygon:    campusPolygon || [],
    academicBuilding: academicBuilding || [],
    roads,
    buildings,
    landuse,
    pois,
  };
}

async function main() {
  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });

  console.log(`Querying Overpass API around ${ORIGIN_LAT}, ${ORIGIN_LON} (${RADIUS_M} m) …`);
  const result = await fetchFromOverpass();

  if (result) {
    const dataset = buildDataset(result.data, result.endpoint);
    await fs.writeFile(OUT_FILE, JSON.stringify(dataset, null, 2), 'utf8');
    const hs = dataset.meta.heightStats;
    console.log(`\nSaved to ${OUT_FILE}`);
    console.log(`  Roads:     ${dataset.roads.length}`);
    console.log(`  Buildings: ${dataset.buildings.length}`);
    console.log(`  Land use:  ${dataset.landuse.length}`);
    console.log(`  POIs:      ${dataset.pois.length}`);
    console.log(`  Height sources: mapped-height=${hs['mapped-height']}, mapped-levels=${hs['mapped-levels']}, estimated-default=${hs['estimated-default-3m']}`);
    return;
  }

  // ── All endpoints failed ──────────────────────────────────────────────────
  console.error('\n[BLOCKED] All configured Overpass endpoints failed from this environment.');
  console.error('  See the per-endpoint HTTP status / error messages logged above.');
  console.error('\nThe existing campus-osm.json has NOT been replaced.');

  // Check what we currently have
  try {
    const existing = JSON.parse(await fs.readFile(OUT_FILE, 'utf8'));
    const r = existing.meta?.radiusMeters ?? 'unknown';
    console.error(`  Current file: radius=${r} m, source=${existing.meta?.source}`);
    if (r < 2000) {
      console.error(`  WARNING: existing dataset covers only ${r} m, not 2000 m.`);
      console.error('  Run this script from a network-connected environment to get the full 2 km dataset.');
    }
  } catch {
    console.error('  No existing campus-osm.json found.');
  }

  process.exit(1);
}

main();
