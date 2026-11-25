import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.resolve(__dirname, '../src/data/campus-osm.json');

const ORIGIN_LAT = 12.8729154;
const ORIGIN_LON = 77.5757331;
const RADIUS_M = 250;

const METERS_PER_LAT = 111132;
const METERS_PER_LON = 111320 * Math.cos((ORIGIN_LAT * Math.PI) / 180);

function projectToXZ(lat, lon) {
  const x = Math.round((lon - ORIGIN_LON) * METERS_PER_LON * 10) / 10;
  const z = Math.round((ORIGIN_LAT - lat) * METERS_PER_LAT * 10) / 10;
  return [x, z];
}

function pointLineDist(p, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const lenSq = dx * dx + dz * dz;
  if (lenSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / lenSq));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz));
}

function simplifyLine(pts, tolerance = 0.8) {
  if (pts.length <= 2) return pts;
  let maxD = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = pointLineDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD > tolerance) {
    const left = simplifyLine(pts.slice(0, idx + 1), tolerance);
    const right = simplifyLine(pts.slice(idx), tolerance);
    return [...left.slice(0, -1), ...right];
  }
  return [pts[0], pts[pts.length - 1]];
}

const OVERPASS_QUERY = `[out:json][timeout:25];
(
  way(around:${RADIUS_M},${ORIGIN_LAT},${ORIGIN_LON})[highway];
  way(around:${RADIUS_M},${ORIGIN_LAT},${ORIGIN_LON})[building];
  way(around:${RADIUS_M},${ORIGIN_LAT},${ORIGIN_LON})[amenity];
  node(around:${RADIUS_M},${ORIGIN_LAT},${ORIGIN_LON})[name];
);
out body;
>;
out skel qt;`;

const ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const FALLBACK_DATA = {
  meta: {
    source: 'offline-fallback',
    origin: { lat: ORIGIN_LAT, lon: ORIGIN_LON },
    radiusMeters: RADIUS_M,
    generatedAt: new Date().toISOString(),
  },
  campusPolygon: [
    [-38.2, 66.5],
    [-25.3, -13.6],
    [-27.4, -60.1],
    [33.5, -39.4],
    [58.0, -34.4],
    [40.0, 91.3],
    [-5.5, 71.9],
  ],
  academicBuilding: [
    [-26.5, 54.0],
    [-13.4, -6.9],
    [-8.6, -36.8],
    [22.2, -32.3],
    [2.1, 61.6],
  ],
  roads: [
    {
      id: 780819157,
      name: '80 Feet Road',
      highway: 'secondary',
      lanes: 2,
      width: 11,
      points: [
        [28.2, 231.4],
        [40.7, 144.6],
        [50.1, 79.5],
        [61.2, -12.3],
        [68.8, -78.8],
        [80.6, -193.6],
      ],
    },
    {
      id: 25064177,
      name: 'Brookes Haven Main Road',
      highway: 'residential',
      lanes: 2,
      width: 8,
      points: [
        [-204.7, 156.4],
        [-113.5, 152.5],
        [-15.8, 147.4],
        [40.7, 144.6],
      ],
    },
    {
      id: 384133688,
      name: 'Chaithanya Layout Lane',
      highway: 'residential',
      lanes: 1,
      width: 6,
      points: [
        [-45.2, 62.0],
        [-75.0, 61.0],
        [-79.9, 58.1],
        [-74.7, -11.9],
        [-71.5, -62.2],
        [-103.0, -66.3],
      ],
    },
  ],
  buildings: [
    { id: 1501661208, name: 'Opposite Commercial Block', levels: 2, points: [[69.8, 67.8], [86.5, 69.4], [84.0, 96.0], [67.3, 94.5]] },
    { id: 1328835828, name: 'Chai & Xerox Corner', levels: 2, points: [[92.8, 9.5], [109.6, 11.1], [108.6, 22.0], [91.7, 20.3]] },
    { id: 1328835829, name: 'JP Nagar Residence', levels: 3, points: [[101.7, -64.6], [119.1, -62.4], [117.7, -51.4], [100.3, -53.6]] },
    { id: 1499523241, name: 'Chaithanya House A', levels: 2, points: [[-48.8, 8.3], [-50.3, 19.5], [-58.1, 18.5], [-56.6, 7.3]] },
    { id: 1499523242, name: 'Chaithanya House B', levels: 2, points: [[-39.2, 9.5], [-40.6, 20.9], [-49.1, 19.9], [-47.7, 8.5]] },
  ],
  pois: [
    { name: 'RV Institute of Technology and Management', type: 'college', x: 0, z: 18 },
    { name: 'Sarathi Nagara BMTC Stop', type: 'bus_stop', x: -245, z: -105 },
  ],
};

