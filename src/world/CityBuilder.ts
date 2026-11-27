import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LANDMARKS } from '../data/campus-layout';
import osmDataRaw from '../data/campus-osm.json';
import type { BuildingFootprint, OsmDataset, RoadPolyline } from '../types/game';
import type { PhysicsWorld } from '../systems/PhysicsWorld';
import { createAsphaltTexture, createMicroNoiseBumpTexture, createSignboardTexture, createSpeedBreakerTexture } from './Textures';

const osmData = osmDataRaw as unknown as OsmDataset;

export interface CityVisualHandles {
  roadMaterials: THREE.MeshStandardMaterial[];
  shopLights: THREE.MeshStandardMaterial[];
}

export function buildCity(scene: THREE.Scene, physics: PhysicsWorld): CityVisualHandles {
  const group = new THREE.Group();
  const roadMaterials: THREE.MeshStandardMaterial[] = [];
  const shopLights: THREE.MeshStandardMaterial[] = [];

  // 1. Outer Terrain Ground
  const terrain = new THREE.Mesh(
    new THREE.PlaneGeometry(760, 760),
    new THREE.MeshStandardMaterial({ color: 0x5c7c48, roughness: 0.96, metalness: 0.02 })
  );
  terrain.rotation.x = -Math.PI / 2;
  terrain.receiveShadow = true;
  group.add(terrain);

  // 2. OSM Roads + 80 Feet Road Median & Sidewalks
  buildRoads(group, roadMaterials);

  // 3. Speed Breakers outside RVITM Gate on 80 Feet Road
  buildSpeedBreakers(group, physics);

  // 4. Parody Hangout Spots Opposite the Gate + BMTC Stop
  buildHangoutSpots(group, physics, shopLights);

  // 5. Surrounding JP Nagar 8th Phase / Chaithanya Layout Buildings (Merged for 60 FPS!)
  buildSurroundingBuildings(group, physics);

  scene.add(group);
  return { roadMaterials, shopLights };
}

