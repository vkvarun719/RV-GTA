/**
 * WorldCollisionManager.ts
 *
 * Registers and unregisters Rapier static trimesh colliders for building
 * geometry inside streamed world chunks.
 */

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { PhysicsWorld } from '../systems/PhysicsWorld';

export class WorldCollisionManager {
  private physics: PhysicsWorld;
  private chunkBodies = new Map<string, RAPIER.RigidBody>();

  constructor(physics: PhysicsWorld) {
    this.physics = physics;
  }

  registerChunk(chunkKey: string, group: THREE.Group): number {
    this.removeChunk(chunkKey);

    group.updateWorldMatrix(true, true);

    const verts: number[] = [];
    const indices: number[] = [];
    let vertexOffset = 0;
    const tmpVec = new THREE.Vector3();
    const box = new THREE.Box3();

    group.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      const geom = mesh.geometry;
      const pos = geom.getAttribute('position');
      if (!pos || pos.count === 0) return;

      // Only register collision for raised structures (buildings), not flat roads
      box.setFromBufferAttribute(pos as THREE.BufferAttribute);
      const isBuilding =
        mesh.name.startsWith('buildings') || box.max.y - box.min.y > 0.5;
      if (!isBuilding) return;

      for (let i = 0; i < pos.count; i++) {
        tmpVec.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        verts.push(tmpVec.x, tmpVec.y, tmpVec.z);
      }

      if (geom.index) {
        const idx = geom.index.array;
        for (let i = 0; i < idx.length; i++) {
          indices.push(vertexOffset + idx[i]);
        }
      } else {
        for (let i = 0; i < pos.count; i++) {
          indices.push(vertexOffset + i);
        }
      }

      vertexOffset += pos.count;
    });

    if (verts.length < 9 || indices.length < 3) {
      return 0;
    }

    const body = this.physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const colliderDesc = RAPIER.ColliderDesc.trimesh(
      new Float32Array(verts),
      new Uint32Array(indices)
    ).setFriction(0.6);

    this.physics.world.createCollider(colliderDesc, body);
    this.chunkBodies.set(chunkKey, body);
    return indices.length / 3;
  }

  removeChunk(chunkKey: string): void {
    const body = this.chunkBodies.get(chunkKey);
    if (!body) return;
    this.physics.world.removeRigidBody(body);
    this.chunkBodies.delete(chunkKey);
  }

  dispose(): void {
    for (const key of [...this.chunkBodies.keys()]) {
      this.removeChunk(key);
    }
  }

  /** Number of chunk collider bodies currently registered (debug/QA). */
  getColliderCount(): number {
    return this.chunkBodies.size;
  }
}
