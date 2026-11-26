import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PLAYER_SPAWN } from '../data/campus-layout';
import type { PhysicsWorld } from '../systems/PhysicsWorld';
import type { InputManager } from '../systems/InputManager';

export class PlayerController {
  public readonly mesh = new THREE.Group();
  public body!: RAPIER.RigidBody;
  public superMachaMode = false;
  public isGrounded = true;
  public inVehicle = false;
  public yaw = PLAYER_SPAWN.yaw;

  private physics: PhysicsWorld;
  private leftLeg!: THREE.Mesh;
  private rightLeg!: THREE.Mesh;
  private leftArm!: THREE.Mesh;
  private rightArm!: THREE.Mesh;
  private walkPhase = 0;
  private jumpCooldown = 0;
  private stepTimer = 0;
  public onFootstep?: () => void;

  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    this.physics = physics;
    this.buildCharacterMesh();
    this.createPhysicsBody();
    scene.add(this.mesh);
  }

  private buildCharacterMesh(): void {
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd99b6c, roughness: 0.75 });
    const hoodieMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.7 }); // RV maroon hoodie
    const jeansMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.85 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
    const packMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75 });

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.28), hoodieMat);
    torso.position.y = 1.05;
    torso.castShadow = true;
    this.mesh.add(torso);

    // Backpack (classic engineering college backpack!)
    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.22), packMat);
    backpack.position.set(0, 1.06, -0.22);
    backpack.castShadow = true;
    this.mesh.add(backpack);

    // Head + Hair
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.32), skinMat);
    head.position.y = 1.58;
    head.castShadow = true;
    this.mesh.add(head);

    const hair = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.14, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 })
    );
    hair.position.set(0, 1.74, -0.01);
    this.mesh.add(hair);

    // Limbs with top pivot offset
    const legGeo = new THREE.BoxGeometry(0.18, 0.68, 0.2);
    legGeo.translate(0, -0.34, 0);
    this.leftLeg = new THREE.Mesh(legGeo, jeansMat);
    this.leftLeg.position.set(-0.13, 0.72, 0);
    this.leftLeg.castShadow = true;

    this.rightLeg = new THREE.Mesh(legGeo, jeansMat);
    this.rightLeg.position.set(0.13, 0.72, 0);
    this.rightLeg.castShadow = true;

    // White sneakers
    const shoeGeo = new THREE.BoxGeometry(0.19, 0.12, 0.27);
    const lShoe = new THREE.Mesh(shoeGeo, shoeMat);
    lShoe.position.set(0, -0.66, 0.04);
    this.leftLeg.add(lShoe);
    const rShoe = new THREE.Mesh(shoeGeo, shoeMat);
    rShoe.position.set(0, -0.66, 0.04);
    this.rightLeg.add(rShoe);

    const armGeo = new THREE.BoxGeometry(0.15, 0.56, 0.16);
    armGeo.translate(0, -0.25, 0);
    this.leftArm = new THREE.Mesh(armGeo, hoodieMat);
    this.leftArm.position.set(-0.34, 1.32, 0);
    this.leftArm.castShadow = true;

    this.rightArm = new THREE.Mesh(armGeo, hoodieMat);
    this.rightArm.position.set(0.34, 1.32, 0);
    this.rightArm.castShadow = true;

    this.mesh.add(this.leftLeg, this.rightLeg, this.leftArm, this.rightArm);
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
  }

  update(dt: number, input: InputManager, cameraYaw: number): number {
    if (this.inVehicle) return 0;

    if (this.jumpCooldown > 0) this.jumpCooldown -= dt;

    const pos = this.body.translation();
    const vel = this.body.linvel();

    // Ground detection raycast from waist
    const hit = this.physics.castRay(pos.x, pos.y + 0.3, pos.z, 0, -1, 0, 0.45, this.body);
    this.isGrounded = hit !== null;

    const { forward, right, sprint } = input.getMoveAxes();
    const moveMag = Math.hypot(forward, right);

    const walkSpeed = this.superMachaMode ? 12.5 : 5.6;
    const sprintSpeed = this.superMachaMode ? 21.0 : 9.4;
    const targetSpeed = sprint ? sprintSpeed : walkSpeed;

    let moveX = 0;
    let moveZ = 0;

    if (moveMag > 0.01) {
      // Camera forward in XZ: (-sin(cameraYaw), -cos(cameraYaw))
      const fwdX = -Math.sin(cameraYaw);
      const fwdZ = -Math.cos(cameraYaw);
      const rightX = Math.cos(cameraYaw);
      const rightZ = -Math.sin(cameraYaw);

      const dirX = (fwdX * forward + rightX * right) / moveMag;
      const dirZ = (fwdZ * forward + rightZ * right) / moveMag;

      moveX = dirX * targetSpeed;
      moveZ = dirZ * targetSpeed;

      const targetYaw = Math.atan2(dirX, dirZ);
      let diff = targetYaw - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * Math.min(1, dt * 13);
    }

    const accel = this.isGrounded ? 18 : 6;
    const nextVx = vel.x + (moveX - vel.x) * Math.min(1, dt * accel);
    const nextVz = vel.z + (moveZ - vel.z) * Math.min(1, dt * accel);
    let nextVy = vel.y;

    if (input.isDown('Space') && this.isGrounded && this.jumpCooldown <= 0) {
      nextVy = this.superMachaMode ? 14.5 : 8.6;
      this.jumpCooldown = 0.35;
      this.isGrounded = false;
    }

    this.body.setLinvel({ x: nextVx, y: nextVy, z: nextVz }, true);

    // Sync mesh & guard against falling out of world bounds
    const updated = this.body.translation();
    if (updated.y < -10 || Math.abs(updated.x) > 430 || Math.abs(updated.z) > 430) {
      this.teleport(PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SPAWN.z, PLAYER_SPAWN.yaw);
      return 0;
    }
    this.mesh.position.set(updated.x, updated.y, updated.z);
    this.mesh.rotation.y = this.yaw;

    // Limb animation
    const horizSpeed = Math.hypot(nextVx, nextVz);
    if (horizSpeed > 0.4 && this.isGrounded) {
      this.walkPhase += dt * horizSpeed * 1.9;
      const swing = Math.sin(this.walkPhase) * 0.65;
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing * 0.75;
      this.rightArm.rotation.x = swing * 0.75;

      this.stepTimer += dt * horizSpeed;
      if (this.stepTimer > 2.35) {
        this.stepTimer = 0;
        this.onFootstep?.();
      }
    } else {
      this.leftLeg.rotation.x *= 0.82;
      this.rightLeg.rotation.x *= 0.82;
      this.leftArm.rotation.x *= 0.82;
      this.rightArm.rotation.x *= 0.82;
    }

    return horizSpeed * dt;
  }
}
