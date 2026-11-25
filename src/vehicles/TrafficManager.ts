import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {
  AI_TRAFFIC_LOOP_CROSS,
  AI_TRAFFIC_LOOP_EAST,
  CAMPUS_WALKER_PATHS,
} from '../data/campus-layout';
import type { PhysicsWorld } from '../systems/PhysicsWorld';
import type { VehicleKind } from '../types/game';
import { createVehicleModel } from './VehicleModels';

interface AiVehicle {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  body: RAPIER.RigidBody;
  path: [number, number][];
  wpIdx: number;
  speed: number;
  x: number;
  z: number;
  yaw: number;
}

interface CampusWalker {
  group: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  path: [number, number][];
  wpIdx: number;
  speed: number;
  x: number;
  z: number;
  yaw: number;
  phase: number;
}

export class TrafficManager {
  private aiVehicles: AiVehicle[] = [];
  private walkers: CampusWalker[] = [];

  // Story 1 ID-card guard hazard
  public guardGroup = new THREE.Group();
  public guardRing!: THREE.Mesh;
  public guardPos = new THREE.Vector3(49.5, 0, -14.8);
  private guardTime = 0;

  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    this.spawnRoadTraffic(scene, physics);
    this.spawnCampusWalkers(scene);
    this.buildIdGuard(scene);
  }

  private spawnRoadTraffic(scene: THREE.Scene, physics: PhysicsWorld): void {
    const eastSpecs: Array<{ kind: VehicleKind; wpIdx: number; speed: number }> = [
      { kind: 'auto', wpIdx: 0, speed: 8.5 },
      { kind: 'scooter', wpIdx: 2, speed: 10.2 },
      { kind: 'bike', wpIdx: 4, speed: 11.4 },
      { kind: 'auto', wpIdx: 6, speed: 8.8 },
      { kind: 'bus', wpIdx: 8, speed: 7.4 },
    ];

    const crossSpecs: Array<{ kind: VehicleKind; wpIdx: number; speed: number }> = [
      { kind: 'auto', wpIdx: 1, speed: 8.0 },
      { kind: 'scooter', wpIdx: 5, speed: 9.8 },
    ];

    const add = (path: [number, number][], kind: VehicleKind, wpIdx: number, speed: number, seed: number) => {
      const model = createVehicleModel(kind, seed);
      const [x, z] = path[wpIdx];
      const [nx, nz] = path[(wpIdx + 1) % path.length];
      const yaw = Math.atan2(nx - x, nz - z);

      model.group.position.set(x, 0, z);
      model.group.rotation.y = yaw;
      scene.add(model.group);

      const [hx, hy, hz] = model.spec.halfExtents;
      const body = physics.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, hy, z)
      );
      physics.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz), body);

      this.aiVehicles.push({
        group: model.group,
        wheels: model.wheels,
        body,
        path,
        wpIdx: (wpIdx + 1) % path.length,
        speed,
        x,
        z,
        yaw,
      });
    };

    eastSpecs.forEach((s, i) => add(AI_TRAFFIC_LOOP_EAST, s.kind, s.wpIdx, s.speed, i));
    crossSpecs.forEach((s, i) => add(AI_TRAFFIC_LOOP_CROSS, s.kind, s.wpIdx, s.speed, i + 2));
  }

  private spawnCampusWalkers(scene: THREE.Scene): void {
    const shirtPalette = [0x2563eb, 0x059669, 0xd97706, 0x7c3aed, 0xdb2777, 0x0f766e, 0xe11d48];
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd89c6f, roughness: 0.78 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });

    for (let i = 0; i < 12; i++) {
      const path = CAMPUS_WALKER_PATHS[i % CAMPUS_WALKER_PATHS.length];
      const wpIdx = (i * 2) % path.length;
      const [x, z] = path[wpIdx];
      const g = new THREE.Group();

      const shirtMat = new THREE.MeshStandardMaterial({
        color: shirtPalette[i % shirtPalette.length],
        roughness: 0.75,
      });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.58, 0.25), shirtMat);
      torso.position.y = 1.0;
      torso.castShadow = true;

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.28), skinMat);
      head.position.y = 1.48;
      head.castShadow = true;

      const legGeo = new THREE.BoxGeometry(0.16, 0.62, 0.18);
      legGeo.translate(0, -0.31, 0);
      const leftLeg = new THREE.Mesh(legGeo, pantsMat);
      leftLeg.position.set(-0.11, 0.68, 0);
      const rightLeg = new THREE.Mesh(legGeo, pantsMat);
      rightLeg.position.set(0.11, 0.68, 0);

      g.add(torso, head, leftLeg, rightLeg);
      g.position.set(x, 0, z);
      scene.add(g);

      this.walkers.push({
        group: g,
        leftLeg,
        rightLeg,
        path,
        wpIdx: (wpIdx + 1) % path.length,
        speed: 1.5 + (i % 4) * 0.25,
        x,
        z,
        yaw: 0,
        phase: i * 0.9,
      });
    }
  }

  private buildIdGuard(scene: THREE.Scene): void {
    const khaki = new THREE.MeshStandardMaterial({ color: 0xc2a878, roughness: 0.8 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.7 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc68a5c, roughness: 0.75 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.75, 0.32), khaki);
    body.position.y = 1.05;
    body.castShadow = true;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.68, 0.26), khaki);
    legs.position.y = 0.34;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), skin);
    head.position.y = 1.6;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.38), capMat);
    cap.position.set(0, 1.78, 0.03);

    this.guardGroup.add(body, legs, head, cap);

    // Awareness danger ring visible during Story 1
    this.guardRing = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 3.0, 28),
      new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
    );
    this.guardRing.rotation.x = -Math.PI / 2;
    this.guardRing.position.y = 0.08;
    this.guardRing.visible = false;
    this.guardGroup.add(this.guardRing);

    this.guardGroup.position.copy(this.guardPos);
    scene.add(this.guardGroup);
  }

  update(dt: number, playerPos: THREE.Vector3, story1Active: boolean): boolean {
    // Update AI road traffic
    for (let i = 0; i < this.aiVehicles.length; i++) {
      const v = this.aiVehicles[i];
      const [tx, tz] = v.path[v.wpIdx];
      const dx = tx - v.x;
      const dz = tz - v.z;
      const dist = Math.hypot(dx, dz);

      if (dist < 2.8) {
        v.wpIdx = (v.wpIdx + 1) % v.path.length;
        continue;
      }

      const targetYaw = Math.atan2(dx, dz);
      let diff = targetYaw - v.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      v.yaw += diff * Math.min(1, dt * 4.5);

      const fwdX = Math.sin(v.yaw);
      const fwdZ = Math.cos(v.yaw);

      // Polite obstacle yielding check (player or other AI ahead)
      let blocked = false;
      const toPlayerX = playerPos.x - v.x;
      const toPlayerZ = playerPos.z - v.z;
      const pDist = Math.hypot(toPlayerX, toPlayerZ);
      if (pDist < 7.5 && (toPlayerX * fwdX + toPlayerZ * fwdZ) > 1.5) {
        blocked = true;
      }
      if (!blocked) {
        for (let j = 0; j < this.aiVehicles.length; j++) {
          if (i === j) continue;
          const o = this.aiVehicles[j];
          const ox = o.x - v.x;
          const oz = o.z - v.z;
          const od = Math.hypot(ox, oz);
          if (od < 9.5 && (ox * fwdX + oz * fwdZ) > 2.5) {
            blocked = true;
            break;
          }
        }
      }

      const moveSpeed = blocked ? 0.5 : v.speed;
      v.x += fwdX * moveSpeed * dt;
      v.z += fwdZ * moveSpeed * dt;

      v.group.position.set(v.x, 0, v.z);
      v.group.rotation.y = v.yaw;
      for (const w of v.wheels) w.rotation.x += moveSpeed * dt * 2.5;

      const hy = v.body.translation().y;
      const half = v.yaw * 0.5;
      v.body.setNextKinematicTranslation({ x: v.x, y: hy, z: v.z });
      v.body.setNextKinematicRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) });
    }

    // Update Campus Walkers
    for (const w of this.walkers) {
      const [tx, tz] = w.path[w.wpIdx];
      const dx = tx - w.x;
      const dz = tz - w.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.2) {
        w.wpIdx = (w.wpIdx + 1) % w.path.length;
      } else {
        const targetYaw = Math.atan2(dx, dz);
        let diff = targetYaw - w.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        w.yaw += diff * Math.min(1, dt * 6);
        w.x += (dx / dist) * w.speed * dt;
        w.z += (dz / dist) * w.speed * dt;
      }

      w.phase += dt * w.speed * 3.2;
      const swing = Math.sin(w.phase) * 0.5;
      w.leftLeg.rotation.x = swing;
      w.rightLeg.rotation.x = -swing;
      w.group.position.set(w.x, 0, w.z);
      w.group.rotation.y = w.yaw;
    }

    // Update ID-Card Security Guard patrol
    this.guardRing.visible = story1Active;
    if (story1Active) {
      this.guardTime += dt * 1.4;
      const gx = 49.5 + Math.sin(this.guardTime * 0.7) * 2.5;
      const gz = -14.8 + Math.sin(this.guardTime) * 7.2;
      this.guardPos.set(gx, 0, gz);
      this.guardGroup.position.copy(this.guardPos);
      this.guardGroup.rotation.y = Math.cos(this.guardTime) > 0 ? 0 : Math.PI;
      const scale = 0.95 + Math.sin(this.guardTime * 5) * 0.08;
      this.guardRing.scale.set(scale, scale, 1);

      // Return true if player was caught inside ID guard's 2.9m check radius
      return Math.hypot(playerPos.x - gx, playerPos.z - gz) < 2.9;
    } else {
      this.guardGroup.position.set(52.5, 0, -21.0);
    }

    return false;
  }
}
