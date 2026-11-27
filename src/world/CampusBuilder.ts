import * as THREE from 'three';
import { ACADEMIC_BLOCK, LANDMARKS, MAIN_GATE } from '../data/campus-layout';
import osmDataRaw from '../data/campus-osm.json';
import type { OsmDataset } from '../types/game';
import type { PhysicsWorld } from '../systems/PhysicsWorld';
import {
  createBasketballCourtTexture,
  createBuildingWindowRoughnessMap,
  createBuildingWindowTexture,
  createCourtyardPaverTexture,
  createCricketTurfTexture,
  createDeptBoardTexture,
  createGateBoardTexture,
  createMicroNoiseBumpTexture,
  createPhotoPanelTexture,
  createSignboardTexture,
} from './Textures';

const osmData = osmDataRaw as unknown as OsmDataset;

export interface CampusVisualHandles {
  campusLights: THREE.MeshStandardMaterial[];
  pavingMaterials: THREE.MeshStandardMaterial[];
  boomArm: THREE.Group;
  flagMesh: THREE.Mesh;
}

export function buildCampus(scene: THREE.Scene, physics: PhysicsWorld): CampusVisualHandles {
  const group = new THREE.Group();
  const campusLights: THREE.MeshStandardMaterial[] = [];
  const pavingMaterials: THREE.MeshStandardMaterial[] = [];

  // 1. Campus Ground Polygon from real OSM data
  const campusShape = new THREE.Shape();
  osmData.campusPolygon.forEach(([x, z], idx) => {
    if (idx === 0) campusShape.moveTo(x, -z);
    else campusShape.lineTo(x, -z);
  });
  campusShape.closePath();

  const groundGeo = new THREE.ShapeGeometry(campusShape);
  groundGeo.rotateX(-Math.PI / 2);
  const campusGroundMat = new THREE.MeshStandardMaterial({
    color: 0x9b958b,
    roughness: 0.9,
    metalness: 0.05,
  });
  pavingMaterials.push(campusGroundMat);
  const campusGround = new THREE.Mesh(groundGeo, campusGroundMat);
  campusGround.position.y = 0.015;
  campusGround.receiveShadow = true;
  group.add(campusGround);

  // 2. Compound Wall around OSM campus polygon (leaving gap on East edge for Main Gate)
  buildCompoundWalls(group, physics);

  // 3. Main Gate, Security Cabin, Boom Barrier & Entrance Board
  const boomArm = buildMainGate(group, physics, campusLights);

  // 4. 7-Floor Main Academic Block + Porch + Steps + Dept Boards
  buildAcademicBlock(group, physics, campusLights);

  // 5. Courtyard / Quadrangle + Flagpole
  const flagMesh = buildCourtyard(group, physics, pavingMaterials);

  // 6. Canteen / Cafeteria Pavilion
  buildCanteen(group, physics);

  // 7. Student Parking Bay markings & canopy posts
  buildParkingLot(group, physics, pavingMaterials);

  // 8. Basketball Court & Cricket Practice Turf
  buildSportsZone(group, physics);

  // 9. Library Pavilion, Auditorium Plaza & Brick Lounge Gardens
  buildCampusPlazasAndZones(group, physics, campusLights);

  scene.add(group);
  return { campusLights, pavingMaterials, boomArm, flagMesh };
}

function buildCompoundWalls(parent: THREE.Group, physics: PhysicsWorld): void {
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe6ded1, roughness: 0.85 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x7c2d23, roughness: 0.75 });
  const poly = osmData.campusPolygon;

  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i];
    const [bx, bz] = poly[(i + 1) % poly.length];

    // Check if this is the East road-facing edge ([58, -34.4] -> [40, 91.3])
    const isEastEdge = ax > 35 && bx > 35;
    if (isEastEdge) {
      // Split East wall around gate gap (t from 0.05 to 0.23 is open for Main Entry & Exit)
      addWallSegment(parent, physics, [ax, az], lerpPt([ax, az], [bx, bz], 0.03), wallMat, trimMat);
      addWallSegment(parent, physics, lerpPt([ax, az], [bx, bz], 0.24), [bx, bz], wallMat, trimMat);
    } else {
      addWallSegment(parent, physics, [ax, az], [bx, bz], wallMat, trimMat);
    }
  }
}