async function fetchFromOverpass() {
  for (const url of ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 18000);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'NammaRVITM-OSM-Fetcher/1.0',
        },
        body: 'data=' + encodeURIComponent(OVERPASS_QUERY),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.trim().startsWith('{')) continue;
      return { data: JSON.parse(text), endpoint: url };
    } catch {
      // Try next Overpass mirror
    }
  }
  return null;
}

function buildDataset(osm, endpoint) {
  const nodeCoords = new Map();
  const pois = [];
  for (const el of osm.elements) {
    if (el.type === 'node') {
      const xz = projectToXZ(el.lat, el.lon);
      nodeCoords.set(el.id, xz);
      if (el.tags && el.tags.name) {
        pois.push({
          name: el.tags.name,
          type: el.tags.highway || el.tags.amenity || el.tags.shop || el.tags.place || 'poi',
          x: xz[0],
          z: xz[1],
        });
      }
    }
  }

  let campusPolygon = FALLBACK_DATA.campusPolygon;
  let academicBuilding = FALLBACK_DATA.academicBuilding;
  const roads = [];
  const buildings = [];

  for (const el of osm.elements) {
    if (el.type !== 'way' || !el.nodes || !el.tags) continue;
    const pts = el.nodes.map((id) => nodeCoords.get(id)).filter(Boolean);
    if (pts.length < 2) continue;

    if (el.tags.amenity === 'college' || (el.tags.name && el.tags.name.includes('RV Institute'))) {
      campusPolygon = pts.slice(0, -1);
      continue;
    }

    if (el.tags.building) {
      const closed = pts.slice(0, -1);
      const cx = closed.reduce((s, p) => s + p[0], 0) / closed.length;
      const cz = closed.reduce((s, p) => s + p[1], 0) / closed.length;
      // Check if this is the main academic block inside RVITM campus center
      if (Math.abs(cx) < 28 && cz > -35 && cz < 45 && closed.length >= 4) {
        academicBuilding = simplifyLine(closed, 0.4);
        continue;
      }
      const levelsTag = Number.parseInt(el.tags['building:levels'] || '', 10);
      const levels = Number.isFinite(levelsTag)
        ? levelsTag
        : 1 + (Math.abs(el.id) % 3);
      buildings.push({
        id: el.id,
        name: el.tags.name || undefined,
        levels,
        points: simplifyLine(closed, 0.5),
      });
      continue;
    }

    if (el.tags.highway) {
      const hw = el.tags.highway;
      if (hw === 'footway' || hw === 'path' || hw === 'steps') continue;
      const lanesTag = Number.parseInt(el.tags.lanes || '', 10);
      const width =
        hw === 'secondary' || hw === 'primary'
          ? 9.5
          : hw === 'tertiary'
            ? 8.5
            : hw === 'service'
              ? 4.8
              : 6.5;
      roads.push({
        id: el.id,
        name: el.tags.name || undefined,
        highway: hw,
        access: el.tags.access || undefined,
        lanes: Number.isFinite(lanesTag) ? lanesTag : hw === 'secondary' ? 2 : 1,
        width,
        points: simplifyLine(pts, 0.9),
      });
    }
  }

  return {
    meta: {
      source: 'overpass-api',
      endpoint,
      origin: { lat: ORIGIN_LAT, lon: ORIGIN_LON },
      radiusMeters: RADIUS_M,
      generatedAt: new Date().toISOString(),
    },
    campusPolygon,
    academicBuilding,
    roads,
    buildings,
    pois,
  };
}

async function main() {
  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  console.log(`Querying Overpass API around ${ORIGIN_LAT}, ${ORIGIN_LON} (${RADIUS_M}m)...`);
  const result = await fetchFromOverpass();
  if (result) {
    const dataset = buildDataset(result.data, result.endpoint);
    await fs.writeFile(OUT_FILE, JSON.stringify(dataset, null, 2), 'utf8');
    console.log(
      `Saved ${dataset.roads.length} roads, ${dataset.buildings.length} buildings, ${dataset.pois.length} POIs to ${OUT_FILE}`
    );
    return;
  }

  try {
    await fs.access(OUT_FILE);
    console.warn('Overpass unreachable; keeping existing campus-osm.json.');
  } catch {
    await fs.writeFile(OUT_FILE, JSON.stringify(FALLBACK_DATA, null, 2), 'utf8');
    console.warn('Overpass unreachable; wrote offline fallback layout to campus-osm.json.');
  }
}

main();