function buildRoads(parent: THREE.Group, roadMaterials: THREE.MeshStandardMaterial[]): void {
  const asphaltTex = createAsphaltTexture();
  const roadBump = createMicroNoiseBumpTexture(18, 18);

  const mainRoadMat = new THREE.MeshStandardMaterial({
    color: 0x2c3038,
    map: asphaltTex,
    bumpMap: roadBump,
    bumpScale: 0.035,
    roughness: 0.82,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });
  const localRoadMat = new THREE.MeshStandardMaterial({
    color: 0x3b4049,
    bumpMap: roadBump,
    bumpScale: 0.03,
    roughness: 0.86,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const serviceRoadMat = new THREE.MeshStandardMaterial({
    color: 0x4b515c,
    roughness: 0.9,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  roadMaterials.push(mainRoadMat, localRoadMat, serviceRoadMat);

  const mainGeos: THREE.BufferGeometry[] = [];
  const localGeos: THREE.BufferGeometry[] = [];
  const serviceGeos: THREE.BufferGeometry[] = [];

  for (const road of osmData.roads as RoadPolyline[]) {
    if (road.points.length < 2) continue;
    const isMajor = road.highway === 'secondary' || road.highway === 'primary' || road.highway === 'tertiary';
    const isService = road.highway === 'service';
    const y = isMajor ? 0.036 : isService ? 0.024 : 0.03;
    const width = isMajor ? 7.6 : road.width;
    const geo = buildRibbonGeometry(road.points, width, y, isMajor);
    if (!geo) continue;

    if (isMajor) mainGeos.push(geo);
    else if (isService) serviceGeos.push(geo);
    else localGeos.push(geo);
  }

  if (mainGeos.length > 0) {
    const merged = mergeGeometries(mainGeos, false);
    const mesh = new THREE.Mesh(merged, mainRoadMat);
    mesh.receiveShadow = true;
    parent.add(mesh);
  }
  if (localGeos.length > 0) {
    const merged = mergeGeometries(localGeos, false);
    const mesh = new THREE.Mesh(merged, localRoadMat);
    mesh.receiveShadow = true;
    parent.add(mesh);
  }
  if (serviceGeos.length > 0) {
    const merged = mergeGeometries(serviceGeos, false);
    const mesh = new THREE.Mesh(merged, serviceRoadMat);
    mesh.receiveShadow = true;
    parent.add(mesh);
  }

  // East Sidewalk Strip along 80 Feet Road opposite the campus
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xb6afa3, roughness: 0.92, side: THREE.DoubleSide });
  const eastSidewalk = buildRibbonGeometry(
    [
      [48, 215],
      [62, 105],
      [74, 5],
      [81, -85],
      [90, -190],
    ],
    6.5,
    0.048,
    false
  );
  if (eastSidewalk) {
    const swMesh = new THREE.Mesh(eastSidewalk, sidewalkMat);
    swMesh.receiveShadow = true;
    parent.add(swMesh);
  }
}

function buildRibbonGeometry(
  points: [number, number][],
  width: number,
  y: number,
  tileUvs: boolean
): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const halfW = width * 0.5;
  let accumDist = 0;

  for (let i = 0; i < points.length; i++) {
    const [x, z] = points[i];
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    let dx = next[0] - prev[0];
    let dz = next[1] - prev[1];
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;

    // Perpendicular vector in XZ
    const nx = -dz;
    const nz = dx;

    if (i > 0) {
      accumDist += Math.hypot(x - points[i - 1][0], z - points[i - 1][1]);
    }

    positions.push(x - nx * halfW, y, z - nz * halfW);
    positions.push(x + nx * halfW, y, z + nz * halfW);
    normals.push(0, 1, 0, 0, 1, 0);

    const vCoord = tileUvs ? accumDist / 10 : accumDist / 8;
    uvs.push(0, vCoord, 1, vCoord);

    if (i < points.length - 1) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }

  if (indices.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

function buildSpeedBreakers(parent: THREE.Group, physics: PhysicsWorld): void {
  const sbTex = createSpeedBreakerTexture();
  const sbMat = new THREE.MeshStandardMaterial({ map: sbTex, roughness: 0.7 });

  const spots = [
    { x: 65.5, z: -42.0, rotY: -0.14 },
    { x: 60.0, z: 8.5, rotY: -0.14 },
  ];

  for (const s of spots) {
    const bump = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 13.0, 10, 1, false, 0, Math.PI), sbMat);
    bump.position.set(s.x, -0.16, s.z);
    bump.rotation.z = Math.PI / 2;
    bump.rotation.y = s.rotY;
    bump.scale.set(0.45, 1, 1.35);
    bump.receiveShadow = true;
    parent.add(bump);

    physics.addStaticBox(s.x, 0.08, s.z, 6.5, 0.09, 0.45, s.rotY, 0.9);
  }

  // Zebra Crosswalk outside RVITM Main Gate on 80 Feet Road
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.7 });
  for (let i = -5; i <= 5; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.02, 2.8), stripeMat);
    stripe.position.set(62.5 + i * 1.1, 0.048, -19.8);
    stripe.rotation.y = -0.14;
    stripe.receiveShadow = true;
    parent.add(stripe);
  }

  // 3-Aspect Traffic Signal at 80 Ft Rd & Brookes Haven Junction
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.35 });
  const sigGroup = new THREE.Group();
  sigGroup.position.set(45.5, 0, 141.0);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5.2, 8), poleMat);
  pole.position.y = 2.6;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.14, 0.14), poleMat);
  arm.position.set(-1.3, 5.0, 0);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.15, 0.38), new THREE.MeshStandardMaterial({ color: 0x111827 }));
  box.position.set(-2.2, 4.5, 0);
  const red = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.3 }));
  red.position.set(-2.2, 4.82, 0.19);
  const amber = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.3 }));
  amber.position.set(-2.2, 4.5, 0.19);
  const green = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 1.6 }));
  green.position.set(-2.2, 4.18, 0.19);
  sigGroup.add(pole, arm, box, red, amber, green);
  parent.add(sigGroup);
}

