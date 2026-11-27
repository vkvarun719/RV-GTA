/**
 * PlayerController.ts
 *
 * Articulated college-student protagonist (hoodie, jeans, sneakers, backpack)
 * with smooth procedural locomotion (Idle, Walk, Run, Sprint, Jump, Land, Turn,
 * VehicleEnter, VehicleExit) and fixed grounded-state edge detection.
 */

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PLAYER_SPAWN } from '../data/campus-layout';
import type { PhysicsWorld } from '../systems/PhysicsWorld';
import type { InputManager } from '../systems/InputManager';
import { AnimationController } from '../animation/AnimationController';
import type { AnimState } from '../animation/AnimationController';

export interface GroundedTransitionResult {
  takeoff: boolean;
  landed: boolean;
  nextAnim: AnimState;
}

export function resolveLocomotionState(
  prevGrounded: boolean,
  isGrounded: boolean,
  horizSpeed: number,
  sprint: boolean,
  yawDiff: number
): GroundedTransitionResult {
  const takeoff = prevGrounded && !isGrounded;
  const landed = !prevGrounded && isGrounded;

  let nextAnim: AnimState = 'Idle';
  if (!isGrounded) {
    nextAnim = 'Jump';
  } else if (landed) {
    nextAnim = 'Land';
  } else if (horizSpeed > 7.5 && sprint) {
    nextAnim = 'Sprint';
  } else if (horizSpeed > 4.6) {
    nextAnim = 'Run';
  } else if (horizSpeed > 0.45) {
    nextAnim = 'Walk';
  } else if (Math.abs(yawDiff) > 0.45 && horizSpeed <= 0.45) {
    nextAnim = 'Turn';
  }

  return { takeoff, landed, nextAnim };
}

interface StudentRig {
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
}

export class PlayerController {
  public readonly mesh = new THREE.Group();
  public body!: RAPIER.RigidBody;
  public superMachaMode = false;
  public isGrounded = true;
  public inVehicle = false;
  public yaw = PLAYER_SPAWN.yaw;
  public currentAnim: AnimState = 'Idle';

  private physics: PhysicsWorld;
  private modelGroup = new THREE.Group();
  private rig!: StudentRig;

  // Real skeletal character (Xbot, Mixamo rig) with real idle/walk/run clips.
  // Procedural rig above is the load-failure fallback and is hidden once the
  // skinned model is ready. States without a real clip (Sprint/Jump/Land/Turn/
  // VehicleEnter/VehicleExit) use whole-body procedural motion + the idle clip.
  private anim: AnimationController | null = null;
  public usingSkinnedModel = false;

