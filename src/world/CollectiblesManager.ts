/**
 * CollectiblesManager.ts
 *
 * Hidden RVITM Golden Badges placed across campus landmarks.
 * Collecting a badge awards ₹100 and tracks progress.
 */

import * as THREE from 'three';

interface BadgeItem {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  mesh: THREE.Mesh;
  collected: boolean;
}

const BADGE_SPOTS = [
  { id: 'badge-porch', label: 'Academic Porch Badge', x: 18.0, y: 1.2, z: -13.0 },
  { id: 'badge-quad', label: 'Quadrangle Flagpole Badge', x: 27.5, y: 1.2, z: 10.0 },
  { id: 'badge-canteen', label: 'Canteen Terrace Badge', x: 32.0, y: 1.2, z: 36.0 },
  { id: 'badge-cricket', label: 'Cricket Turf Badge', x: 20.5, y: 1.2, z: 73.0 },
  { id: 'badge-library', label: 'Central Library Badge', x: 14.0, y: 1.2, z: 8.5 },
  { id: 'badge-auditorium', label: 'Auditorium Plaza Badge', x: 14.0, y: 1.2, z: -26.5 },
];

export class CollectiblesManager {
  private items: BadgeItem[] = [];
  private time = 0;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.OctahedronGeometry(0.45, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.45,
      metalness: 0.7,
      roughness: 0.25,
    });

    for (const spot of BADGE_SPOTS) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(spot.x, spot.y, spot.z);
      mesh.castShadow = true;
      scene.add(mesh);
      this.items.push({ ...spot, mesh, collected: false });
    }
  }

  update(dt: number, px: number, pz: number): BadgeItem | null {
    this.time += dt;
    let picked: BadgeItem | null = null;

    for (const item of this.items) {
      if (item.collected) continue;
      item.mesh.rotation.y = this.time * 2.2;
      item.mesh.position.y = item.y + Math.sin(this.time * 3.0) * 0.18;

      if (Math.hypot(px - item.x, pz - item.z) < 2.2) {
        item.collected = true;
        item.mesh.visible = false;
        picked = item;
      }
    }
    return picked;
  }

  getProgress(): { collected: number; total: number } {
    return {
      collected: this.items.filter((i) => i.collected).length,
      total: this.items.length,
    };
  }
}