function lerpPt(a: [number, number], b: [number, number], t: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function addWallSegment(
  parent: THREE.Group,
  physics: PhysicsWorld,
  a: [number, number],
  b: [number, number],
  wallMat: THREE.Material,
  trimMat: THREE.Material
): void {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  if (len < 1.5) return;

  const cx = (a[0] + b[0]) * 0.5;
  const cz = (a[1] + b[1]) * 0.5;
  const rotY = -Math.atan2(dz, dx);

  const wall = new THREE.Mesh(new THREE.BoxGeometry(len, 2.1, 0.45), wallMat);
  wall.position.set(cx, 1.05, cz);
  wall.rotation.y = rotY;
  wall.castShadow = true;
  wall.receiveShadow = true;
  parent.add(wall);

  const coping = new THREE.Mesh(new THREE.BoxGeometry(len + 0.1, 0.18, 0.6), trimMat);
  coping.position.set(cx, 2.16, cz);
  coping.rotation.y = rotY;
  parent.add(coping);

  physics.addStaticBox(cx, 1.05, cz, len * 0.5, 1.05, 0.25, rotY);
}

function buildMainGate(
  parent: THREE.Group,
  physics: PhysicsWorld,
  campusLights: THREE.MeshStandardMaterial[]
): THREE.Group {
  const gateGroup = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xebe3d5, roughness: 0.78 });
  const maroonMat = new THREE.MeshStandardMaterial({ color: 0x6f1620, roughness: 0.6 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.65 });

  // Place gate assembly aligned along East compound edge
  gateGroup.position.set(MAIN_GATE.boardCenter.x, 0, MAIN_GATE.boardCenter.z);
  gateGroup.rotation.y = MAIN_GATE.rotationY;

  // Three monumental pillars: South Entry Pillar, Center Median Pillar, North Exit Pillar
  const pillarOffsetsZ = [-9.5, 0, 9.5];
  for (const oz of pillarOffsetsZ) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 5.2, 1.5), stoneMat);
    pillar.position.set(0, 2.6, oz);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    gateGroup.add(pillar);

    const band = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.45, 1.65), maroonMat);
    band.position.set(0, 4.95, oz);
    gateGroup.add(band);

    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xfff3c4,
      emissive: 0xffc857,
      emissiveIntensity: 0.3,
    });
    campusLights.push(lampMat);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), lampMat);
    globe.position.set(0, 5.45, oz);
    gateGroup.add(globe);
  }

  // Overhead Gate Beam + Crisp Canvas-Textured RVITM Board
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.4, 20.8), maroonMat);
  beam.position.set(0, 5.6, 0);
  beam.castShadow = true;
  gateGroup.add(beam);

  const boardTex = createGateBoardTexture();
  const boardMat = new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.45 });
  // Front (facing +X East onto 80 Feet Road) & Back (facing West inside campus)
  const frontSign = new THREE.Mesh(new THREE.PlaneGeometry(18.5, 2.15), boardMat);
  frontSign.position.set(0.58, 5.6, 0);
  frontSign.rotation.y = Math.PI / 2;
  gateGroup.add(frontSign);

  const backSign = new THREE.Mesh(new THREE.PlaneGeometry(18.5, 2.15), boardMat);
  backSign.position.set(-0.58, 5.6, 0);
  backSign.rotation.y = -Math.PI / 2;
  gateGroup.add(backSign);

  // Security Cabin (at center median behind pillar)
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.7, 3.0), stoneMat);
  cabin.position.set(-2.3, 1.35, 0);
  cabin.castShadow = true;
  cabin.receiveShadow = true;
  gateGroup.add(cabin);

  const cabinRoof = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.25, 3.6), maroonMat);
  cabinRoof.position.set(-2.3, 2.8, 0);
  gateGroup.add(cabinRoof);

  const cabinGlass = new THREE.Mesh(
    new THREE.BoxGeometry(2.88, 1.0, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x1e3a4c, roughness: 0.2, metalness: 0.4 })
  );
  cabinGlass.position.set(-2.3, 1.75, 0);
  gateGroup.add(cabinGlass);

  // Boom Barrier (half-raised at Entry lane z = +5.2 inside local coords, inviting drive-through)
  const boomPost = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.05, 0.42), new THREE.MeshStandardMaterial({ color: 0xfacc15 }));
  boomPost.position.set(-0.2, 0.52, 1.5);
  gateGroup.add(boomPost);

  const boomArm = new THREE.Group();
  boomArm.position.set(-0.2, 0.92, 1.5);
  // Stripped yellow-black barrier bar
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 1.05),
      new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0xfacc15 : 0x111827 })
    );
    seg.position.set(0, 0, 0.55 + i * 1.05);
    boomArm.add(seg);
  }
  boomArm.rotation.x = -0.78; // Raised 45 degrees so cars/scooters pass smoothly!
  gateGroup.add(boomArm);

  // Decorative open iron gate wings folded inward
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.8, 0.12), darkMetal);
  leaf.position.set(-1.8, 0.9, -9.2);
  gateGroup.add(leaf);

  parent.add(gateGroup);

  // Static physics colliders for gate pillars & security cabin (leaving driveways wide open!)
  const cos = Math.cos(MAIN_GATE.rotationY);
  const sin = Math.sin(MAIN_GATE.rotationY);
  const toWorld = (lx: number, lz: number) => ({
    x: MAIN_GATE.boardCenter.x + lx * cos + lz * sin,
    z: MAIN_GATE.boardCenter.z - lx * sin + lz * cos,
  });

  for (const oz of pillarOffsetsZ) {
    const p = toWorld(0, oz);
    physics.addStaticBox(p.x, 2.6, p.z, 0.75, 2.6, 0.75, MAIN_GATE.rotationY);
  }
  const cab = toWorld(-2.3, 0);
  physics.addStaticBox(cab.x, 1.35, cab.z, 1.4, 1.35, 1.5, MAIN_GATE.rotationY);

  return boomArm;
}

