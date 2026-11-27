import * as THREE from 'three';
import type { VehicleKind } from '../types/game';
import { createSignboardTexture } from '../world/Textures';

export interface VehicleSpec {
  kind: VehicleKind;
  name: string;
  halfExtents: [number, number, number];
  mass: number;
  maxSpeedKmh: number;
  accel: number;
  turnSpeed: number;
  seatHeight: number;
  leanFactor: number;
}

export interface BuiltVehicleModel {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  headlightMats: THREE.MeshStandardMaterial[];
  brakeLightMats: THREE.MeshStandardMaterial[];
  spec: VehicleSpec;
}

export const VEHICLE_SPECS: Record<VehicleKind, VehicleSpec> = {
  scooter: {
    kind: 'scooter',
    name: 'Activa Campus Scooter',
    halfExtents: [0.42, 0.55, 0.92],
    mass: 115,
    maxSpeedKmh: 58,
    accel: 24,
    turnSpeed: 2.9,
    seatHeight: 0.72,
    leanFactor: 0.28,
  },
  bike: {
    kind: 'bike',
    name: 'Pulsar 150 Commuter',
    halfExtents: [0.42, 0.58, 1.02],
    mass: 145,
    maxSpeedKmh: 78,
    accel: 32,
    turnSpeed: 2.65,
    seatHeight: 0.78,
    leanFactor: 0.34,
  },
  auto: {
    kind: 'auto',
    name: 'Namma Auto-Rickshaw',
    halfExtents: [0.76, 0.88, 1.32],
    mass: 360,
    maxSpeedKmh: 54,
    accel: 20,
    turnSpeed: 2.45,
    seatHeight: 0.65,
    leanFactor: 0.08,
  },
  bus: {
    kind: 'bus',
    name: 'BMTC / RVITM Bus',
    halfExtents: [1.32, 1.55, 4.35],
    mass: 4200,
    maxSpeedKmh: 52,
    accel: 13.5,
    turnSpeed: 1.45,
    seatHeight: 1.2,
    leanFactor: 0.04,
  },
  tanker: {
    kind: 'tanker',
    name: 'Bengaluru Water Tanker',
    halfExtents: [1.22, 1.4, 3.45],
    mass: 3400,
    maxSpeedKmh: 48,
    accel: 12.5,
    turnSpeed: 1.55,
    seatHeight: 1.15,
    leanFactor: 0.05,
  },
};

