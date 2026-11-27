import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PLAYER_SPAWN } from '../data/campus-layout';
import type { PhysicsWorld } from '../systems/PhysicsWorld';
import type { InputManager } from '../systems/InputManager';
import { AnimationController } from '../animation/AnimationController';

export class PlayerController {
  public readonly mesh = new THREE.Group();
  public body!: RAPIER.RigidBody;
  public superMachaMode = false;
  public isGrounded = true;
  public inVehicle = false;
  public yaw = PLAYER_SPAWN.yaw;

  private physics: PhysicsWorld;
  private modelGroup = new THREE.Group();
  private fallbackGroup = new THREE.Group();
  private animCtrl: AnimationController | null = null;
  private glbLoaded = false;

  private jumpCooldown = 0;
  private stepTimer = 0;
  private wasGrounded = true;
  private landingSquash = 0;
  private entryAnimTimer = 0;
  private currentTurnLean = 0;
  public onFootstep?: () => void;

  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    this.physics = physics;
    this.mesh.add(this.modelGroup);
    this.buildFallbackSilhouette();
    this.loadSkeletalCharacter();
    this.createPhysicsBody();
    scene.add(this.mesh);
  }

  private buildFallbackSilhouette(): void {
    // Minimal loading-time silhouette replaced immediately once /models/player.glb loads
    const mat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.9, 6, 12), mat);
    body.position.y = 0.85;
    body.castShadow = true;
    this.fallbackGroup.add(body);
    this.modelGroup.add(this.fallbackGroup);
  }

  private loadSkeletalCharacter(): void {
    const loader = new GLTFLoader();
    loader.load(
      '/models/player.glb',
      (gltf) => {
        const model = gltf.scene;
        // Soldier.glb faces -Z by default; rotate 180 deg so local +Z is forward matching yaw
        model.rotation.y = Math.PI;
        model.scale.setScalar(1.0);
        model.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const m = obj as THREE.Mesh;
            m.castShadow = true;
            m.receiveShadow = true;
          }
        });

        this.modelGroup.remove(this.fallbackGroup);
        this.modelGroup.add(model);

        this.animCtrl = new AnimationController(model);
        this.animCtrl.registerClips(gltf.animations);
        this.glbLoaded = true;
      },
      undefined,
      () => {
        // Keep fallback if GLB fails to load
      }
    );
  }

  public playVehicleTransition(): void {
    this.entryAnimTimer = 0.35;
    this.animCtrl?.transition('VehicleExit');
  }

  private createPhysicsBody(): void {
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SPAWN.z)
      .lockRotations()
      .setLinearDamping(1.2);
    this.body = this.physics.world.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.capsule(0.45, 0.36)
      .setTranslation(0, 0.85, 0)
      .setFriction(0.1)
      .setRestitution(0);
    this.physics.world.createCollider(colliderDesc, this.body);
  }

  getPosition(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  teleport(x: number, y: number, z: number, yaw?: number): void {
    this.body.setTranslation({ x, y, z }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    if (yaw !== undefined) {
      this.yaw = yaw;
      this.mesh.rotation.y = yaw;
    }
    this.mesh.position.set(x, y, z);
  }

  setInVehicle(inside: boolean): void {
    this.inVehicle = inside;
    this.mesh.visible = !inside;
    this.body.setEnabled(!inside);
    if (!inside) {
      this.playVehicleTransition();
    }
  }

  update(dt: number, input: InputManager, cameraYaw: number): number {
    if (this.inVehicle) return 0;

    if (this.jumpCooldown > 0) this.jumpCooldown -= dt;
    if (this.entryAnimTimer > 0) this.entryAnimTimer = Math.max(0, this.entryAnimTimer - dt);

    const pos = this.body.translation();
    const vel = this.body.linvel();

    // Ground detection raycast from waist
    const hit = this.physics.castRay(pos.x, pos.y + 0.3, pos.z, 0, -1, 0, 0.45, this.body);
    this.isGrounded = hit !== null;

    // Detect landing impact for subtle compression recovery
    if (this.isGrounded && !this.wasGrounded && vel.y < -2.5) {
      this.landingSquash = Math.min(0.18, Math.abs(vel.y) * 0.015);
    }
    this.wasGrounded = this.isGrounded;

    const { forward, right, sprint } = input.getMoveAxes();
    const moveMag = Math.hypot(forward, right);

    const walkSpeed = this.superMachaMode ? 12.5 : 5.2;
    const sprintSpeed = this.superMachaMode ? 21.0 : 9.6;
    const targetSpeed = sprint ? sprintSpeed : walkSpeed;

    let moveX = 0;
    let moveZ = 0;
    let yawDiff = 0;

    if (moveMag > 0.01) {
      const fwdX = -Math.sin(cameraYaw);
      const fwdZ = -Math.cos(cameraYaw);
      const rightX = Math.cos(cameraYaw);
      const rightZ = -Math.sin(cameraYaw);

      const dirX = (fwdX * forward + rightX * right) / moveMag;
      const dirZ = (fwdZ * forward + rightZ * right) / moveMag;

      moveX = dirX * targetSpeed;
      moveZ = dirZ * targetSpeed;

      const targetYaw = Math.atan2(dirX, dirZ);
      yawDiff = targetYaw - this.yaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      this.yaw += yawDiff * Math.min(1, dt * 11);
    }

    const accel = this.isGrounded ? 16 : 6;
    const nextVx = vel.x + (moveX - vel.x) * Math.min(1, dt * accel);
    const nextVz = vel.z + (moveZ - vel.z) * Math.min(1, dt * accel);
    let nextVy = vel.y;

    if (input.isDown('Space') && this.isGrounded && this.jumpCooldown <= 0) {
      nextVy = this.superMachaMode ? 14.5 : 8.6;
      this.jumpCooldown = 0.35;
      this.isGrounded = false;
      this.landingSquash = 0.08;
    }

    this.body.setLinvel({ x: nextVx, y: nextVy, z: nextVz }, true);

    // Sync mesh & guard against falling out of world bounds
    const updated = this.body.translation();
    if (updated.y < -10 || Math.abs(updated.x) > 2100 || Math.abs(updated.z) > 2100) {
      this.teleport(PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SPAWN.z, PLAYER_SPAWN.yaw);
      return 0;
    }
    this.mesh.position.set(updated.x, updated.y, updated.z);
    this.mesh.rotation.y = this.yaw;

    // Skeletal Animation Blending via AnimationController
    const horizSpeed = Math.hypot(nextVx, nextVz);
    if (this.glbLoaded && this.animCtrl?.ready) {
      const ac = this.animCtrl;
      const wasGrounded = this.wasGrounded;
      if (!this.isGrounded && wasGrounded) {
        // Just left the ground (jump started)
        ac.transition('Jump');
      } else if (this.isGrounded && !wasGrounded) {
        // Just landed
        ac.transition('Land');
      } else if (this.isGrounded) {
        if (horizSpeed > 8.5 && sprint) {
          ac.transition('Sprint');
        } else if (horizSpeed > 6.0) {
          ac.transition('Run');
        } else if (horizSpeed > 0.45) {
          ac.transition('Walk');
        } else if (Math.abs(yawDiff) > 0.5 && horizSpeed < 0.5) {
          ac.transition('Turn');
        } else {
          ac.transition('Idle');
        }
      }
      ac.syncSpeed(horizSpeed);
      ac.update(dt);
    }

    // Smooth landing squash recovery, airborne pitch, turning bank, and vehicle exit step-down
    this.landingSquash *= Math.max(0, 1 - dt * 12);
    const targetLean = Math.max(-0.18, Math.min(0.18, -yawDiff * 0.25));
    this.currentTurnLean += (targetLean - this.currentTurnLean) * Math.min(1, dt * 10);

    const airPitch = !this.isGrounded ? Math.max(-0.15, Math.min(0.15, -nextVy * 0.015)) : 0;
    const entryDip = this.entryAnimTimer > 0 ? Math.sin((this.entryAnimTimer / 0.35) * Math.PI) * 0.12 : 0;
    this.modelGroup.scale.set(1 + this.landingSquash * 0.5, 1 - this.landingSquash - entryDip, 1 + this.landingSquash * 0.5);
    this.modelGroup.rotation.set(airPitch, 0, this.currentTurnLean);

    // Footstep cadence
    if (horizSpeed > 0.45 && this.isGrounded) {
      this.stepTimer += dt * horizSpeed;
      if (this.stepTimer > 2.35) {
        this.stepTimer = 0;
        this.onFootstep?.();
      }
    }

    return horizSpeed * dt;
  }
}