function buildAcademicBlock(
  parent: THREE.Group,
  physics: PhysicsWorld,
  campusLights: THREE.MeshStandardMaterial[]
): void {
  const bldg = new THREE.Group();
  const { center, width, length, floors, floorHeight, rotationY } = ACADEMIC_BLOCK;
  const totalH = floors * floorHeight; // 7 * 3.7 = 25.9m

  bldg.position.set(center.x, 0, center.z);
  bldg.rotation.y = rotationY;

  const windowTex = createBuildingWindowTexture();
  const windowRough = createBuildingWindowRoughnessMap();
  const concreteBump = createMicroNoiseBumpTexture(10, 10);
  const creamMat = new THREE.MeshStandardMaterial({ color: 0xeee8de, roughness: 0.82, bumpMap: concreteBump, bumpScale: 0.04 });
  const slateMat = new THREE.MeshStandardMaterial({ color: 0x3b4453, roughness: 0.65, bumpMap: concreteBump, bumpScale: 0.03 });
  const terracottaMat = new THREE.MeshStandardMaterial({ color: 0x8f2d26, roughness: 0.68, bumpMap: concreteBump, bumpScale: 0.03 });
  const facadeMat = new THREE.MeshStandardMaterial({
    map: windowTex,
    roughnessMap: windowRough,
    roughness: 0.9,
    metalness: 0.18,
  });

  // Main 7-Floor Structural Tower
  const mainBody = new THREE.Mesh(new THREE.BoxGeometry(width, totalH, length), facadeMat);
  mainBody.position.y = totalH * 0.5;
  mainBody.castShadow = true;
  mainBody.receiveShadow = true;
  bldg.add(mainBody);

  // Ground-floor double-height colonnade plinth
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(width + 0.9, 1.2, length + 0.9), slateMat);
  plinth.position.y = 0.6;
  plinth.receiveShadow = true;
  bldg.add(plinth);

  // Vertical architectural concrete fins on East & West facades (7 bays along length)
  const bayCount = 9;
  for (let i = 0; i <= bayCount; i++) {
    const zOff = -length * 0.47 + (i / bayCount) * length * 0.94;
    const finE = new THREE.Mesh(new THREE.BoxGeometry(0.9, totalH + 0.6, 0.85), creamMat);
    finE.position.set(width * 0.5 + 0.25, (totalH + 0.6) * 0.5, zOff);
    finE.castShadow = true;
    bldg.add(finE);

    const finW = new THREE.Mesh(new THREE.BoxGeometry(0.9, totalH + 0.6, 0.85), creamMat);
    finW.position.set(-width * 0.5 - 0.25, (totalH + 0.6) * 0.5, zOff);
    bldg.add(finW);
  }

  // Instanced window modules on East & West facades (real window quads, not just texture)
  {
    const windowGeo = new THREE.PlaneGeometry(1.15, 1.35);
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a4c,
      roughness: 0.15,
      metalness: 0.65,
      emissive: 0x2d4a63,
      emissiveIntensity: 0.12,
    });
    const windowFrames: Array<{ x: number; y: number; z: number; rotY: number }> = [];
    const windowPerFloor = 8;
    const floorStart = 1.0;
    for (let f = 0; f < floors - 1; f++) {
      const fy = floorStart + f * floorHeight + floorHeight * 0.5;
      for (let w = 0; w < windowPerFloor; w++) {
        const zOff = -length * 0.42 + (w / Math.max(1, windowPerFloor - 1)) * length * 0.84;
        windowFrames.push({ x: width * 0.5 + 0.02, y: fy, z: zOff, rotY: 0 });
        windowFrames.push({ x: -width * 0.5 - 0.02, y: fy, z: zOff, rotY: Math.PI });
      }
    }
    const windowMesh = new THREE.InstancedMesh(windowGeo, windowMat, windowFrames.length);
    windowMesh.castShadow = true;
    windowMesh.receiveShadow = true;
    const dummy = new THREE.Object3D();
    windowFrames.forEach((w, i) => {
      dummy.position.set(w.x, w.y, w.z);
      dummy.rotation.set(0, w.rotY, 0);
      dummy.updateMatrix();
      windowMesh.setMatrixAt(i, dummy.matrix);
    });
    bldg.add(windowMesh);
  }

  // Stepped North & South wing projections (matching real OSM indented footprint)
  const wingGeo = new THREE.BoxGeometry(width + 2.4, totalH - 1.5, 16);
  const northWing = new THREE.Mesh(wingGeo, creamMat);
  northWing.position.set(0, (totalH - 1.5) * 0.5, -length * 0.34);
  northWing.castShadow = true;
  northWing.receiveShadow = true;
  bldg.add(northWing);

  const southWing = new THREE.Mesh(wingGeo, creamMat);
  southWing.position.set(0, (totalH - 1.5) * 0.5, length * 0.34);
  southWing.castShadow = true;
  southWing.receiveShadow = true;
  bldg.add(southWing);

  // Roof Parapet, Terrace Structure & Illuminated RVITM Crown Sign
  const roofRim = new THREE.Mesh(new THREE.BoxGeometry(width + 1.4, 1.1, length + 1.4), slateMat);
  roofRim.position.y = totalH + 0.55;
  bldg.add(roofRim);

  const roofAccent = new THREE.Mesh(new THREE.BoxGeometry(width + 1.5, 0.35, length + 1.5), terracottaMat);
  roofAccent.position.y = totalH + 0.05;
  bldg.add(roofAccent);

  // Rooftop Elevator Penthouse & Solar Array
  const penthouse = new THREE.Mesh(new THREE.BoxGeometry(10, 3.2, 16), creamMat);
  penthouse.position.set(0, totalH + 2.2, 0);
  bldg.add(penthouse);

  const roofSignTex = createSignboardTexture(
    'RV INSTITUTE OF TECHNOLOGY & MANAGEMENT',
    '7-FLOOR ACADEMIC BLOCK • EST. 2019',
    '#6f1620',
    '#ffffff',
    '#eab308'
  );
  const roofSignMat = new THREE.MeshStandardMaterial({
    map: roofSignTex,
    emissive: 0x441016,
    emissiveMap: roofSignTex,
    emissiveIntensity: 0.45,
  });
  campusLights.push(roofSignMat);
  const crownSign = new THREE.Mesh(new THREE.PlaneGeometry(24, 3.2), roofSignMat);
  crownSign.position.set(width * 0.5 + 0.8, totalH - 1.8, -4);
  crownSign.rotation.y = Math.PI / 2;
  bldg.add(crownSign);

  // Grand Entrance Porch + Steps (aligned toward Main Gate at local z ≈ -23)
  const porchZ = -22.0;
  const porchBaseX = width * 0.5 + 3.2;

  // Steps + Accessible Platform
  for (let s = 0; s < 4; s++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.1 + (3 - s) * 1.1, 0.25, 13.5), slateMat);
    step.position.set(porchBaseX + 2.2 - s * 0.55, 0.125 + s * 0.25, porchZ);
    step.receiveShadow = true;
    bldg.add(step);
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.0, 14.0), creamMat);
  deck.position.set(porchBaseX - 0.5, 0.5, porchZ);
  deck.receiveShadow = true;
  bldg.add(deck);

  // Stainless-steel stair handrails & glass double entrance doors
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.88, roughness: 0.22 });
  for (const rz of [-6.4, 6.4]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 4.2, 8), steelMat);
    rail.position.set(porchBaseX + 1.1, 1.45, porchZ + rz);
    rail.rotation.z = Math.PI / 2 - 0.24;
    bldg.add(rail);
    for (const px of [porchBaseX - 0.6, porchBaseX + 2.6]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8), steelMat);
      post.position.set(px, px > porchBaseX ? 0.6 : 1.35, porchZ + rz);
      bldg.add(post);
    }
  }
  const lobbyDoorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.4, 5.2), steelMat);
  lobbyDoorFrame.position.set(width * 0.5 + 0.05, 2.7, porchZ);
  bldg.add(lobbyDoorFrame);
  const lobbyGlass = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 3.1, 4.6),
    new THREE.MeshStandardMaterial({ color: 0x1e3a4c, roughness: 0.08, metalness: 0.75, emissive: 0xfef3c7, emissiveIntensity: 0.2 })
  );
  lobbyGlass.position.set(width * 0.5 + 0.08, 2.65, porchZ);
  bldg.add(lobbyGlass);

  // Rooftop solar panel array
  const solarMat = new THREE.MeshStandardMaterial({ color: 0x172554, roughness: 0.2, metalness: 0.7 });
  for (let sz = -32; sz <= 32; sz += 16) {
    if (Math.abs(sz) < 12) continue;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.14, 5.5), solarMat);
    panel.position.set(-2, totalH + 1.35, sz);
    panel.rotation.z = 0.22;
    bldg.add(panel);
  }

  // 4 Tall Entrance Columns + Cantilevered Portico Canopy
  for (const cz of [-5.2, -1.8, 1.8, 5.2]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 7.6, 10), creamMat);
    col.position.set(porchBaseX + 1.8, 4.3, porchZ + cz);
    col.castShadow = true;
    bldg.add(col);
  }
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.9, 15.2), terracottaMat);
  canopy.position.set(porchBaseX - 0.2, 8.2, porchZ);
  canopy.castShadow = true;
  bldg.add(canopy);

  const porchLightMat = new THREE.MeshStandardMaterial({
    color: 0xfff7ed,
    emissive: 0xfef08a,
    emissiveIntensity: 0.4,
  });
  campusLights.push(porchLightMat);
  const soffit = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 13.0), porchLightMat);
  soffit.position.set(porchBaseX, 7.72, porchZ);
  soffit.rotation.x = Math.PI / 2;
  bldg.add(soffit);

  // Department Boards along Ground/1st Floor East Facade
  const depts = [
    { code: 'CSE', sub: 'Computer Science & Engg', z: -36, accent: '#38bdf8' },
    { code: 'AI & ML', sub: 'Artificial Intelligence & ML', z: -22, accent: '#a855f7' },
    { code: 'ISE', sub: 'Information Science & Engg', z: -6, accent: '#22c55e' },
    { code: 'ECE', sub: 'Electronics & Comm. Engg', z: 10, accent: '#f59e0b' },
    { code: 'ME', sub: 'Mechanical Engineering', z: 26, accent: '#ef4444' },
    { code: 'LIBRARY', sub: 'Info Centre & Auditorium', z: 38, accent: '#eab308' },
  ];
  for (const d of depts) {
    const tex = createDeptBoardTexture(d.code, d.sub, d.accent);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(5.2, 1.75),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 })
    );
    const isPorch = d.z === -22;
    board.position.set(isPorch ? porchBaseX + 3.65 : width * 0.5 + 1.32, isPorch ? 8.2 : 4.2, d.z);
    board.rotation.y = Math.PI / 2;
    bldg.add(board);
  }

  parent.add(bldg);

  // Rapier Physics Collider for main tower + porch platform
  physics.addStaticBox(center.x, totalH * 0.5, center.z, width * 0.5 + 0.6, totalH * 0.5, length * 0.5 + 0.6, rotationY);
  // Porch deck ramp collider
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  const px = center.x + (porchBaseX - 0.5) * cos + porchZ * sin;
  const pz = center.z - (porchBaseX - 0.5) * sin + porchZ * cos;
  physics.addStaticBox(px, 0.45, pz, 3.6, 0.45, 7.0, rotationY);

  // ===== DETAILED CAMPUS ENTRANCE (photograph-accurate reconstruction) =====
  // Positioned at the academic block East facade entrance, in local coordinates
  // relative to the bldg group. Preserves all existing geometry; adds:
  // glass canopy, terracotta columns, granite facade, glass doors, staircase,
  // ceiling soffit, raised garden beds.
  buildDetailedEntrance(bldg, physics, totalH, porchBaseX, porchZ);
}