  private jumpCooldown = 0;
  private stepTimer = 0;
  private wasGrounded = true;
  private landingSquash = 0;
  private vehicleAnimTimer = 0;
  private vehicleAnimMode: 'none' | 'enter' | 'exit' = 'none';
  private currentTurnLean = 0;
  private animPhase = 0;
  public onFootstep?: () => void;

  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    this.physics = physics;
    this.mesh.add(this.modelGroup);
    this.rig = this.buildCollegeStudentModel();
    this.modelGroup.add(this.rig.root);
    this.createPhysicsBody();
    scene.add(this.mesh);
    this.loadSkinnedStudent();
  }

  /**
   * Load the free, rigged Xbot character (Mixamo skeleton, real idle/walk/run
   * clips) and drive it through AnimationController. Falls back to the
   * procedural student rig if the asset fails to load. Sprint reuses the run
   * clip at a higher time scale; Jump/Land/Turn/Vehicle states have no real
   * clip and use whole-body procedural motion (clearly a fallback, not a clip).
   */
  private loadSkinnedStudent(): void {
    new GLTFLoader().load(
      '/models/player_xbot.glb',
      (gltf) => {
        const model = gltf.scene;
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xd2996c, roughness: 0.75, metalness: 0 });
        const hoodieMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.72, metalness: 0.02 });
        const jeansMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.88, metalness: 0 });
        const shoeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55, metalness: 0 });
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.88, metalness: 0 });

        // Hide the skeleton-joint visualization mesh; keep only Beta_Surface.
        model.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.castShadow = true;
          m.receiveShadow = true;
          if (m.name.includes('Joint') || m.name.includes('Armature')) {
            m.visible = false;
            return;
          }
          // Per-region materials on the skinned surface mesh by vertical extent.
          const box = new THREE.Box3().setFromObject(m);
          const cy = (box.min.y + box.max.y) / 2;
          const baseMat = Array.isArray(m.material) ? m.material[0] : m.material;
          const mat = (baseMat ? baseMat.clone() : new THREE.MeshStandardMaterial()) as THREE.MeshStandardMaterial;
          m.material = mat;
          if (cy > 1.35) {
            mat.color.copy(skinMat.color);
            mat.roughness = skinMat.roughness;
            mat.metalness = skinMat.metalness;
          } else if (cy > 0.55) {
            mat.color.copy(hoodieMat.color);
            mat.roughness = hoodieMat.roughness;
            mat.metalness = hoodieMat.metalness;
          } else if (cy > 0.05) {
            mat.color.copy(jeansMat.color);
            mat.roughness = jeansMat.roughness;
            mat.metalness = jeansMat.metalness;
          } else {
            mat.color.copy(shoeMat.color);
            mat.roughness = shoeMat.roughness;
            mat.metalness = shoeMat.metalness;
          }
          m.material = mat;
        });

        // Hair overlay on the head bone for visual detail.
        const hair = new THREE.Mesh(
          new THREE.SphereGeometry(0.17, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6),
          hairMat
        );
        hair.position.set(0, 0.16, -0.02);
        hair.castShadow = true;
        const headBone = model.getObjectByName('mixamorig:Head');
        if (headBone) headBone.add(hair);
        else model.add(hair);

        // Student backpack parented to the model root (follows body transform).
        const pack = new THREE.Mesh(
          new THREE.BoxGeometry(0.34, 0.42, 0.18),
          new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 })
        );
        pack.position.set(0, 1.18, -0.20);
        pack.castShadow = true;
        model.add(pack);

        this.modelGroup.add(model);
        this.rig.root.visible = false;
        this.anim = new AnimationController(model);
        this.anim.registerClips(gltf.animations);
        this.usingSkinnedModel = true;
      },
      undefined,
      (err) => {
        console.warn('[PlayerController] Xbot load failed; using procedural student rig.', err);
      }
    );
  }

  private buildCollegeStudentModel(): StudentRig {
    const root = new THREE.Group();
    const hips = new THREE.Group();
    hips.position.y = 0.88;
    root.add(hips);

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd2996c, roughness: 0.72 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.88 });
    const hoodieMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.78 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.65 });
    const jeansMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.88 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 });
    const soleMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
    const packMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });

    const torso = new THREE.Group();
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.54, 0.24), hoodieMat);
    chest.position.y = 0.28;
    chest.castShadow = true;
    chest.receiveShadow = true;
    torso.add(chest);

    const chestStripe = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.06, 0.245), stripeMat);
    chestStripe.position.y = 0.34;
    torso.add(chestStripe);

    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.4, 0.16), packMat);
    backpack.position.set(0, 0.29, -0.18);
    backpack.castShadow = true;
    torso.add(backpack);

    const packPocket = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.05), stripeMat);
    packPocket.position.set(0, 0.22, -0.27);
    torso.add(packPocket);

    const head = new THREE.Group();
    head.position.set(0, 0.62, 0);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.1, 8), skinMat);
    neck.position.y = 0.02;
    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 12), skinMat);
    cranium.position.y = 0.15;
    cranium.castShadow = true;
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.163, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hairMat
    );
    hair.position.set(0, 0.17, -0.01);
    hair.castShadow = true;
    head.add(neck, cranium, hair);
    torso.add(head);
    hips.add(torso);

    const makeArm = (side: -1 | 1): THREE.Group => {
      const arm = new THREE.Group();
      arm.position.set(side * 0.28, 0.5, 0);
      const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.13), hoodieMat);
      sleeve.position.y = -0.13;
      sleeve.castShadow = true;
      const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 0.11), skinMat);
      forearm.position.y = -0.38;
      forearm.castShadow = true;
      arm.add(sleeve, forearm);
      return arm;
    };
    const leftArm = makeArm(-1);
    const rightArm = makeArm(1);
    torso.add(leftArm, rightArm);

    const makeLeg = (side: -1 | 1): THREE.Group => {
      const leg = new THREE.Group();
      leg.position.set(side * 0.11, 0, 0);
      const pants = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.76, 0.17), jeansMat);
      pants.position.y = -0.38;
      pants.castShadow = true;
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.11, 0.26), shoeMat);
      shoe.position.set(0, -0.81, 0.04);
      shoe.castShadow = true;
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.175, 0.03, 0.27), soleMat);
      sole.position.set(0, -0.865, 0.04);
      leg.add(pants, shoe, sole);
      return leg;
    };
    const leftLeg = makeLeg(-1);
    const rightLeg = makeLeg(1);
    hips.add(leftLeg, rightLeg);

    return { root, hips, torso, head, leftArm, rightArm, leftLeg, rightLeg };
  }

  public playVehicleTransition(mode: 'enter' | 'exit'): void {
    this.vehicleAnimMode = mode;
    this.vehicleAnimTimer = 0.35;
    this.currentAnim = mode === 'enter' ? 'VehicleEnter' : 'VehicleExit';
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
    this.playVehicleTransition(inside ? 'enter' : 'exit');
  }

  update(dt: number, input: InputManager, cameraYaw: number): number {
    if (this.inVehicle) return 0;

    if (this.jumpCooldown > 0) this.jumpCooldown -= dt;
    if (this.vehicleAnimTimer > 0) {
      this.vehicleAnimTimer = Math.max(0, this.vehicleAnimTimer - dt);
      if (this.vehicleAnimTimer === 0) this.vehicleAnimMode = 'none';
    }

    const pos = this.body.translation();
    const vel = this.body.linvel();

    // Capture previous grounded state BEFORE computing current grounded state
    const prevGrounded = this.wasGrounded;
    const hit = this.physics.castRay(pos.x, pos.y + 0.3, pos.z, 0, -1, 0, 0.45, this.body);
    this.isGrounded = hit !== null;

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

    const updated = this.body.translation();
    if (updated.y < -10 || Math.abs(updated.x) > 2100 || Math.abs(updated.z) > 2100) {
      this.teleport(PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SPAWN.z, PLAYER_SPAWN.yaw);
      return 0;
    }
    this.mesh.position.set(updated.x, updated.y, updated.z);
    this.mesh.rotation.y = this.yaw;

    const horizSpeed = Math.hypot(nextVx, nextVz);
    const stateRes = resolveLocomotionState(prevGrounded, this.isGrounded, horizSpeed, sprint, yawDiff);
    if (stateRes.landed && vel.y < -2.5) {
      this.landingSquash = Math.min(0.18, Math.abs(vel.y) * 0.015);
    }
    if (this.vehicleAnimTimer <= 0) {
      this.currentAnim = stateRes.nextAnim;
    }

    // Update wasGrounded AFTER all state-edge checks
    this.wasGrounded = this.isGrounded;

    if (this.usingSkinnedModel && this.anim) {
      // Map to a real clip where one exists; Sprint reuses Run (time-scaled).
      let clipState: AnimState = this.currentAnim;
      if (clipState === 'Sprint') clipState = 'Run';
      if (clipState !== 'Idle' && clipState !== 'Walk' && clipState !== 'Run') {
        // No real clip for Jump/Land/Turn/Vehicle* → hold Idle clip; the
        // whole-body procedural squash/lean/pitch below conveys the action.
        clipState = 'Idle';
      }
      this.anim.transition(clipState);
      this.anim.syncSpeed(horizSpeed * (this.currentAnim === 'Sprint' ? 1.35 : 1));
      this.anim.update(dt);
    } else {
      this.animateStudentRig(dt, horizSpeed, nextVy);
    }

    this.landingSquash *= Math.max(0, 1 - dt * 12);
    const targetLean = Math.max(-0.18, Math.min(0.18, -yawDiff * 0.25));
    this.currentTurnLean += (targetLean - this.currentTurnLean) * Math.min(1, dt * 10);

    const airPitch = !this.isGrounded ? Math.max(-0.15, Math.min(0.15, -nextVy * 0.015)) : 0;
    const entryDip =
      this.vehicleAnimTimer > 0 && this.vehicleAnimMode === 'exit'
        ? Math.sin((this.vehicleAnimTimer / 0.35) * Math.PI) * 0.12
        : 0;
    this.modelGroup.scale.set(
      1 + this.landingSquash * 0.5,
      1 - this.landingSquash - entryDip,
      1 + this.landingSquash * 0.5
    );
    this.modelGroup.rotation.set(airPitch, 0, this.currentTurnLean);

    if (horizSpeed > 0.45 && this.isGrounded) {
      this.stepTimer += dt * horizSpeed;
      if (this.stepTimer > 2.35) {
        this.stepTimer = 0;
        this.onFootstep?.();
      }
    }

    return horizSpeed * dt;
  }

  private animateStudentRig(dt: number, horizSpeed: number, velY: number): void {
    const r = this.rig;
    if (!this.isGrounded) {
      const raise = Math.max(-0.5, Math.min(0.7, velY * 0.08));
      r.leftArm.rotation.x = -0.7 - raise * 0.3;
      r.rightArm.rotation.x = -0.5 - raise * 0.3;
      r.leftLeg.rotation.x = 0.45;
      r.rightLeg.rotation.x = -0.35;
      r.torso.rotation.x = 0.1;
      return;
    }

    if (horizSpeed > 0.45) {
      const freq = horizSpeed > 7.5 ? 12.5 : horizSpeed > 4.6 ? 9.5 : 6.8;
      const amp = Math.min(0.85, horizSpeed * 0.09);
      this.animPhase += dt * freq;
      const s = Math.sin(this.animPhase);
      r.leftLeg.rotation.x = s * amp;
      r.rightLeg.rotation.x = -s * amp;
      r.leftArm.rotation.x = -s * amp * 0.85;
      r.rightArm.rotation.x = s * amp * 0.85;
      r.hips.position.y = 0.88 + Math.abs(Math.cos(this.animPhase)) * 0.045;
      r.torso.rotation.x = horizSpeed > 7.5 ? 0.16 : 0.08;
    } else {
      this.animPhase += dt * 2.2;
      const breath = Math.sin(this.animPhase);
      r.leftLeg.rotation.x *= Math.max(0, 1 - dt * 10);
      r.rightLeg.rotation.x *= Math.max(0, 1 - dt * 10);
      r.leftArm.rotation.x = breath * 0.04;
      r.rightArm.rotation.x = -breath * 0.04;
      r.hips.position.y = 0.88 + breath * 0.012;
      r.torso.rotation.x *= Math.max(0, 1 - dt * 10);
    }
  }
}
