import * as THREE from 'three';
import type { PhysicsWorld } from '../systems/PhysicsWorld';
import type { InputManager } from '../systems/InputManager';

export class ChaseCamera {
  public yaw = Math.PI * 0.52;
  public pitch = 0.24;
  public distance = 5.4;
  private currentPos = new THREE.Vector3(78, 4, -17);
  private currentLookAt = new THREE.Vector3(72, 1.5, -17);
  private currentFov = 62;
  private currentDist = 5.4;
  private idleSinceMouse = 0;

  // Photo mode free-camera state
  public photoMode = false;
  public freePos = new THREE.Vector3();
  public freeYaw = 0;
  public freePitch = 0;

  update(
    dt: number,
    camera: THREE.PerspectiveCamera,
    input: InputManager,
    physics: PhysicsWorld,
    targetPos: THREE.Vector3,
    isDriving: boolean,
    vehicleHeading?: number
  ): void {
    const { dx, dy, wheel } = input.consumeMouseDelta();

    if (this.photoMode) {
      this.updateFreeCamera(dt, camera, input, dx, dy);
      return;
    }

    if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
      this.yaw -= dx * 0.0028;
      this.pitch = Math.max(-0.18, Math.min(1.05, this.pitch + dy * 0.0024));
      this.idleSinceMouse = 0;
    } else {
      this.idleSinceMouse += dt;
    }

    if (wheel !== 0) {
      const minDist = isDriving ? 4.8 : 3.2;
      const maxDist = isDriving ? 15.0 : 10.5;
      this.distance = Math.max(minDist, Math.min(maxDist, this.distance + wheel * 0.004));
    }

    // Gentle auto-follow behind moving vehicle when user isn't orbiting manually
    if (isDriving && vehicleHeading !== undefined && this.idleSinceMouse > 1.4) {
      // Vehicle forward is (sin(h), cos(h)), so camera behind sits at yaw = h + PI
      const desiredYaw = vehicleHeading + Math.PI;
      let diff = desiredYaw - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * Math.min(1, dt * 1.8);
    }

    const isSprinting = !isDriving && input.isDown('ShiftLeft');
    const targetDist = isDriving ? Math.max(this.distance, 7.2) : isSprinting ? this.distance + 0.9 : this.distance;
    this.currentDist += (targetDist - this.currentDist) * Math.min(1, dt * 6);

    const targetFov = isDriving ? 69 : isSprinting ? 67 : 62;
    this.currentFov += (targetFov - this.currentFov) * Math.min(1, dt * 5);
    if (Math.abs(camera.fov - this.currentFov) > 0.05) {
      camera.fov = this.currentFov;
      camera.updateProjectionMatrix();
    }

    const pivot = new THREE.Vector3(targetPos.x, targetPos.y + (isDriving ? 1.65 : 1.52), targetPos.z);

    const cosPitch = Math.cos(this.pitch);
    const offsetX = Math.sin(this.yaw) * cosPitch * this.currentDist;
    const offsetY = Math.sin(this.pitch) * this.currentDist;
    const offsetZ = Math.cos(this.yaw) * cosPitch * this.currentDist;

    let camX = pivot.x + offsetX;
    let camY = Math.max(0.65, pivot.y + offsetY);
    let camZ = pivot.z + offsetZ;

    // Camera wall-avoidance raycast
    const dir = new THREE.Vector3(camX - pivot.x, camY - pivot.y, camZ - pivot.z);
    const len = dir.length();
    if (len > 0.2) {
      dir.normalize();
      const hit = physics.castRay(pivot.x, pivot.y, pivot.z, dir.x, dir.y, dir.z, len);
      if (hit && hit.toi > 0.9 && hit.toi < len) {
        const safe = Math.max(0.9, hit.toi - 0.35);
        camX = pivot.x + dir.x * safe;
        camY = Math.max(0.65, pivot.y + dir.y * safe);
        camZ = pivot.z + dir.z * safe;
      }
    }

    const smooth = 1 - Math.exp(-dt * 14);
    this.currentPos.lerp(new THREE.Vector3(camX, camY, camZ), smooth);
    this.currentLookAt.lerp(pivot, smooth);

    camera.position.copy(this.currentPos);
    camera.lookAt(this.currentLookAt);
  }

  enterPhotoMode(camera: THREE.PerspectiveCamera): void {
    this.photoMode = true;
    this.freePos.copy(camera.position);
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    this.freeYaw = euler.y;
    this.freePitch = euler.x;
  }

  exitPhotoMode(): void {
    this.photoMode = false;
  }

  private updateFreeCamera(
    dt: number,
    camera: THREE.PerspectiveCamera,
    input: InputManager,
    dx: number,
    dy: number
  ): void {
    this.freeYaw -= dx * 0.0025;
    this.freePitch = Math.max(-1.4, Math.min(1.4, this.freePitch - dy * 0.0022));

    const euler = new THREE.Euler(this.freePitch, this.freeYaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);

    const fwd = new THREE.Vector3(0, 0, -1).applyEuler(euler);
    const right = new THREE.Vector3(1, 0, 0).applyEuler(euler);
    const speed = input.isDownRaw('ShiftLeft') ? 26 : 12;

    const moveF = (input.isDownRaw('KeyW') ? 1 : 0) - (input.isDownRaw('KeyS') ? 1 : 0);
    const moveR = (input.isDownRaw('KeyD') ? 1 : 0) - (input.isDownRaw('KeyA') ? 1 : 0);
    const moveU = (input.isDownRaw('Space') ? 1 : 0) - (input.isDownRaw('KeyC') ? 1 : 0);

    this.freePos.addScaledVector(fwd, moveF * speed * dt);
    this.freePos.addScaledVector(right, moveR * speed * dt);
    this.freePos.y = Math.max(0.5, this.freePos.y + moveU * speed * dt);

    camera.position.copy(this.freePos);
  }
}