// ===== DETAILED CAMPUS ENTRANCE (photograph-accurate reconstruction) =====
// Recreates the RVITM campus entrance with glass canopy, terracotta columns,
// granite facade, glass doors, grand staircase, ceiling soffit, and landscaping.
// All coordinates are local to the academic block bldg group.
function buildDetailedEntrance(
  parent: THREE.Group,
  physics: PhysicsWorld,
  totalH: number,
  porchBaseX: number,
  porchZ: number
): void {
  const entrance = new THREE.Group();

  // Shared materials
  const graniteMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.55, metalness: 0.25 });
  const stoneStripMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.7, metalness: 0.1 });
  const terracottaMat = new THREE.MeshStandardMaterial({ color: 0x8f2d26, roughness: 0.85, metalness: 0.05 });
  const glassPanelMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.05,
    roughness: 0.02,
    transparent: true,
    opacity: 0.78,
    transmission: 0.85,
    thickness: 0.4,
    clearcoat: 0.5,
    clearcoatRoughness: 0.1,
    side: THREE.DoubleSide,
  });
  const metalFrameMat = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.75, roughness: 0.25 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x2d1b10, roughness: 0.9 });
  const whiteBeamMat = new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.5 });
  const stairMat = new THREE.MeshStandardMaterial({ color: 0x8e8e8e, roughness: 0.8, metalness: 0.1 });
  const stairRiserMat = new THREE.MeshStandardMaterial({ color: 0x6e6e6e, roughness: 0.9 });
  const handrailMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.8, roughness: 0.2 });
  const gardenBedMat = new THREE.MeshStandardMaterial({ color: 0x8f2d26, roughness: 0.85 });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x9e9e9e, roughness: 0.6 });
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.95 });
  const interiorLightMat = new THREE.MeshStandardMaterial({ color: 0xfff3e0, emissive: 0xfff3e0, emissiveIntensity: 0.8 });

  // Entrance local position (East facade, toward main gate)
  const entX = porchBaseX + 1.0;
  const entZ = porchZ;
  const canopyY = totalH + 1.5;

  // 1. GLASS CANOPY with rectangular metal grid framework
  const canopyWidth = 13;
  const canopyDepth = 15;

  // Canopy roof glass panel
  const roofGlass = new THREE.Mesh(new THREE.PlaneGeometry(canopyWidth, canopyDepth), glassPanelMat);
  roofGlass.position.set(entX, canopyY, entZ);
  roofGlass.rotation.x = -Math.PI / 2;
  roofGlass.castShadow = true;
  roofGlass.receiveShadow = true;
  entrance.add(roofGlass);

  // Metal grid beams on canopy roof (cross beams along depth)
  for (let i = 0; i <= 6; i++) {
    const beamX = -canopyWidth * 0.5 + i * (canopyWidth / 6);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, canopyDepth), metalFrameMat);
    beam.position.set(entX + beamX, canopyY + 0.04, entZ);
    beam.rotation.x = -Math.PI / 2;
    beam.castShadow = true;
    entrance.add(beam);
  }
  // Metal grid beams on canopy roof (cross beams along width)
  for (let i = 0; i <= 4; i++) {
    const beamZ = -canopyDepth * 0.5 + i * (canopyDepth / 4);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(canopyWidth, 0.08, 0.12), metalFrameMat);
    beam.position.set(entX, canopyY + 0.04, entZ + beamZ);
    beam.rotation.x = -Math.PI / 2;
    beam.castShadow = true;
    entrance.add(beam);
  }

  // Front face glass panel of canopy
  const frontPanel = new THREE.Mesh(new THREE.PlaneGeometry(canopyWidth, 2.2), glassPanelMat);
  frontPanel.position.set(entX, canopyY + 1.1, entZ - canopyDepth * 0.5 + 0.05);
  frontPanel.rotation.y = Math.PI;
  entrance.add(frontPanel);

  // 2. TERRACOTTA COLUMNS (2 large cylindrical columns with bases)
  const columnRadius = 0.8;
  const columnHeight = totalH * 0.5;
  const columnBaseRadius = 1.25;
  const columnBaseHeight = 0.6;
  const columnOffsetZ = [-5, 5];

  for (const cz of columnOffsetZ) {
    // Column base plinth
    const base = new THREE.Mesh(new THREE.CylinderGeometry(columnBaseRadius, columnBaseRadius * 1.3, columnBaseHeight, 16), terracottaMat);
    base.position.set(entX, columnBaseHeight * 0.5, entZ + cz);
    base.castShadow = true;
    base.receiveShadow = true;
    entrance.add(base);

    // Main column shaft
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(columnRadius, columnRadius, columnHeight, 16), terracottaMat);
    shaft.position.set(entX, columnBaseHeight + columnHeight * 0.5, entZ + cz);
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    entrance.add(shaft);

    // Column capital
    const capital = new THREE.Mesh(new THREE.CylinderGeometry(columnRadius * 1.35, columnRadius * 1.35, 0.4, 16), terracottaMat);
    capital.position.set(entX, columnBaseHeight + columnHeight, entZ + cz);
    capital.castShadow = true;
    entrance.add(capital);
  }

  // 3. BUILDING FACADE - dark charcoal granite with horizontal light-grey stone strips
  const facadeWidth = 15;
  const facadeHeight = 13;
  const facadeDepth = 0.7;

  const facadeWall = new THREE.Mesh(new THREE.BoxGeometry(facadeWidth, facadeHeight, facadeDepth), graniteMat);
  facadeWall.position.set(entX + facadeDepth * 0.5, facadeHeight * 0.5 - 1.2, entZ);
  facadeWall.castShadow = true;
  facadeWall.receiveShadow = true;
  entrance.add(facadeWall);

  // Horizontal light-grey stone strips
  for (let i = 0; i < 5; i++) {
    const stripY = 1.5 + i * 2.4;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(facadeWidth + 0.4, 0.4, facadeDepth + 0.02), stoneStripMat);
    strip.position.set(entX + facadeDepth * 0.5, stripY, entZ);
    entrance.add(strip);
  }

  // Narrow vertical window arrangements on facade
  const narrowWindowMat = new THREE.MeshStandardMaterial({ color: 0x1e3a4c, roughness: 0.1, metalness: 0.85, emissive: 0x2d4a63, emissiveIntensity: 0.1 });
  for (let i = 0; i < 4; i++) {
    const winX = -facadeWidth * 0.3 + i * (facadeWidth * 0.2);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 3.8), narrowWindowMat);
    win.position.set(entX + facadeDepth * 0.5 + winX * 0.05, 3.5 + i * 2.2, entZ);
    entrance.add(win);
  }

  // Blue-tinted upper glass curtain wall band
  const curtainWallMat = new THREE.MeshPhysicalMaterial({
    color: 0x2d4a63,
    metalness: 0.1,
    roughness: 0.05,
    transparent: true,
    opacity: 0.85,
    transmission: 0.6,
    thickness: 0.3,
    clearcoat: 0.3,
    clearcoatRoughness: 0.1,
    side: THREE.DoubleSide,
  });
  const curtainWall = new THREE.Mesh(new THREE.PlaneGeometry(facadeWidth - 1, 2.5), curtainWallMat);
  curtainWall.position.set(entX + facadeDepth * 0.5 + 0.01, facadeHeight - 1.5, entZ);
  entrance.add(curtainWall);

  // 4. ENTRANCE GLASS DOORS with metal frames and interior lighting
  const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.85, roughness: 0.15 });
  const doorGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.05,
    roughness: 0.02,
    transparent: true,
    opacity: 0.82,
    transmission: 0.9,
    thickness: 0.06,
    clearcoat: 0.4,
    clearcoatRoughness: 0.1,
    side: THREE.DoubleSide,
  });

  const doorWidth = 1.3;
  const doorHeight = 3.1;

  for (let side of [-1, 1]) {
    // Door frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.18, doorHeight, 0.18), doorFrameMat);
    frame.position.set(entX + facadeDepth * 0.5 + 0.02, doorHeight * 0.5 + 0.6, entZ + side * (doorWidth * 0.7));
    frame.castShadow = true;
    entrance.add(frame);

    // Door glass panel
    const door = new THREE.Mesh(new THREE.PlaneGeometry(doorWidth * 0.85, doorHeight), doorGlassMat);
    door.position.set(entX + facadeDepth * 0.5 + 0.1, doorHeight * 0.5 + 0.6, entZ + side * (doorWidth * 0.7));
    door.rotation.y = side * Math.PI / 6;
    entrance.add(door);

    // Door handle
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), doorFrameMat);
    handle.position.set(entX + facadeDepth * 0.5 + 0.18, doorHeight * 0.5 + 0.6 - 1.0, entZ + side * (doorWidth * 0.7));
    handle.rotation.z = Math.PI / 2;
    entrance.add(handle);
  }

  // Interior lobby lighting visible through glass
  const interiorLight = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), interiorLightMat);
  interiorLight.position.set(entX + facadeDepth * 0.5 + 0.2, 3.0, entZ);
  interiorLight.rotation.y = Math.PI;
  entrance.add(interiorLight);

  // Simple reception desk visible inside
  const receptionMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.4, metalness: 0.3 });
  const reception = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.1, 1.0), receptionMat);
  reception.position.set(entX + facadeDepth * 0.5 + 0.5, 0.55, entZ + 1.5);
  reception.castShadow = true;
  reception.receiveShadow = true;
  entrance.add(reception);
  const receptionTop = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.1, 1.2), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.4 }));
  receptionTop.position.set(entX + facadeDepth * 0.5 + 0.5, 1.1, entZ + 1.5);
  entrance.add(receptionTop);

  // 5. STAIRCASE - wide grey stone staircase with metal handrails
  const stairWidth = 11;
  const stairDepth = 15;
  const numSteps = 9;
  const stepHeight = 0.17;
  const stepDepth = 1.4;

  for (let s = 0; s < numSteps; s++) {
    const stepY = s * stepHeight;
    const stepZ = entZ - stairDepth * 0.5 + s * stepDepth + stepDepth * 0.5;

    const tread = new THREE.Mesh(new THREE.BoxGeometry(stairWidth, stepHeight * 0.3, stepDepth), stairMat);
    tread.position.set(entX, stepY, stepZ);
    tread.castShadow = true;
    tread.receiveShadow = true;
    entrance.add(tread);

    if (s < numSteps - 1) {
      const riser = new THREE.Mesh(new THREE.BoxGeometry(stairWidth, stepHeight * 0.7, stepDepth * 0.9), stairRiserMat);
      riser.position.set(entX, stepY + stepHeight * 0.5, stepZ - stepDepth * 0.05);
      entrance.add(riser);
    }
  }

  // Staircase physics collider (walkable)
  const stairTotalH = (numSteps - 1) * stepHeight + stepHeight * 0.3;
  physics.addStaticBox(
    entX + facadeDepth * 0.5,
    stairTotalH * 0.5,
    entZ,
    stairWidth * 0.5 + 0.2,
    stairTotalH * 0.5,
    stairDepth * 0.5 + 0.2,
    0
  );

  // Metal handrails on both sides of staircase
  for (let side of [-1, 1]) {
    // Vertical posts
    for (let p = 0; p <= 5; p++) {
      const postZ = entZ - stairDepth * 0.5 + p * (stairDepth / 5);
      const postH = 0.9 + (p / 5) * 0.5; // Taller toward top
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, postH, 8), handrailMat);
      post.position.set(entX + side * (stairWidth * 0.5 + 0.12), postH * 0.5, postZ);
      entrance.add(post);
    }
    // Handrail bar
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, stairDepth, 8), handrailMat);
    rail.position.set(entX + side * (stairWidth * 0.5 + 0.12), 1.1, entZ);
    rail.rotation.z = Math.PI / 2;
    entrance.add(rail);
  }

  // 6. CEILING - dark wooden soffit panels, white structural beams, recessed lights
  const soffitWidth = 17;
  const soffitDepth = 17;

  const soffitPanel = new THREE.Mesh(new THREE.PlaneGeometry(soffitWidth, soffitDepth), darkWoodMat);
  soffitPanel.position.set(entX, canopyY + 2.5, entZ);
  soffitPanel.rotation.x = -Math.PI / 2;
  soffitPanel.receiveShadow = true;
  entrance.add(soffitPanel);

  // White structural beams running across soffit
  for (let i = 0; i <= 5; i++) {
    const beamZ = -soffitDepth * 0.5 + i * (soffitDepth / 5);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(soffitWidth, 0.18, 0.4), whiteBeamMat);
    beam.position.set(entX, canopyY + 2.5 + 0.3, entZ + beamZ);
    beam.rotation.x = -Math.PI / 2;
    entrance.add(beam);
  }

  // Recessed ceiling lights
  for (let i = 0; i < 8; i++) {
    const lightX = -7 + i * 2;
    const lightZ = entZ - 6 + (i % 2) * 5;
    const light = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8), interiorLightMat);
    light.position.set(entX + lightX, canopyY + 2.5 + 0.31, lightZ);
    light.rotation.x = Math.PI / 2;
    entrance.add(light);
  }

  // 7. LANDSCAPING - raised garden beds with tropical shrubs on both sides
  const bedDepth = 13;
  const bedHeight = 0.5;

  const dummy = new THREE.Object3D();
  const bushGeo = new THREE.SphereGeometry(0.55, 8, 6);

  for (let side of [-1, 1]) {
    // Raised garden bed
    const bed = new THREE.Mesh(new THREE.BoxGeometry(bedHeight, bedHeight, bedDepth), gardenBedMat);
    bed.position.set(entX + side * (stairWidth * 0.5 + bedHeight * 0.5 + 1.2), bedHeight * 0.5, entZ);
    bed.castShadow = true;
    bed.receiveShadow = true;
    entrance.add(bed);

    // Stone edging around garden bed
    const edge = new THREE.Mesh(new THREE.BoxGeometry(bedHeight + 0.05, bedHeight + 0.05, bedDepth + 0.1), edgeMat);
    edge.position.set(entX + side * (stairWidth * 0.5 + bedHeight * 0.5 + 1.2), bedHeight * 0.5, entZ);
    entrance.add(edge);

    // Tropical shrubs (instanced)
    const bushCount = 6;
    const bushes = new THREE.InstancedMesh(bushGeo, bushMat, bushCount);
    bushes.castShadow = true;
    bushes.receiveShadow = true;

    for (let i = 0; i < bushCount; i++) {
      const bx = entX + side * (stairWidth * 0.5 + bedHeight * 0.5 + 1.2 + 0.6 + (i % 3) * 1.6);
      const bz = entZ - bedDepth * 0.5 + 1 + Math.floor(i / 3) * 4.5;
      const scale = 0.75 + Math.sin(i) * 0.25;
      dummy.position.set(bx, bedHeight + 0.5, bz);
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.set(0, i * 1.3, 0);
      dummy.updateMatrix();
      bushes.setMatrixAt(i, dummy.matrix);
    }
    entrance.add(bushes);
  }

  parent.add(entrance);
}

