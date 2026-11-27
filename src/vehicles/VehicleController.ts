import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { VEHICLE_SPAWNS } from '../data/campus-layout';
import type { PhysicsWorld } from '../systems/PhysicsWorld';
import type { InputManager } from '../systems/InputManager';
import type { PlayerController } from '../player/PlayerController';
import type { VehicleKind, VehicleTelemetry } from '../types/game';
import { createVehicleModel, type BuiltVehicleModel } from './VehicleModels';

export interface DrivableVehicle {
  id: string;
  kind: VehicleKind;
  model: BuiltVehicleModel;
  body: RAPIER.RigidBody;
  yaw: number;
  steerVisual: number;
  leanVisual: number;
  pitchVisual: number;
  prevSpeed: number;
  wheelSpin: number;
  distanceKm: number;
  fareInr: number;
  speedKmh: number;
}

export class VehicleManager {
  public vehicles: DrivableVehicle[] = [];
  public activeVehicle: DrivableVehicle | null = null;
  private scene: THREE.Scene;
  private physics: PhysicsWorld;
  private spawnCounter = 0;
  private headlightBeam: THREE.SpotLight;

  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    this.scene = scene;
    this.physics = physics;

    this.headlightBeam = new THREE.SpotLight(0xfff4d2, 0, 42, Math.PI * 0.24, 0.45, 1.4);
    this.headlightBeam.castShadow = false;
    this.scene.add(this.headlightBeam);
    this.scene.add(this.headlightBeam.target);

