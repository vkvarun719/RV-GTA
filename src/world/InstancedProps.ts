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

  const crownGeo = new THREE.IcosahedronGeometry(2.1, 1);
  const greenMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.85, flatShading: true });
  const flameMat = new THREE.MeshStandardMaterial({ color: 0xe65100, roughness: 0.8, flatShading: true });

  const greenMesh = new THREE.InstancedMesh(crownGeo, greenMat, greenCrowns.length);
  const flameMesh = new THREE.InstancedMesh(crownGeo, flameMat, flameCrowns.length);
  greenMesh.castShadow = true;
  flameMesh.castShadow = true;

  const dummy = new THREE.Object3D();
  let gIdx = 0;
  let fIdx = 0;

  treePositions.forEach((t, i) => {
    dummy.position.set(t.x, 1.6 * t.scale, t.z);
    dummy.scale.set(t.scale, t.scale, t.scale);
    dummy.rotation.set(0, (i * 1.1) % Math.PI, 0);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);

    dummy.position.set(t.x, 3.9 * t.scale, t.z);
    dummy.scale.set(t.scale * 1.15, t.scale * 0.9, t.scale * 1.15);
    dummy.updateMatrix();
    if (t.isGulmohar) flameMesh.setMatrixAt(fIdx++, dummy.matrix);
    else greenMesh.setMatrixAt(gIdx++, dummy.matrix);
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

  return { streetLampMaterial };
}