function buildHangoutSpots(
  parent: THREE.Group,
  physics: PhysicsWorld,
  shopLights: THREE.MeshStandardMaterial[]
): void {
  // 1. Goli Chai & Bun Tapri (Right opposite RVITM Gate)
  {
    const g = new THREE.Group();
    g.position.set(LANDMARKS.chaiStall.x, 0, LANDMARKS.chaiStall.z);
    g.rotation.y = -Math.PI / 2 - 0.12;

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 2.7, 3.6),
      new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.85 })
    );
    base.position.y = 1.35;
    base.castShadow = true;
    base.receiveShadow = true;
    g.add(base);

    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(6.4, 0.2, 5.2),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.65 })
    );
    awning.position.set(0, 2.95, 0.8);
    awning.rotation.x = 0.14;
    awning.castShadow = true;
    g.add(awning);

    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 1.0, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.6 })
    );
    counter.position.set(0, 0.5, 2.1);
    g.add(counter);

    // Brass Chai Boiler
    const boiler = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.3, 0.65, 10),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.25 })
    );
    boiler.position.set(-1.1, 1.32, 2.1);
    g.add(boiler);

    const signTex = createSignboardTexture(
      'GOLI CHAI & BUN TAPRI',
      'Cutting ₹15 • Bun Maskabun • Samosa',
      '#b45309',
      '#ffffff',
      '#fde047'
    );
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex,
      emissive: 0x5c2d06,
      emissiveMap: signTex,
      emissiveIntensity: 0.35,
    });
    shopLights.push(signMat);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), signMat);
    sign.position.set(0, 3.45, 2.45);
    g.add(sign);

    // Plastic stools outside
    const stoolMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5 });
    for (const sx of [-1.8, -0.6, 0.9, 2.0]) {
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.48, 8), stoolMat);
      stool.position.set(sx, 0.24, 3.3);
      g.add(stool);
    }

    parent.add(g);
    physics.addStaticBox(LANDMARKS.chaiStall.x, 1.35, LANDMARKS.chaiStall.z, 2.0, 1.35, 2.9, -0.12);
  }

  // 2. Benglooru Xerox & Records Shop
  {
    const g = new THREE.Group();
    g.position.set(LANDMARKS.xeroxShop.x, 0, LANDMARKS.xeroxShop.z);
    g.rotation.y = -Math.PI / 2 - 0.12;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(6.8, 3.4, 4.4),
      new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.8 })
    );
    body.position.y = 1.7;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    const shutter = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 2.2, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5, metalness: 0.3 })
    );
    shutter.position.set(0, 1.2, 2.22);
    g.add(shutter);

    const signTex = createSignboardTexture(
      'BENGLOORU XEROX & RECORDS',
      'Lab Records • Spiral Binding • ₹2 Printout',
      '#0369a1',
      '#ffffff',
      '#facc15'
    );
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex,
      emissive: 0x0c4a6e,
      emissiveMap: signTex,
      emissiveIntensity: 0.4,
    });
    shopLights.push(signMat);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 1.45), signMat);
    sign.position.set(0, 3.1, 2.3);
    g.add(sign);

    parent.add(g);
    physics.addStaticBox(LANDMARKS.xeroxShop.x, 1.7, LANDMARKS.xeroxShop.z, 2.3, 1.7, 3.4, -0.12);
  }

  // 3. Filter Kaapi & Toast Cafe
  {
    const g = new THREE.Group();
    g.position.set(LANDMARKS.cafeShop.x, 0, LANDMARKS.cafeShop.z);
    g.rotation.y = -Math.PI / 2 - 0.12;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(7.6, 3.8, 5.0),
      new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.75 })
    );
    body.position.y = 1.9;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(8.2, 0.2, 3.2),
      new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 })
    );
    deck.position.set(0, 0.1, 3.8);
    g.add(deck);

    const signTex = createSignboardTexture(
      'FILTER KAAPI & TOAST CAFE',
      'Cold Coffee • Maggi • Free Campus WiFi',
      '#29160a',
      '#fef3c7',
      '#d97706'
    );
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex,
      emissive: 0x422006,
      emissiveMap: signTex,
      emissiveIntensity: 0.35,
    });
    shopLights.push(signMat);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 1.5), signMat);
    sign.position.set(0, 3.4, 2.55);
    g.add(sign);

    parent.add(g);
    physics.addStaticBox(LANDMARKS.cafeShop.x, 1.9, LANDMARKS.cafeShop.z, 2.6, 1.9, 3.8, -0.12);
  }

  // 4. BMTC Bus Shelter (North of gate on 80 Feet Road)
  {
    const g = new THREE.Group();
    g.position.set(LANDMARKS.bmtcStop.x, 0, LANDMARKS.bmtcStop.z);
    g.rotation.y = -Math.PI / 2 - 0.12;

    const shelterMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.35, roughness: 0.45 });
    const back = new THREE.Mesh(new THREE.BoxGeometry(6.2, 2.5, 0.2), shelterMat);
    back.position.set(0, 1.25, -1.0);
    g.add(back);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.2, 2.5), shelterMat);
    roof.position.set(0, 2.6, 0);
    roof.castShadow = true;
    g.add(roof);

    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 0.45, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.5 })
    );
    bench.position.set(0, 0.45, -0.4);
    g.add(bench);

    const signTex = createSignboardTexture(
      'BMTC — RVITM / SARATHI NAGARA',
      'Routes: 215 • 365 • V-500C • KIA-7A',
      '#1e40af',
      '#ffffff',
      '#38bdf8'
    );
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.1), new THREE.MeshStandardMaterial({ map: signTex }));
    sign.position.set(0, 3.05, 1.1);
    g.add(sign);

    parent.add(g);
  }
}