    for (const s of VEHICLE_SPAWNS) {
      this.spawnVehicle(s.kind, s.x, s.z, s.yaw, s.id);
    }
  }

  spawnVehicle(kind: VehicleKind, x: number, z: number, yaw = 0, customId?: string): DrivableVehicle {
    const id = customId ?? `veh-${kind}-${++this.spawnCounter}`;
    const model = createVehicleModel(kind, this.spawnCounter);
    const [hx, hy, hz] = model.spec.halfExtents;

    const half = yaw * 0.5;
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, hy + 0.08, z)
      .setRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) })
      .setLinearDamping(0.35)
      .setAngularDamping(4.5);

    const body = this.physics.world.createRigidBody(desc);
    body.setEnabledRotations(false, true, false, true);

    const collider = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
      .setMass(model.spec.mass)
      .setFriction(0.18)
      .setRestitution(0.08);
    this.physics.world.createCollider(collider, body);

    model.group.position.set(x, 0, z);
    model.group.rotation.y = yaw;
    this.scene.add(model.group);

    const v: DrivableVehicle = {
      id,
      kind,
      model,
      body,
      yaw,
      steerVisual: 0,
      leanVisual: 0,
      pitchVisual: 0,
      prevSpeed: 0,
      wheelSpin: 0,
      distanceKm: 0,
      fareInr: 30,
      speedKmh: 0,
    };
    this.vehicles.push(v);
    return v;
  }

  findNearest(pos: THREE.Vector3, maxDist = 5.4): DrivableVehicle | null {
    let best: DrivableVehicle | null = null;
    let bestD = maxDist;
    for (const v of this.vehicles) {
      const t = v.body.translation();
      const d = Math.hypot(t.x - pos.x, t.z - pos.z);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  }

  toggleEnterExit(player: PlayerController): { entered: DrivableVehicle | null; exited: boolean } {
    if (this.activeVehicle) {
      const v = this.activeVehicle;
      const t = v.body.translation();
      const baseY = Math.max(0.2, t.y - v.model.spec.halfExtents[1] + 0.1);
      const sideDist = v.model.spec.halfExtents[0] + 1.1;
      const backDist = v.model.spec.halfExtents[2] + 1.2;

      // Try left side, right side, behind, or roof to avoid clipping inside walls/buildings
      const candidates: Array<[number, number, number]> = [
        [t.x + Math.cos(v.yaw) * sideDist, baseY, t.z - Math.sin(v.yaw) * sideDist],
        [t.x - Math.cos(v.yaw) * sideDist, baseY, t.z + Math.sin(v.yaw) * sideDist],
        [t.x - Math.sin(v.yaw) * backDist, baseY, t.z - Math.cos(v.yaw) * backDist],
        [t.x, t.y + v.model.spec.halfExtents[1] + 0.4, t.z],
      ];

      let chosen = candidates[0];
      for (const cand of candidates) {
        const dx = cand[0] - t.x;
        const dz = cand[2] - t.z;
        const len = Math.hypot(dx, dz);
        if (len < 0.05) {
          chosen = cand;
          break;
        }
        const hit = this.physics.castRay(t.x, baseY + 0.8, t.z, dx / len, 0, dz / len, len + 0.4, v.body);
        if (!hit) {
          chosen = cand;
          break;
        }
      }

      player.setInVehicle(false);
      player.teleport(chosen[0], chosen[1], chosen[2], v.yaw);
      this.activeVehicle = null;
      return { entered: null, exited: true };
    }

    const nearest = this.findNearest(player.getPosition());
    if (!nearest) return { entered: null, exited: false };

    this.activeVehicle = nearest;
    player.setInVehicle(true);
    return { entered: nearest, exited: false };
  }

  update(dt: number, input: InputManager, isNightOrRain: boolean, isRaining: boolean): void {
    const { forward, right, brake } = input.getMoveAxes();

    for (const v of this.vehicles) {
      const isActive = v === this.activeVehicle;
      const rot = v.body.rotation();
      // Extract yaw from Y-axis quaternion
      const yaw = Math.atan2(2 * (rot.w * rot.y + rot.x * rot.z), 1 - 2 * (rot.y * rot.y + rot.z * rot.z));
      v.yaw = yaw;

      const fwdX = Math.sin(yaw);
      const fwdZ = Math.cos(yaw);
      const rightX = Math.cos(yaw);
      const rightZ = -Math.sin(yaw);

      const vel = v.body.linvel();
      let fwdSpeed = vel.x * fwdX + vel.z * fwdZ;
      let latSpeed = vel.x * rightX + vel.z * rightZ;

      const maxSpdMs = v.model.spec.maxSpeedKmh / 3.6;

      if (isActive) {
        const throttle = forward;
        const steer = -right; // A = steer left (+yaw), D = steer right (-yaw)

        if (throttle > 0.05) {
          fwdSpeed = Math.min(maxSpdMs, fwdSpeed + v.model.spec.accel * throttle * dt);
        } else if (throttle < -0.05) {
          if (fwdSpeed > 1.2) {
            fwdSpeed = Math.max(0, fwdSpeed - v.model.spec.accel * 1.9 * dt);
          } else {
            fwdSpeed = Math.max(-maxSpdMs * 0.42, fwdSpeed + v.model.spec.accel * 0.7 * throttle * dt);
          }
        } else {
          // Coasting drag
          fwdSpeed *= Math.max(0, 1 - dt * 1.6);
        }

        if (brake) {
          fwdSpeed *= Math.max(0, 1 - dt * 4.5);
        }

        // Steering scales smoothly with speed & reverses when backing up
        const speedFactor = Math.min(1, Math.abs(fwdSpeed) / 3.5);
        const dirSign = fwdSpeed >= -0.2 ? 1 : -1;
        const driftMult = brake ? 1.48 : 1.0;
        const angVelY = steer * v.model.spec.turnSpeed * speedFactor * dirSign * driftMult;
        v.body.setAngvel({ x: 0, y: angVelY, z: 0 }, true);

        const lateralGrip = brake ? 2.4 : isRaining ? 6.2 : 11.0;
        latSpeed *= Math.max(0, 1 - dt * lateralGrip);

        // Visual lean, suspension pitch (nose dive on braking, squat on accel) & brake light brightness
        const accelRate = (fwdSpeed - v.prevSpeed) / Math.max(0.008, dt);
        const targetPitch = Math.max(-0.075, Math.min(0.075, -accelRate * 0.0045));
        v.pitchVisual += (targetPitch - v.pitchVisual) * Math.min(1, dt * 9);
        const targetLean = -steer * speedFactor * v.model.spec.leanFactor;
        v.leanVisual += (targetLean - v.leanVisual) * Math.min(1, dt * 10);
        const brakingNow = brake || (throttle < -0.1 && fwdSpeed > 0.5);
        for (const bm of v.model.brakeLightMats) {
          bm.emissiveIntensity = brakingNow ? 2.4 : 0.35;
        }
      } else {
        // Parked / idle damping
        fwdSpeed *= Math.max(0, 1 - dt * 4.0);
        latSpeed *= Math.max(0, 1 - dt * 8.0);
        v.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        v.leanVisual *= 0.85;
        v.pitchVisual *= 0.85;
        for (const bm of v.model.brakeLightMats) {
          bm.emissiveIntensity = 0.18;
        }
      }
      v.prevSpeed = fwdSpeed;

      const nextVx = fwdX * fwdSpeed + rightX * latSpeed;
      const nextVz = fwdZ * fwdSpeed + rightZ * latSpeed;
      v.body.setLinvel({ x: nextVx, y: vel.y, z: nextVz }, true);

      v.speedKmh = Math.abs(fwdSpeed) * 3.6;
      if (isActive && v.kind === 'auto') {
        v.distanceKm += (Math.abs(fwdSpeed) * dt) / 1000;
        v.fareInr = 30 + Math.max(0, v.distanceKm - 1.5) * 15;
      }

      // Sync Three.js mesh to physics body & guard world bounds
      const pos = v.body.translation();
      const hy = v.model.spec.halfExtents[1];
      if (pos.y < -10 || Math.abs(pos.x) > 2100 || Math.abs(pos.z) > 2100) {
        v.body.setTranslation({ x: 68, y: hy + 0.2, z: -20 }, true);
        v.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
      const syncedPos = v.body.translation();
      const suspensionBounce = isActive ? Math.sin(v.wheelSpin * 0.6) * 0.012 * Math.min(1, v.speedKmh / 25) : 0;
      v.model.group.position.set(syncedPos.x, syncedPos.y - hy + suspensionBounce, syncedPos.z);
      v.model.group.rotation.set(v.pitchVisual, yaw, v.leanVisual, 'YXZ');

      v.wheelSpin += fwdSpeed * dt * 2.8;
      for (const w of v.model.wheels) {
        w.rotation.x = v.wheelSpin;
      }

      // Headlights glow stronger at night / rain or while driven
      const hlGlow = isNightOrRain ? 2.2 : isActive ? 1.1 : 0.3;
      for (const hm of v.model.headlightMats) {
        hm.emissiveIntensity = hlGlow;
      }

      if (isActive) {
        this.headlightBeam.intensity = isNightOrRain ? 24 : 0;
        if (isNightOrRain) {
          const noseDist = v.model.spec.halfExtents[2] + 0.2;
          this.headlightBeam.position.set(
            syncedPos.x + fwdX * noseDist,
            syncedPos.y + 0.2,
            syncedPos.z + fwdZ * noseDist
          );
          this.headlightBeam.target.position.set(
            syncedPos.x + fwdX * 18,
            0.1,
            syncedPos.z + fwdZ * 18
          );
        }
      }
    }

    if (!this.activeVehicle) {
      this.headlightBeam.intensity = 0;
    }
  }

  getActiveTelemetry(): VehicleTelemetry | null {
    const v = this.activeVehicle;
    if (!v) return null;
    return {
      id: v.id,
      kind: v.kind,
      name: v.model.spec.name,
      speedKmh: v.speedKmh,
      forwardSpeedKmh: v.prevSpeed * 3.6,
      fareInr: v.fareInr,
      distanceKm: v.distanceKm,
      isAutoRickshaw: v.kind === 'auto',
    };
  }

  getActivePosition(): THREE.Vector3 | null {
    if (!this.activeVehicle) return null;
    const t = this.activeVehicle.body.translation();
    return new THREE.Vector3(t.x, t.y - this.activeVehicle.model.spec.halfExtents[1], t.z);
  }
}
