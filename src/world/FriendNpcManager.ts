/**
 * FriendNpcManager.ts
 *
 * 7 distinct RVITM student friend characters stationed at recognizable campus
 * spots. Uses modular/replaceable low-poly human meshes so custom GLB models
 * can be swapped in later without changing dialogue or interaction logic.
 */

import * as THREE from 'three';

export interface FriendNpc {
  id: string;
  name: string;
  branch: string;
  locationLabel: string;
  x: number;
  z: number;
  yaw: number;
  lines: string[];
  shirtColor: number;
  pantsColor: number;
  group: THREE.Group;
  talkedCount: number;
}

const FRIEND_SPECS: Array<{
  id: string;
  name: string;
  branch: string;
  locationLabel: string;
  x: number;
  z: number;
  yaw: number;
  shirtColor: number;
  pantsColor: number;
  lines: string[];
}> = [
  {
    id: 'friend-arjun',
    name: 'Arjun',
    branch: 'CSE 6th Sem',
    locationLabel: 'Main Gate',
    x: 47.0,
    z: -19.5,
    yaw: Math.PI * 0.4,
    shirtColor: 0x2563eb,
    pantsColor: 0x1e293b,
    lines: [
      'Arjun: "Macha! ID card check is strict near the gate today — keep moving!"',
      'Arjun: "Press [P] for Phone Gigs if you want quick cash for cutting chai."',
    ],
  },
  {
    id: 'friend-divya',
    name: 'Divya',
    branch: 'ISE 6th Sem',
    locationLabel: 'Central Library',
    x: 15.5,
    z: 6.5,
    yaw: Math.PI * 0.5,
    shirtColor: 0xdb2777,
    pantsColor: 0x334155,
    lines: [
      'Divya: "Just reserved the last DBMS textbook in the Central Library!"',
      'Divya: "Have you seen the orange bookshelves inside? Check the Phone Inside gallery!"',
    ],
  },
  {
    id: 'friend-karthik',
    name: 'Karthik',
    branch: 'ECE 4th Sem',
    locationLabel: 'RVITM Canteen',
    x: 24.5,
    z: 31.0,
    yaw: -Math.PI * 0.3,
    shirtColor: 0xd97706,
    pantsColor: 0x1f2937,
    lines: [
      'Karthik: "Canteen masala dosa + filter kaapi is unbeatable after lab!"',
      'Karthik: "If it rains (or try MALEBANTHU), deliveries pay +25% extra!"',
    ],
  },
  {
    id: 'friend-sneha',
    name: 'Sneha',
    branch: 'AIML 6th Sem',
    locationLabel: 'RVITM Auditorium',
    x: 15.0,
    z: -24.5,
    yaw: Math.PI * 0.65,
    shirtColor: 0x7c3aed,
    pantsColor: 0x0f172a,
    lines: [
      'Sneha: "Tech fest rehearsals are starting in the Auditorium — stage lights look sick!"',
      'Sneha: "Grab a scooter from parking if you need to pick up fest passes."',
    ],
  },
  {
    id: 'friend-rohan',
    name: 'Rohan',
    branch: 'ME 8th Sem',
    locationLabel: 'Student Parking',
    x: 37.5,
    z: -1.5,
    yaw: -Math.PI * 0.5,
    shirtColor: 0x059669,
    pantsColor: 0x1e293b,
    lines: [
      'Rohan: "Parked the Pulsar right here. Press [F] near any bike, scooter, or auto!"',
      'Rohan: "Pro tip: try AUTOWALA or BULLET in the Cheat Terminal [~]!"',
    ],
  },
  {
    id: 'friend-ananya',
    name: 'Ananya',
    branch: 'CSE 4th Sem',
    locationLabel: 'Basketball Court',
    x: 21.5,
    z: 50.5,
    yaw: Math.PI * 0.2,
    shirtColor: 0xe11d48,
    pantsColor: 0x111827,
    lines: [
      'Ananya: "3v3 match starts at 5 PM! Watch out for the Cricket Turf next door."',
      'Ananya: "There are 6 Golden RVITM Badges hidden around campus — found any?"',
    ],
  },
  {
    id: 'friend-vikram',
    name: 'Vikram',
    branch: 'ISE 8th Sem',
    locationLabel: '80 Ft Rd Chai Tapri',
    x: 77.5,
    z: -20.5,
    yaw: -Math.PI * 0.55,
    shirtColor: 0x0284c7,
    pantsColor: 0x1e293b,
    lines: [
      'Vikram: "Nothing beats Goli Chai & Bun before 9 AM lecture!"',
      'Vikram: "80 Feet Road traffic gets wild — watch for BMTC buses and autos!"',
    ],
  },
];

export class FriendNpcManager {
  public readonly friends: FriendNpc[] = [];
  private time = 0;