function buildSurroundingBuildings(parent: THREE.Group, physics: PhysicsWorld): void {
  const palette = [0xe7dcc8, 0xd8c3a5, 0xcbd5e1, 0xd9c2b2, 0xc7d6c5];
  const buckets: THREE.BufferGeometry[][] = palette.map(() => []);

  for (const b of osmData.buildings as BuildingFootprint[]) {
    if (b.points.length < 3) continue;

    // Bounding center & span
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of b.points) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    const cx = (minX + maxX) * 0.5;
    const cz = (minZ + maxZ) * 0.5;

    // Skip anything overlapping RVITM campus or our custom roadside hangout strip
    if (cx > -36 && cx < 56 && cz > -62 && cz < 92) continue;
    if (cx > 70 && cx < 102 && cz > -36 && cz < 28) continue;

    const shape = new THREE.Shape();
    b.points.forEach(([x, z], i) => {
      if (i === 0) shape.moveTo(x, -z);
      else shape.lineTo(x, -z);
    });
    shape.closePath();

    const height = Math.min(18, Math.max(4.5, b.levels * 3.4));
    const extrude = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false,
      steps: 1,
    });
    extrude.rotateX(-Math.PI / 2);

    const bucketIdx = Math.abs(b.id) % palette.length;
    buckets[bucketIdx].push(extrude);

    // Add physics box colliders for close JP Nagar houses within playable drive radius
    if (Math.hypot(cx, cz) < 175) {
      const hx = Math.max(1.5, (maxX - minX) * 0.5);
      const hz = Math.max(1.5, (maxZ - minZ) * 0.5);
      physics.addStaticBox(cx, height * 0.5, cz, hx, height * 0.5, hz);
    }
  }

  buckets.forEach((geos, idx) => {
    if (geos.length === 0) return;
    const merged = mergeGeometries(geos, false);
    const mat = new THREE.MeshStandardMaterial({
      color: palette[idx],
      roughness: 0.88,
      metalness: 0.04,
      flatShading: true,
    });
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = idx < 2; // Cast shadow from half the blocks to save shadow pass cost
    mesh.receiveShadow = true;
    parent.add(mesh);
  });
}