function buildCourtyard(
  parent: THREE.Group,
  physics: PhysicsWorld,
  pavingMaterials: THREE.MeshStandardMaterial[]
): THREE.Mesh {
  const paverTex = createCourtyardPaverTexture();
  const paverMat = new THREE.MeshStandardMaterial({ map: paverTex, roughness: 0.82 });
  pavingMaterials.push(paverMat);

  const plaza = new THREE.Mesh(new THREE.BoxGeometry(20, 0.08, 30), paverMat);
  plaza.position.set(LANDMARKS.courtyard.x, 0.04, LANDMARKS.courtyard.z);
  plaza.rotation.y = -0.18;
  plaza.receiveShadow = true;
  parent.add(plaza);

  // Central Flagpole & Pedestal
  const ped = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.8, 0.7, 8),
    new THREE.MeshStandardMaterial({ color: 0xd6cfc4, roughness: 0.8 })
  );
  ped.position.set(LANDMARKS.courtyard.x, 0.35, LANDMARKS.courtyard.z);
  ped.receiveShadow = true;
  parent.add(ped);
  physics.addStaticBox(LANDMARKS.courtyard.x, 0.5, LANDMARKS.courtyard.z, 1.4, 0.5, 1.4);

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.11, 11.5, 8),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.3 })
  );
  pole.position.set(LANDMARKS.courtyard.x, 6.0, LANDMARKS.courtyard.z);
  pole.castShadow = true;
  parent.add(pole);

  // Karnataka / RVITM yellow-red festive campus flag
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.4, 6, 2),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, side: THREE.DoubleSide, roughness: 0.7 })
  );
  flag.position.set(LANDMARKS.courtyard.x + 1.3, 10.9, LANDMARKS.courtyard.z);
  parent.add(flag);

  // "Inside RVITM" Double-Sided Photo Gallery Boards along the Courtyard
  const showcasePanels: Array<{
    x: number;
    z: number;
    rotY: number;
    front: [string, string, string];
    back: [string, string, string];
  }> = [
    {
      x: 24.5,
      z: -4.0,
      rotY: -0.22,
      front: ['/refs/campus-DSC6716.jpg', 'RVITM AUDITORIUM', 'Chevron Acoustic Walls & Spotlights'],
      back: ['/refs/campus-DSC6936.jpg', 'SMART CLASSROOMS', 'Interactive Digital Displays & Dual Boards'],
    },
    {
      x: 29.8,
      z: 3.5,
      rotY: 0.55,
      front: ['/refs/campus-DSC6776.jpg', 'COMPUTER & AI LABS', 'High-Speed Workstations & Smart Desks'],
      back: ['/refs/campus-DSC7061.jpg', 'CENTRAL LIBRARY', 'Orange Book Stacks & Digital Archive'],
    },
    {
      x: 23.0,
      z: 18.0,
      rotY: -0.5,
      front: ['/refs/campus-overview.jpg', 'RVITM CAFETERIA', 'Granite Floor & Stainless Dining'],
      back: ['/refs/campus-DSC7079.jpg', 'STUDENT BRICK LOUNGE', 'Collaborative Study & Hangout Zone'],
    },
  ];

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.4 });
  for (const sp of showcasePanels) {
    const stand = new THREE.Group();
    stand.position.set(sp.x, 0, sp.z);
    stand.rotation.y = sp.rotY;

    for (const px of [-1.45, 1.45]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.7, 8), frameMat);
      post.position.set(px, 1.35, 0);
      stand.add(post);
    }

    const box = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.15, 0.14), frameMat);
    box.position.set(0, 1.8, 0);
    box.castShadow = true;
    stand.add(box);

    const fTex = createPhotoPanelTexture(...sp.front);
    const frontFace = new THREE.Mesh(
      new THREE.PlaneGeometry(3.05, 2.02),
      new THREE.MeshStandardMaterial({ map: fTex, roughness: 0.35 })
    );
    frontFace.position.set(0, 1.8, 0.08);
    stand.add(frontFace);

    const bTex = createPhotoPanelTexture(...sp.back);
    const backFace = new THREE.Mesh(
      new THREE.PlaneGeometry(3.05, 2.02),
      new THREE.MeshStandardMaterial({ map: bTex, roughness: 0.35 })
    );
    backFace.position.set(0, 1.8, -0.08);
    backFace.rotation.y = Math.PI;
    stand.add(backFace);

    parent.add(stand);
    physics.addStaticBox(sp.x, 1.35, sp.z, 1.6, 1.35, 0.2, sp.rotY);
  }

  return flag;
}

