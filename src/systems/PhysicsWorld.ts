import RAPIER from '@dimforge/rapier3d-compat';

export interface RayHitResult {
  toi: number;
  point: { x: number; y: number; z: number };
  colliderHandle: number;
}

export class PhysicsWorld {
  public world!: RAPIER.World;
  public rapier = RAPIER;
  private accumulator = 0;
  private readonly fixedDt = 1 / 60;

  async init(): Promise<void> {
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: -22, z: 0 });

    // Large ground plane collider (y = 0 top surface)
    const groundBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(450, 0.5, 450).setFriction(0.95), groundBody);
  }

  step(dt: number): void {
    const clamped = Math.min(dt, 0.05);
    this.accumulator += clamped;
    let steps = 0;
    while (this.accumulator >= this.fixedDt && steps < 4) {
      this.world.step();
      this.accumulator -= this.fixedDt;
      steps++;
    }
  }

  addStaticBox(
    x: number,
    y: number,
    z: number,
    hx: number,
    hy: number,
    hz: number,
    rotationY = 0,
    friction = 0.7
  ): RAPIER.Collider {
    const halfAngle = rotationY * 0.5;
    const desc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(x, y, z)
      .setRotation({ x: 0, y: Math.sin(halfAngle), z: 0, w: Math.cos(halfAngle) });
    const body = this.world.createRigidBody(desc);
    return this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setFriction(friction), body);
  }

  addStaticRamp(
    x: number,
    y: number,
    z: number,
    hx: number,
    hy: number,
    hz: number,
    rotationY: number,
    pitchX: number
  ): RAPIER.Collider {
    // Compose Y rotation then local X pitch
    const cy = Math.cos(rotationY * 0.5);
    const sy = Math.sin(rotationY * 0.5);
    const cx = Math.cos(pitchX * 0.5);
    const sx = Math.sin(pitchX * 0.5);
    const q = {
      w: cy * cx,
      x: cy * sx,
      y: sy * cx,
      z: -sy * sx,
    };
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z).setRotation(q));
    return this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setFriction(0.95), body);
  }

  castRay(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    maxToi: number,
    excludeBody?: RAPIER.RigidBody
  ): RayHitResult | null {
    const ray = new RAPIER.Ray({ x: ox, y: oy, z: oz }, { x: dx, y: dy, z: dz });
    const hit = this.world.castRay(
      ray,
      maxToi,
      true,
      undefined,
      undefined,
      undefined,
      excludeBody
    );
    if (!hit) return null;
    const p = ray.pointAt(hit.timeOfImpact);
    return {
      toi: hit.timeOfImpact,
      point: { x: p.x, y: p.y, z: p.z },
      colliderHandle: hit.collider.handle,
    };
  }
}