  constructor(scene: THREE.Scene) {
    for (let i = 0; i < FRIEND_SPECS.length; i++) {
      const spec = FRIEND_SPECS[i];
      const group = this.buildCharacterMesh(spec.shirtColor, spec.pantsColor, i);
      group.position.set(spec.x, 0, spec.z);
      group.rotation.y = spec.yaw;
      scene.add(group);

      this.friends.push({
        ...spec,
        group,
        talkedCount: 0,
      });
    }
  }

  private buildCharacterMesh(shirtColor: number, pantsColor: number, idx = 0): THREE.Group {
    const g = new THREE.Group();
    const skinTones = [0xd2996c, 0xc68652, 0xb87544, 0xdba97e];
    const hairColors = [0x1c1917, 0x292524, 0x0f172a, 0x3f2318];
    const skinMat = new THREE.MeshStandardMaterial({ color: skinTones[idx % skinTones.length], roughness: 0.75 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.7 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.85 });
    const hairMat = new THREE.MeshStandardMaterial({ color: hairColors[idx % hairColors.length], roughness: 0.9 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6 });

    // Legs + Sneakers
    const legGeo = new THREE.BoxGeometry(0.16, 0.72, 0.18);
    const lLeg = new THREE.Mesh(legGeo, pantsMat);
    lLeg.position.set(-0.1, 0.4, 0);
    lLeg.castShadow = true;
    const rLeg = new THREE.Mesh(legGeo, pantsMat);
    rLeg.position.set(0.1, 0.4, 0);
    rLeg.castShadow = true;

    const shoeGeo = new THREE.BoxGeometry(0.165, 0.09, 0.24);
    const lShoe = new THREE.Mesh(shoeGeo, shoeMat);
    lShoe.position.set(-0.1, 0.045, 0.03);
    const rShoe = new THREE.Mesh(shoeGeo, shoeMat);
    rShoe.position.set(0.1, 0.045, 0.03);

    // Torso + optional student backpack on alternate friends
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.56, 0.24), shirtMat);
    torso.position.set(0, 1.03, 0);
    torso.castShadow = true;

    if (idx % 2 === 0) {
      const pack = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.36, 0.14),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 })
      );
      pack.position.set(0, 1.03, -0.17);
      pack.castShadow = true;
      g.add(pack);
    }

    // Arms (named for dialogue gesture animation)
    const armGeo = new THREE.BoxGeometry(0.12, 0.48, 0.13);
    const lArm = new THREE.Mesh(armGeo, shirtMat);
    lArm.name = 'lArm';
    lArm.position.set(-0.29, 1.02, 0);
    lArm.castShadow = true;
    const rArm = new THREE.Mesh(armGeo, shirtMat);
    rArm.name = 'rArm';
    rArm.position.set(0.29, 1.02, 0);
    rArm.castShadow = true;

    // Head + Varied Hairstyles
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), skinMat);
    head.position.set(0, 1.48, 0);
    head.castShadow = true;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.168, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.56), hairMat);
    hair.position.set(0, 1.5, 0);
    if (idx % 3 === 1) {
      // Hair bun silhouette
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), hairMat);
      bun.position.set(0, 1.58, -0.13);
      g.add(bun);
    }

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.55, 20),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.55 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;

    g.add(lLeg, rLeg, lShoe, rShoe, torso, lArm, rArm, head, hair, ring);
    return g;
  }

  update(dt: number, playerX: number, playerZ: number): void {
    this.time += dt;
    for (let i = 0; i < this.friends.length; i++) {
      const f = this.friends[i];
      const dist = Math.hypot(playerX - f.x, playerZ - f.z);
      const rArm = f.group.getObjectByName('rArm');
      if (dist < 5.5) {
        const targetYaw = Math.atan2(playerX - f.x, playerZ - f.z);
        f.group.rotation.y += (targetYaw - f.group.rotation.y) * Math.min(1, dt * 6);
        if (rArm) rArm.rotation.x = -0.35 + Math.sin(this.time * 4.5 + i) * 0.2;
      } else {
        f.group.rotation.y = f.yaw + Math.sin(this.time * 0.9 + i) * 0.08;
        if (rArm) rArm.rotation.x = Math.sin(this.time * 2.0 + i) * 0.05;
      }
    }
  }

  findNearest(x: number, z: number, maxDist = 3.2): FriendNpc | null {
    let best: FriendNpc | null = null;
    let bestDist = maxDist;
    for (const f of this.friends) {
      const d = Math.hypot(x - f.x, z - f.z);
      if (d < bestDist) {
        bestDist = d;
        best = f;
      }
    }
    return best;
  }

  interact(friend: FriendNpc): string {
    const line = friend.lines[friend.talkedCount % friend.lines.length];
    friend.talkedCount += 1;
    return line;
  }
}
