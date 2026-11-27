import * as THREE from 'three';
import { LANDMARKS } from '../data/campus-layout';

export interface PropHandles {
  streetLampMaterial: THREE.MeshStandardMaterial;
}

export function buildInstancedProps(scene: THREE.Scene): PropHandles {
  const streetLampMaterial = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.25,
    roughness: 0.3,
  });

  // 1. Trees (Campus palms/rain trees + Bengaluru Gulmohar flame trees along 80 Feet Road)
  const treePositions: Array<{ x: number; z: number; scale: number; isGulmohar: boolean }> = [
    // Campus courtyard & perimeter trees
    { x: 20, z: -32, scale: 1.1, isGulmohar: false },
    { x: 35, z: -32, scale: 1.2, isGulmohar: true },
    { x: 48, z: -32, scale: 1.0, isGulmohar: false },
    { x: 16, z: 24, scale: 1.15, isGulmohar: false },
    { x: 46, z: 22, scale: 1.1, isGulmohar: true },
    { x: 44, z: 38, scale: 1.2, isGulmohar: false },
    { x: 41, z: 58, scale: 1.0, isGulmohar: true },
    { x: 38, z: 78, scale: 1.15, isGulmohar: false },
    { x: 5, z: 70, scale: 1.1, isGulmohar: false },
    { x: -24, z: 60, scale: 1.25, isGulmohar: true },
    { x: -25, z: 12, scale: 1.0, isGulmohar: false },
    { x: -22, z: -48, scale: 1.15, isGulmohar: false },
    // Along 80 Feet Road
    { x: 75, z: -90, scale: 1.25, isGulmohar: true },
    { x: 73, z: -68, scale: 1.15, isGulmohar: false },
    { x: 74, z: -38, scale: 1.1, isGulmohar: true },
    { x: 74, z: 26, scale: 1.2, isGulmohar: false },
    { x: 70, z: 52, scale: 1.25, isGulmohar: true },
    { x: 64, z: 85, scale: 1.15, isGulmohar: false },
    { x: 58, z: 118, scale: 1.2, isGulmohar: true },
    { x: 48, z: 148, scale: 1.1, isGulmohar: false },
    // Brookes Haven & Chaithanya Layout trees
    { x: -48, z: 35, scale: 1.15, isGulmohar: true },
    { x: -64, z: -22, scale: 1.1, isGulmohar: false },
    { x: -55, z: -78, scale: 1.2, isGulmohar: true },
    { x: -30, z: 142, scale: 1.15, isGulmohar: false },
    { x: -85, z: 140, scale: 1.25, isGulmohar: true },
    { x: -135, z: 142, scale: 1.1, isGulmohar: false },
  ];

  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 3.2, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4c35, roughness: 0.95 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treePositions.length);
  trunks.castShadow = true;

  const greenCrowns = treePositions.filter((t) => !t.isGulmohar);
  const flameCrowns = treePositions.filter((t) => t.isGulmohar);

  const crownGeo = new THREE.IcosahedronGeometry(1.75, 2);
  const greenMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.86 });
  const flameMat = new THREE.MeshStandardMaterial({ color: 0xe65100, roughness: 0.82 });

  // 3 overlapping foliage lobes per tree for organic silhouette
  const greenMesh = new THREE.InstancedMesh(crownGeo, greenMat, greenCrowns.length * 3);
  const flameMesh = new THREE.InstancedMesh(crownGeo, flameMat, flameCrowns.length * 3);
  greenMesh.castShadow = true;
  flameMesh.castShadow = true;

  const dummy = new THREE.Object3D();
  let gIdx = 0;
  let fIdx = 0;
  const lobeOffsets: Array<[number, number, number, number]> = [
    [0, 3.85, 0, 1.15],
    [0.95, 3.35, 0.6, 0.85],
    [-0.85, 3.45, -0.55, 0.9],
  ];

  treePositions.forEach((t, i) => {
    dummy.position.set(t.x, 1.6 * t.scale, t.z);
    dummy.scale.set(t.scale, t.scale, t.scale);
    dummy.rotation.set(0, (i * 1.1) % Math.PI, 0);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);

    for (const [ox, oy, oz, ls] of lobeOffsets) {
      dummy.position.set(t.x + ox * t.scale, oy * t.scale, t.z + oz * t.scale);
      dummy.scale.set(t.scale * ls * 1.1, t.scale * ls * 0.82, t.scale * ls * 1.1);
      dummy.rotation.set(0, (i * 1.7 + ox) % Math.PI, 0);
      dummy.updateMatrix();
      if (t.isGulmohar) flameMesh.setMatrixAt(fIdx++, dummy.matrix);
      else greenMesh.setMatrixAt(gIdx++, dummy.matrix);
    }
  });

  scene.add(trunks, greenMesh, flameMesh);

  // 2. Streetlights & Electric Poles along 80 Feet Road & Campus Driveway
  const poleSpots: Array<{ x: number; z: number; rotY: number }> = [
    { x: 64.5, z: -135, rotY: 0 },
    { x: 63.0, z: -95, rotY: 0 },
    { x: 60.5, z: -55, rotY: 0 },
    { x: 58.0, z: -5, rotY: 0 },
    { x: 54.0, z: 45, rotY: 0 },
    { x: 48.0, z: 95, rotY: 0 },
    { x: 41.0, z: 140, rotY: 0 },
    // Campus courtyard poles
    { x: 22.0, z: -4.0, rotY: Math.PI / 2 },
    { x: 20.0, z: 22.0, rotY: Math.PI / 2 },
    { x: 35.0, z: 46.0, rotY: Math.PI },
    // Brookes Haven Main Road
    { x: -10.0, z: 144.0, rotY: Math.PI / 2 },
    { x: -70.0, z: 147.0, rotY: Math.PI / 2 },
    { x: -130.0, z: 150.0, rotY: Math.PI / 2 },
  ];

  const poleGeo = new THREE.CylinderGeometry(0.1, 0.14, 6.8, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.65, roughness: 0.45 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, poleSpots.length);

  const armGeo = new THREE.BoxGeometry(1.5, 0.12, 0.12);
  const arms = new THREE.InstancedMesh(armGeo, poleMat, poleSpots.length);

  const bulbGeo = new THREE.BoxGeometry(0.55, 0.16, 0.32);
  const bulbs = new THREE.InstancedMesh(bulbGeo, streetLampMaterial, poleSpots.length);

  poleSpots.forEach((p, i) => {
    dummy.position.set(p.x, 3.4, p.z);
    dummy.rotation.set(0, p.rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);

    const armX = p.x + Math.cos(p.rotY) * 0.65;
    const armZ = p.z - Math.sin(p.rotY) * 0.65;
    dummy.position.set(armX, 6.7, armZ);
    dummy.updateMatrix();
    arms.setMatrixAt(i, dummy.matrix);

    const bulbX = p.x + Math.cos(p.rotY) * 1.15;
    const bulbZ = p.z - Math.sin(p.rotY) * 1.15;
    dummy.position.set(bulbX, 6.56, bulbZ);
    dummy.updateMatrix();
    bulbs.setMatrixAt(i, dummy.matrix);
  });
  scene.add(poles, arms, bulbs);

  // 3. Parked Instanced Scooters/Bikes in Student Parking Lot
  const parkedTransforms: Array<{ x: number; z: number; rotY: number; color: number }> = [];
  const bikeColors = [0x1e293b, 0xdc2626, 0x2563eb, 0xe2e8f0, 0x0f766e, 0xf59e0b];
  const baseX = LANDMARKS.parking.x;
  const baseZ = LANDMARKS.parking.z;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 7; col++) {
      // Leave middle bay open for drivable player vehicles
      if (row === 0 && (col === 2 || col === 3)) continue;
      if (row === 1 && col === 5) continue;
      parkedTransforms.push({
        x: baseX + (row === 0 ? -2.8 : 2.6),
        z: baseZ - 8.5 + col * 2.8,
        rotY: row === 0 ? 1.42 : -1.72,
        color: bikeColors[(row * 7 + col) % bikeColors.length],
      });
    }
  }

  const bikeBodyGeo = new THREE.BoxGeometry(1.55, 0.62, 0.45);
  const bikeWheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.16, 10);
  bikeWheelGeo.rotateX(Math.PI / 2);

  const parkedBodies = new THREE.InstancedMesh(
    bikeBodyGeo,
    new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.3 }),
    parkedTransforms.length
  );
  const parkedWheels = new THREE.InstancedMesh(
    bikeWheelGeo,
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85 }),
    parkedTransforms.length * 2
  );
  parkedBodies.castShadow = true;

  const c = new THREE.Color();
  parkedTransforms.forEach((b, i) => {
    dummy.position.set(b.x, 0.56, b.z);
    dummy.rotation.set(0, b.rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    parkedBodies.setMatrixAt(i, dummy.matrix);
    c.setHex(b.color);
    parkedBodies.setColorAt(i, c);

    // Front & rear wheels
    const fx = Math.cos(b.rotY) * 0.52;
    const fz = -Math.sin(b.rotY) * 0.52;
    dummy.position.set(b.x + fx, 0.28, b.z + fz);
    dummy.updateMatrix();
    parkedWheels.setMatrixAt(i * 2, dummy.matrix);

    dummy.position.set(b.x - fx, 0.28, b.z - fz);
    dummy.updateMatrix();
    parkedWheels.setMatrixAt(i * 2 + 1, dummy.matrix);
  });
  if (parkedBodies.instanceColor) parkedBodies.instanceColor.needsUpdate = true;
  scene.add(parkedBodies, parkedWheels);

  // 4. Campus Benches in Courtyard & Canteen edge
  const benchSpots = [
    { x: 21.5, z: 3.0, rotY: -0.18 },
    { x: 21.0, z: 12.0, rotY: -0.18 },
    { x: 33.0, z: 3.0, rotY: Math.PI - 0.18 },
    { x: 32.5, z: 15.0, rotY: Math.PI - 0.18 },
    { x: 24.5, z: 42.5, rotY: 0 },
    { x: 30.5, z: 42.5, rotY: 0 },
  ];
  const benchGeo = new THREE.BoxGeometry(0.65, 0.48, 1.9);
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.75 });
  const benches = new THREE.InstancedMesh(benchGeo, benchMat, benchSpots.length);
  benches.castShadow = true;
  benchSpots.forEach((b, i) => {
    dummy.position.set(b.x, 0.24, b.z);
    dummy.rotation.set(0, b.rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    benches.setMatrixAt(i, dummy.matrix);
  });
  scene.add(benches);

  // 5. Outer-world vegetation & grass scatter (deterministic) so the expanded
  // 2 km world is not an empty green plane. Instanced (2-3 draw calls total).
  let seed = 1337;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const outerTrees: Array<{ x: number; z: number; scale: number; rot: number }> = [];
  for (let i = 0; i < 300; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 120 + rnd() * 1500;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.hypot(x, z) < 115) continue; // keep the handcrafted campus clear
    outerTrees.push({ x, z, scale: 0.9 + rnd() * 0.9, rot: rnd() * Math.PI });
  }
  const outerTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, outerTrees.length);
  const outerCrowns = new THREE.InstancedMesh(crownGeo, greenMat, outerTrees.length * 2);
  outerTrunks.castShadow = true;
  outerCrowns.castShadow = true;
  let ocIdx = 0;
  outerTrees.forEach((t, i) => {
    dummy.position.set(t.x, 1.6 * t.scale, t.z);
    dummy.scale.set(t.scale, t.scale, t.scale);
    dummy.rotation.set(0, t.rot, 0);
    dummy.updateMatrix();
    outerTrunks.setMatrixAt(i, dummy.matrix);
    for (const [ox, oy, oz, ls] of [lobeOffsets[0], lobeOffsets[1]] as Array<[number, number, number, number]>) {
      dummy.position.set(t.x + ox * t.scale, oy * t.scale, t.z + oz * t.scale);
      dummy.scale.set(t.scale * ls * 1.1, t.scale * ls * 0.82, t.scale * ls * 1.1);
      dummy.updateMatrix();
      outerCrowns.setMatrixAt(ocIdx++, dummy.matrix);
    }
  });

  const grassSpots: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < 220; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 90 + rnd() * 1500;
    grassSpots.push({ x: Math.cos(a) * r, z: Math.sin(a) * r });
  }
  const grassGeo = new THREE.ConeGeometry(0.5, 0.7, 5);
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.95 });
  const grass = new THREE.InstancedMesh(grassGeo, grassMat, grassSpots.length);
  grassSpots.forEach((g, i) => {
    dummy.position.set(g.x, 0.35, g.z);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, (i * 0.7) % Math.PI, 0);
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
  });
  scene.add(outerTrunks, outerCrowns, grass);

  // 6. Bus-stop shelters along 80 Feet Road (instanced posts + roof).
  const shelterSpots = [
    { x: 70, z: -60, rotY: 0 },
    { x: 66, z: 60, rotY: 0 },
    { x: 40, z: 150, rotY: Math.PI / 2 },
  ];
  const shelterPostGeo = new THREE.BoxGeometry(0.12, 2.4, 0.12);
  const shelterRoofGeo = new THREE.BoxGeometry(3.2, 0.16, 1.4);
  const shelterMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.5, metalness: 0.3 });
  const shelterPosts = new THREE.InstancedMesh(shelterPostGeo, poleMat, shelterSpots.length * 2);
  const shelterRoofs = new THREE.InstancedMesh(shelterRoofGeo, shelterMat, shelterSpots.length);
  shelterRoofs.castShadow = true;
  shelterSpots.forEach((s, i) => {
    for (let k = 0; k < 2; k++) {
      const off = k === 0 ? -1.4 : 1.4;
      dummy.position.set(s.x + Math.cos(s.rotY) * off, 1.2, s.z - Math.sin(s.rotY) * off);
      dummy.rotation.set(0, s.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      shelterPosts.setMatrixAt(i * 2 + k, dummy.matrix);
    }
    dummy.position.set(s.x, 2.4, s.z);
    dummy.updateMatrix();
    shelterRoofs.setMatrixAt(i, dummy.matrix);
  });
  scene.add(shelterPosts, shelterRoofs);

  // 7. Street furniture: trash cans & bollards along 80 Feet Road & campus edges
  const furnitureSpots: Array<{ x: number; z: number; rotY: number; kind: 'bin' | 'bollard' }> = [
    // Along 80 Feet Road sidewalk
    { x: 68.5, z: -110, rotY: 0, kind: 'bin' },
    { x: 67.0, z: -30, rotY: 0, kind: 'bin' },
    { x: 65.5, z: 40, rotY: 0, kind: 'bin' },
    { x: 63.0, z: 110, rotY: 0, kind: 'bin' },
    // Campus driveway
    { x: 52.0, z: -45, rotY: 0, kind: 'bollard' },
    { x: 50.0, z: -30, rotY: 0, kind: 'bollard' },
    { x: 48.0, z: -15, rotY: 0, kind: 'bollard' },
    { x: 46.0, z: 5, rotY: 0, kind: 'bollard' },
    { x: 44.0, z: 25, rotY: 0, kind: 'bollard' },
    // Chai tapri area
    { x: 83.5, z: -26, rotY: -0.12, kind: 'bin' },
    { x: 80.0, z: -8, rotY: -0.12, kind: 'bollard' },
    // BMTC stop
    { x: 74.0, z: -55, rotY: -0.12, kind: 'bin' },
  ];

  const binGeo = new THREE.CylinderGeometry(0.32, 0.38, 0.9, 10);
  const binMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.4, metalness: 0.55 });
  const bollardGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.9, 8);
  const bollardMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.6, metalness: 0.3 });

  const binSpots = furnitureSpots.filter((s) => s.kind === 'bin');
  const bollardSpots = furnitureSpots.filter((s) => s.kind === 'bollard');

  const bins = new THREE.InstancedMesh(binGeo, binMat, binSpots.length);
  const bollards = new THREE.InstancedMesh(bollardGeo, bollardMat, bollardSpots.length);
  bins.castShadow = true;
  bins.receiveShadow = true;
  bollards.castShadow = true;
  bollards.receiveShadow = true;

  binSpots.forEach((s, i) => {
    dummy.position.set(s.x, 0.45, s.z);
    dummy.rotation.set(0, s.rotY, 0);
    dummy.updateMatrix();
    bins.setMatrixAt(i, dummy.matrix);
  });
  bollardSpots.forEach((s, i) => {
    dummy.position.set(s.x, 0.45, s.z);
    dummy.rotation.set(0, s.rotY, 0);
    dummy.updateMatrix();
    bollards.setMatrixAt(i, dummy.matrix);
  });
  scene.add(bins, bollards);

  // 8. Additional vegetation clusters along roadsides (deterministic scatter)
  let seed2 = 2468;
  const rnd2 = () => {
    seed2 = (seed2 * 1664525 + 1013904223) >>> 0;
    return seed2 / 4294967296;
  };
  const roadsideTrees: Array<{ x: number; z: number; scale: number; rot: number }> = [];
  for (let i = 0; i < 120; i++) {
    const a = rnd2() * Math.PI * 2;
    const r = 180 + rnd2() * 900;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.hypot(x, z) < 140) continue;
    roadsideTrees.push({ x, z, scale: 0.8 + rnd2() * 0.7, rot: rnd2() * Math.PI });
  }
  const roadTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, roadsideTrees.length);
  const roadCrowns = new THREE.InstancedMesh(crownGeo, greenMat, roadsideTrees.length * 2);
  roadTrunks.castShadow = true;
  roadCrowns.castShadow = true;
  let rcIdx = 0;
  roadsideTrees.forEach((t, i) => {
    dummy.position.set(t.x, 1.6 * t.scale, t.z);
    dummy.scale.set(t.scale, t.scale, t.scale);
    dummy.rotation.set(0, t.rot, 0);
    dummy.updateMatrix();
    roadTrunks.setMatrixAt(i, dummy.matrix);
    for (const [ox, oy, oz, ls] of [lobeOffsets[0], lobeOffsets[1]]) {
      dummy.position.set(t.x + ox * t.scale, oy * t.scale, t.z + oz * t.scale);
      dummy.scale.set(t.scale * ls * 1.1, t.scale * ls * 0.82, t.scale * ls * 1.1);
      dummy.updateMatrix();
      roadCrowns.setMatrixAt(rcIdx++, dummy.matrix);
    }
  });
  scene.add(roadTrunks, roadCrowns);

  return { streetLampMaterial };
}