function buildCanteen(parent: THREE.Group, physics: PhysicsWorld): void {
  const g = new THREE.Group();
  g.position.set(LANDMARKS.canteen.x, 0, LANDMARKS.canteen.z);
  g.rotation.y = -0.18;

  // Polished dark granite cafeteria floor matching campus-overview.jpg
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(15, 0.25, 11),
    new THREE.MeshStandardMaterial({ color: 0x574c48, roughness: 0.32, metalness: 0.18 })
  );
  floor.position.y = 0.12;
  floor.receiveShadow = true;
  g.add(floor);

  // White kitchen block + charcoal granite dado band
  const kitchen = new THREE.Mesh(
    new THREE.BoxGeometry(14, 3.6, 4.5),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.72 })
  );
  kitchen.position.set(0, 1.9, 2.8);
  kitchen.castShadow = true;
  kitchen.receiveShadow = true;
  g.add(kitchen);

  const dadoBand = new THREE.Mesh(
    new THREE.BoxGeometry(14.08, 0.26, 4.56),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45 })
  );
  dadoBand.position.set(0, 1.75, 2.8);
  g.add(dadoBand);

  // Exposed brick side wall (matching campus-DSC7079.jpg student lounge!)
  const brickLoungeWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 3.6, 6.2),
    new THREE.MeshStandardMaterial({ color: 0xa24e38, roughness: 0.88 })
  );
  brickLoungeWall.position.set(-7.1, 1.9, -2.2);
  brickLoungeWall.castShadow = true;
  g.add(brickLoungeWall);

  // Serving Counter
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(10, 1.15, 1.0),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.4 })
  );
  counter.position.set(0, 0.7, 0.1);
  g.add(counter);

  // Perforated grey canopy roof with warm gold acoustic center panel
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.32, 12),
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.55, metalness: 0.3 })
  );
  roof.position.set(0, 4.2, 0);
  roof.castShadow = true;
  g.add(roof);

  const goldCeiling = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 0.08, 4.6),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.45 })
  );
  goldCeiling.position.set(0, 4.02, -1.6);
  g.add(goldCeiling);

  for (const px of [-6.5, 0, 6.5]) {
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 4.0, 8),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6 })
    );
    col.position.set(px, 2.1, -4.6);
    g.add(col);
  }

  // Signboard
  const signTex = createSignboardTexture(
    'RVITM CANTEEN & CAFETERIA',
    'Masala Dosa • Samosa • Chai • Cold Coffee',
    '#6f1620',
    '#fef3c7',
    '#f59e0b'
  );
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(8.5, 1.8),
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.4 })
  );
  sign.position.set(0, 3.3, -5.2);
  sign.rotation.y = Math.PI;
  g.add(sign);

  const signFront = sign.clone();
  signFront.position.set(0, 3.3, -5.98);
  signFront.rotation.y = 0;
  g.add(signFront);

  // Stainless Steel Standing Dining Tables (matching campus-overview.jpg)
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.25, metalness: 0.8 });
  for (const tx of [-4.2, -1.4, 1.4, 4.2]) {
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.08, 1.05), steelMat);
    top.position.set(tx, 1.05, -2.5);
    top.castShadow = true;
    g.add(top);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.05, 0.9), steelMat);
    shelf.position.set(tx, 0.52, -2.5);
    g.add(shelf);
    for (const lx of [-0.75, 0.75]) {
      for (const lz of [-0.42, 0.42]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.02, 6), steelMat);
        leg.position.set(tx + lx, 0.55, -2.5 + lz);
        g.add(leg);
      }
    }
  }

  parent.add(g);
  physics.addStaticBox(LANDMARKS.canteen.x, 1.9, LANDMARKS.canteen.z + 2.8, 7.0, 1.9, 2.25, -0.18);
}