export function createVehicleModel(kind: VehicleKind, variantSeed = 0): BuiltVehicleModel {
  const spec = VEHICLE_SPECS[kind];
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  const headlightMats: THREE.MeshStandardMaterial[] = [];
  const brakeLightMats: THREE.MeshStandardMaterial[] = [];

  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.85, roughness: 0.2 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.16 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x162b38, roughness: 0.08, metalness: 0.72 });

  const makeHeadlight = () => {
    const m = new THREE.MeshStandardMaterial({
      color: 0xfef9c3,
      emissive: 0xfef08a,
      emissiveIntensity: 0.7,
    });
    headlightMats.push(m);
    return m;
  };
  const makeBrakelight = () => {
    const m = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      emissive: 0xef4444,
      emissiveIntensity: 0.3,
    });
    brakeLightMats.push(m);
    return m;
  };
  const addWheel = (x: number, y: number, z: number, radius: number, width: number) => {
    const w = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 18), tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, width + 0.02, 12), rimMat);
    hub.rotation.z = Math.PI / 2;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.2, radius * 0.2, width + 0.04, 8), chromeMat);
    cap.rotation.z = Math.PI / 2;
    w.add(tire, hub, cap);
    w.position.set(x, y, z);
    group.add(w);
    wheels.push(w);
  };

  if (kind === 'scooter') {
    const paint = [0xf1f5f9, 0x0ea5e9, 0x14b8a6, 0x94a3b8][variantSeed % 4];
    const bodyMat = new THREE.MeshStandardMaterial({ color: paint, roughness: 0.22, metalness: 0.42 });

    // Rear cowling
    const rear = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.48, 0.85), bodyMat);
    rear.position.set(0, 0.58, -0.35);
    rear.castShadow = true;
    group.add(rear);

    // Floorboard
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.65), tireMat);
    deck.position.set(0, 0.28, 0.15);
    group.add(deck);

    // Front apron
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.72, 0.34), bodyMat);
    front.position.set(0, 0.64, 0.56);
    front.rotation.x = -0.15;
    front.castShadow = true;
    group.add(front);

    // Seat & Handlebar
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.68), tireMat);
    seat.position.set(0, 0.85, -0.25);
    group.add(seat);

    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.12), chromeMat);
    bar.position.set(0, 1.05, 0.48);
    group.add(bar);

    // Side mirrors & exhaust muffler
    for (const mx of [-0.34, 0.34]) {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 6), chromeMat);
      stalk.position.set(mx, 1.13, 0.48);
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.03), tireMat);
      mirror.position.set(mx * 1.08, 1.21, 0.48);
      group.add(stalk, mirror);
    }
    const muffler = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.52, 8), chromeMat);
    muffler.rotation.x = Math.PI / 2;
    muffler.position.set(0.28, 0.28, -0.45);
    group.add(muffler);

    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.08), makeHeadlight());
    hl.position.set(0, 0.96, 0.63);
    group.add(hl);

    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.06), makeBrakelight());
    bl.position.set(0, 0.72, -0.78);
    group.add(bl);

    addWheel(0, 0.26, 0.64, 0.26, 0.14);
    addWheel(0, 0.26, -0.6, 0.26, 0.15);
  } else if (kind === 'bike') {
    const paint = [0xdc2626, 0x1d4ed8, 0x18181b, 0xf97316][variantSeed % 4];
    const tankMat = new THREE.MeshStandardMaterial({ color: paint, roughness: 0.35, metalness: 0.35 });

    // Frame & Engine block
    const engine = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.42, 0.65), chromeMat);
    engine.position.set(0, 0.48, 0.0);
    engine.castShadow = true;
    group.add(engine);

    // Muscular fuel tank
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.64), tankMat);
    tank.position.set(0, 0.86, 0.22);
    tank.castShadow = true;
    group.add(tank);

    // Split seat & tail
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.68), tireMat);
    seat.position.set(0, 0.78, -0.36);
    group.add(seat);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.42), tankMat);
    tail.position.set(0, 0.8, -0.68);
    tail.rotation.x = 0.18;
    group.add(tail);

    // Front forks & headlamp cowl
    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.72, 0.14), chromeMat);
    fork.position.set(0, 0.68, 0.62);
    fork.rotation.x = -0.26;
    group.add(fork);

    const cowl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.24), tankMat);
    cowl.position.set(0, 0.96, 0.68);
    group.add(cowl);

    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.06, 0.08), chromeMat);
    bar.position.set(0, 1.06, 0.56);
    group.add(bar);

    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.15, 0.08), makeHeadlight());
    hl.position.set(0, 0.94, 0.81);
    group.add(hl);

    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.06), makeBrakelight());
    bl.position.set(0, 0.82, -0.9);
    group.add(bl);

    addWheel(0, 0.32, 0.72, 0.32, 0.14);
    addWheel(0, 0.32, -0.68, 0.32, 0.18);
  } else if (kind === 'auto') {
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.48 });
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.45 });
    const hoodMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.85 });

    // Lower green chassis
    const lowerRear = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.72, 1.45), greenMat);
    lowerRear.position.set(0, 0.62, -0.35);
    lowerRear.castShadow = true;
    group.add(lowerRear);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.78, 0.82), greenMat);
    nose.position.set(0, 0.64, 0.68);
    nose.castShadow = true;
    group.add(nose);

    // Classic yellow middle pillars & band
    const yellowBand = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.24, 1.5), yellowMat);
    yellowBand.position.set(0, 1.02, -0.34);
    group.add(yellowBand);

    // Windshield frame + glass
    const shield = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.66, 0.1), glassMat);
    shield.position.set(0, 1.28, 0.72);
    shield.rotation.x = -0.18;
    group.add(shield);

    // Canary Yellow Canopy Roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.26, 1.85), yellowMat);
    roof.position.set(0, 1.68, -0.15);
    roof.castShadow = true;
    group.add(roof);

    const softTop = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.14, 1.75), hoodMat);
    softTop.position.set(0, 1.82, -0.18);
    group.add(softTop);

    // Pillars
    for (const sx of [-0.62, 0.62]) {
      const pRear = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.72, 0.12), yellowMat);
      pRear.position.set(sx, 1.32, -0.98);
      group.add(pRear);
    }

    // Dual headlights & rear brake lights
    for (const lx of [-0.34, 0.34]) {
      const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10), makeHeadlight());
      hl.rotation.x = Math.PI / 2;
      hl.position.set(lx, 0.74, 1.1);
      group.add(hl);
    }
    for (const bx of [-0.52, 0.52]) {
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.06), makeBrakelight());
      bl.position.set(bx, 0.72, -1.09);
      group.add(bl);
    }

    // 3 Wheels (1 front, 2 rear)
    addWheel(0, 0.26, 0.88, 0.26, 0.16);
    addWheel(-0.62, 0.26, -0.68, 0.26, 0.18);
    addWheel(0.62, 0.26, -0.68, 0.26, 0.18);
  } else if (kind === 'bus') {
    const bmtcBlue = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.45 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 });
    const navyMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.55, 2.35, 8.5), whiteMat);
    body.position.set(0, 1.65, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const lowerSkirt = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.95, 8.55), bmtcBlue);
    lowerSkirt.position.set(0, 0.95, 0);
    group.add(lowerSkirt);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.61, 0.25, 8.56), navyMat);
    stripe.position.set(0, 1.55, 0);
    group.add(stripe);

    // Panoramic windows
    const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.85, 7.6), glassMat);
    sideGlass.position.set(0, 2.15, -0.15);
    group.add(sideGlass);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.15, 0.12), glassMat);
    windshield.position.set(0, 2.02, 4.24);
    group.add(windshield);

    // Destination LED Board
    const destTex = createSignboardTexture('BMTC 365 • RVITM', 'JP NAGAR 8TH PHASE -> MAJESTIC', '#090d16', '#facc15', '#0284c7');
    const dest = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.42), new THREE.MeshStandardMaterial({ map: destTex, emissive: 0x422006 }));
    dest.position.set(0, 2.66, 4.29);
    group.add(dest);

    for (const lx of [-0.88, 0.88]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.08), makeHeadlight());
      hl.position.set(lx, 0.88, 4.29);
      group.add(hl);

      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.08), makeBrakelight());
      bl.position.set(lx, 0.98, -4.29);
      group.add(bl);
    }

    for (const wx of [-1.18, 1.18]) {
      addWheel(wx, 0.48, 2.65, 0.48, 0.34);
      addWheel(wx, 0.48, -2.55, 0.48, 0.42);
    }
  } else {
    // Water Tanker
    const cabMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.48 });
    const tankMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.42 });
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 6.7), chassisMat);
    chassis.position.set(0, 0.65, 0);
    group.add(chassis);

    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.25, 1.85, 1.95), cabMat);
    cab.position.set(0, 1.68, 2.25);
    cab.castShadow = true;
    group.add(cab);

    const cabGlass = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.72, 0.12), glassMat);
    cabGlass.position.set(0, 2.05, 3.22);
    group.add(cabGlass);

    // Cylindrical yellow water tank
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, 4.35, 14), tankMat);
    tank.rotation.x = Math.PI / 2;
    tank.position.set(0, 1.92, -1.05);
    tank.castShadow = true;
    group.add(tank);

    const waterTex = createSignboardTexture('CAUVERY WATER 6000L', 'JP NAGAR TANKER SERVICE', '#b45309', '#ffffff', '#0284c7');
    for (const side of [-1, 1]) {
      const lbl = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.85), new THREE.MeshStandardMaterial({ map: waterTex }));
      lbl.position.set(side * 1.1, 1.92, -1.05);
      lbl.rotation.y = (side * Math.PI) / 2;
      group.add(lbl);
    }

    for (const lx of [-0.78, 0.78]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.08), makeHeadlight());
      hl.position.set(lx, 1.05, 3.25);
      group.add(hl);

      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.08), makeBrakelight());
      bl.position.set(lx, 0.85, -3.38);
      group.add(bl);
    }

    for (const wx of [-1.06, 1.06]) {
      addWheel(wx, 0.48, 2.25, 0.48, 0.34);
      addWheel(wx, 0.48, -1.25, 0.48, 0.38);
      addWheel(wx, 0.48, -2.55, 0.48, 0.38);
    }
  }

  return { group, wheels, headlightMats, brakeLightMats, spec };
}