function buildParkingLot(
  parent: THREE.Group,
  physics: PhysicsWorld,
  pavingMaterials: THREE.MeshStandardMaterial[]
): void {
  const g = new THREE.Group();
  g.position.set(LANDMARKS.parking.x, 0, LANDMARKS.parking.z);
  g.rotation.y = -0.14;

  const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.88 });
  pavingMaterials.push(asphaltMat);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(12, 0.05, 22), asphaltMat);
  pad.position.y = 0.025;
  pad.receiveShadow = true;
  g.add(pad);

  // White parking bay lines
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf1f5f9 });
  for (let z = -9; z <= 9; z += 3) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 0.12), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(-2.5, 0.06, z);
    g.add(line);
  }

  // Shade shed roof over northern row
  const shed = new THREE.Mesh(
    new THREE.BoxGeometry(11.5, 0.16, 10),
    new THREE.MeshStandardMaterial({ color: 0x1e40af, roughness: 0.5 })
  );
  shed.position.set(0, 3.1, -5);
  shed.castShadow = true;
  g.add(shed);

  for (const sx of [-5, 5]) {
    for (const sz of [-9, -1]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 3.1, 8),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6 })
      );
      post.position.set(sx, 1.55, sz);
      g.add(post);
      physics.addStaticBox(LANDMARKS.parking.x + sx, 1.5, LANDMARKS.parking.z + sz, 0.15, 1.5, 0.15);
    }
  }

  const signTex = createSignboardTexture(
    'STUDENT PARKING',
    'Two-Wheelers Only • No Helmet No Entry',
    '#1e3a8a',
    '#ffffff',
    '#facc15'
  );
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(5.5, 1.3),
    new THREE.MeshStandardMaterial({ map: signTex })
  );
  sign.position.set(0, 3.8, -10.1);
  sign.rotation.y = Math.PI;
  g.add(sign);

  parent.add(g);
}

function buildSportsZone(parent: THREE.Group, physics: PhysicsWorld): void {
  // Basketball Court
  const courtGroup = new THREE.Group();
  courtGroup.position.set(LANDMARKS.basketballCourt.x, 0, LANDMARKS.basketballCourt.z);
  courtGroup.rotation.y = -0.16;

  const bbTex = createBasketballCourtTexture();
  const court = new THREE.Mesh(
    new THREE.BoxGeometry(22, 0.08, 12.5),
    new THREE.MeshStandardMaterial({ map: bbTex, roughness: 0.72 })
  );
  court.position.y = 0.04;
  court.receiveShadow = true;
  courtGroup.add(court);

  // Twin Hoops
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.5 });
  const boardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.4 });
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 3.6, 8), poleMat);
    post.position.set(side * 10.6, 1.8, 0);
    post.castShadow = true;
    courtGroup.add(post);

    const backboard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 1.8), boardMat);
    backboard.position.set(side * 9.8, 3.25, 0);
    courtGroup.add(backboard);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 8, 14), rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(side * 9.35, 3.05, 0);
    courtGroup.add(rim);

    physics.addStaticBox(
      LANDMARKS.basketballCourt.x + side * 10.4,
      1.8,
      LANDMARKS.basketballCourt.z,
      0.3,
      1.8,
      0.3
    );
  }
  parent.add(courtGroup);

  // Cricket Practice Turf
  const turfGroup = new THREE.Group();
  turfGroup.position.set(LANDMARKS.cricketTurf.x, 0, LANDMARKS.cricketTurf.z);
  turfGroup.rotation.y = -0.16;

  const turfTex = createCricketTurfTexture();
  const turf = new THREE.Mesh(
    new THREE.BoxGeometry(12, 0.06, 22),
    new THREE.MeshStandardMaterial({ map: turfTex, roughness: 0.92 })
  );
  turf.position.y = 0.03;
  turf.receiveShadow = true;
  turfGroup.add(turf);

  // Net Frame Poles + Translucent Netting
  const netMat = new THREE.MeshBasicMaterial({
    color: 0xdbeafe,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
  });
  for (const sx of [-5.8, 5.8]) {
    for (const sz of [-10.5, 0, 10.5]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 6), poleMat);
      p.position.set(sx, 1.7, sz);
      turfGroup.add(p);
    }
    const sideNet = new THREE.Mesh(new THREE.PlaneGeometry(21, 3.2), netMat);
    sideNet.position.set(sx, 1.65, 0);
    sideNet.rotation.y = Math.PI / 2;
    turfGroup.add(sideNet);
  }

  // Wooden Cricket Stumps at both ends
  const stumpMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.5 });
  for (const sz of [-7.0, 7.0]) {
    for (const wx of [-0.14, 0, 0.14]) {
      const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.75, 6), stumpMat);
      stump.position.set(wx, 0.4, sz);
      turfGroup.add(stump);
    }
  }

  parent.add(turfGroup);
}

function buildCampusPlazasAndZones(
  parent: THREE.Group,
  physics: PhysicsWorld,
  campusLights: THREE.MeshStandardMaterial[]
): void {
  const brickMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.85 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55, metalness: 0.25 });
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6 });
  const accentLightMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.5,
  });
  campusLights.push(accentLightMat);

  // 1. Central Library Entrance Canopy & Signboard (East wing south-side)
  const libGroup = new THREE.Group();
  libGroup.position.set(13.5, 0, 8.5);
  libGroup.rotation.y = ACADEMIC_BLOCK.rotationY;

  const libRoof = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.28, 7.6), canopyMat);
  libRoof.position.y = 3.6;
  libRoof.castShadow = true;
  libGroup.add(libRoof);

  for (const pz of [-3.2, 3.2]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.6, 8), pillarMat);
    col.position.set(2.1, 1.8, pz);
    col.castShadow = true;
    libGroup.add(col);
  }

  const libBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 0.9),
    new THREE.MeshBasicMaterial({ map: createSignboardTexture('CENTRAL LIBRARY', 'DIGITAL ARCHIVE & READING HALL', '#9a3412', '#fef3c7', '#f59e0b') })
  );
  libBoard.position.set(2.62, 3.6, 0);
  libBoard.rotation.y = Math.PI / 2;
  libGroup.add(libBoard);
  parent.add(libGroup);

  // 2. RVITM Auditorium Plaza & Chevron Lit Signboard (North wing)
  const audGroup = new THREE.Group();
  audGroup.position.set(13.5, 0, -26.5);
  audGroup.rotation.y = ACADEMIC_BLOCK.rotationY;

  const audStep = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.24, 9.0), brickMat);
  audStep.position.y = 0.12;
  audStep.receiveShadow = true;
  audGroup.add(audStep);

  const audCanopy = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.3, 8.4), canopyMat);
  audCanopy.position.y = 3.9;
  audCanopy.castShadow = true;
  audGroup.add(audCanopy);

  const audStrip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 8.2), accentLightMat);
  audStrip.position.set(2.5, 3.72, 0);
  audGroup.add(audStrip);

  const audBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(5.4, 0.95),
    new THREE.MeshBasicMaterial({ map: createSignboardTexture('RVITM AUDITORIUM', 'SEMINAR & TECH FEST HALL', '#1e1b4b', '#fde68a', '#f59e0b') })
  );
  audBoard.position.set(2.55, 3.9, 0);
  audBoard.rotation.y = Math.PI / 2;
  audGroup.add(audBoard);
  parent.add(audGroup);

  // 3. Terracotta Brick Lounge Benches & Garden Planters around Quadrangle
  const planterMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.9 });
  const benchCoords: Array<[number, number, number]> = [
    [22.5, 4.0, 0],
    [22.5, 16.0, 0],
    [32.5, 16.0, Math.PI],
  ];
  for (const [bx, bz, rot] of benchCoords) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.48, 2.8), brickMat);
    bench.position.set(bx, 0.24, bz);
    bench.rotation.y = rot;
    bench.castShadow = true;
    bench.receiveShadow = true;
    parent.add(bench);
    physics.addStaticBox(bx, 0.24, bz, 0.45, 0.24, 1.4, rot);

    const planter = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.36, 1.1), planterMat);
    planter.position.set(bx, 0.18, bz + 2.1);
    planter.receiveShadow = true;
    parent.add(planter);
  }
}
