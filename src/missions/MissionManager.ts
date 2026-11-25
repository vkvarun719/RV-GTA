import * as THREE from 'three';
import type {
  ActiveMissionState,
  MinimapBlip,
  MissionDefinition,
  VehicleKind,
} from '../types/game';
import { GIG_TEMPLATES, STORY_AND_SIDE_MISSIONS, type GigTemplate } from './MissionData';

interface BeaconVisual {
  missionId: string;
  category: 'story' | 'side' | 'gig';
  group: THREE.Group;
  ring: THREE.Mesh;
  beam: THREE.Mesh;
  x: number;
  z: number;
}

export interface MissionCallbacks {
  onSubtitle: (msg: string) => void;
  onToast: (msg: string) => void;
  onCashEarned: (amount: number) => void;
  onMissionComplete: (missionId: string, isGig: boolean) => void;
  onSpawnVehicle: (kind: VehicleKind, x: number, z: number, yaw: number) => void;
  onTeleportPlayer: (x: number, z: number, yaw?: number) => void;
  onChime: (success: boolean) => void;
}

export class MissionManager {
  public activeMission: ActiveMissionState | null = null;
  public completedIds = new Set<string>();
  private beacons: BeaconVisual[] = [];
  private activeObjectiveBeacon: BeaconVisual | null = null;
  private scene: THREE.Scene;
  private cb: MissionCallbacks;
  private gigCounter = 0;

  constructor(scene: THREE.Scene, completedMissions: string[], cb: MissionCallbacks) {
    this.scene = scene;
    this.cb = cb;
    for (const id of completedMissions) this.completedIds.add(id);

    this.createStartBeacons();
  }

  private createBeaconMesh(colorHex: number, radius = 2.1): { group: THREE.Group; ring: THREE.Mesh; beam: THREE.Mesh } {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.72, radius, 28),
      new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.09;

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.55, radius * 0.75, 11, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    beam.position.y = 5.5;

    group.add(ring, beam);
    return { group, ring, beam };
  }

  private createStartBeacons(): void {
    for (const m of STORY_AND_SIDE_MISSIONS) {
      const color = m.category === 'story' ? 0xfacc15 : 0xa855f7; // Gold = Story, Purple = Side
      const vis = this.createBeaconMesh(color, 2.2);
      vis.group.position.set(m.startPos.x, 0, m.startPos.z);
      this.scene.add(vis.group);
      this.beacons.push({
        missionId: m.id,
        category: m.category,
        group: vis.group,
        ring: vis.ring,
        beam: vis.beam,
        x: m.startPos.x,
        z: m.startPos.z,
      });
    }
  }

  findNearbyStartMission(x: number, z: number): MissionDefinition | null {
    if (this.activeMission) return null;
    for (const m of STORY_AND_SIDE_MISSIONS) {
      if (Math.hypot(x - m.startPos.x, z - m.startPos.z) < 4.5) {
        return m;
      }
    }
    return null;
  }

  startMissionById(id: string, isRaining: boolean): boolean {
    const m = STORY_AND_SIDE_MISSIONS.find((item) => item.id === id);
    if (!m) return false;
    this.startMission(m, isRaining);
    return true;
  }

  startPhoneGig(tpl: GigTemplate, isRaining: boolean): void {
    const def: MissionDefinition = {
      id: `${tpl.id}-${++this.gigCounter}`,
      title: `Gig: ${tpl.title}`,
      category: 'gig',
      subtitle: tpl.brief,
      brief: tpl.brief,
      rewardCash: tpl.rewardCash,
      timeLimitSec: tpl.timeLimitSec,
      startPos: { x: tpl.pickup.x, z: tpl.pickup.z },
      checkpoints: [
        {
          id: 'gig-pickup',
          label: tpl.pickup.label,
          x: tpl.pickup.x,
          z: tpl.pickup.z,
          radius: 5.5,
          requiresVehicle: tpl.requiresVehicle,
          dialogue: tpl.pickup.dialogue,
        },
        {
          id: 'gig-dropoff',
          label: tpl.dropoff.label,
          x: tpl.dropoff.x,
          z: tpl.dropoff.z,
          radius: 5.5,
          requiresVehicle: tpl.requiresVehicle,
          dialogue: tpl.dropoff.dialogue,
        },
      ],
    };
    this.startMission(def, isRaining);
  }

  startMission(def: MissionDefinition, isRaining: boolean): void {
    this.clearObjectiveBeacon();

    if (def.spawnPlayerAt) {
      this.cb.onTeleportPlayer(def.spawnPlayerAt.x, def.spawnPlayerAt.z, def.spawnPlayerAt.yaw);
    }
    if (def.spawnVehicle) {
      this.cb.onSpawnVehicle(
        def.spawnVehicle.kind,
        def.spawnVehicle.x,
        def.spawnVehicle.z,
        def.spawnVehicle.yaw
      );
    }

    const rainBonusApplied = def.category === 'gig' && isRaining;
    this.activeMission = {
      definition: def,
      checkpointIndex: 0,
      timeRemaining: def.timeLimitSec,
      rainBonusApplied,
      status: 'active',
    };

    this.placeObjectiveBeacon(def.checkpoints[0].x, def.checkpoints[0].z, def.checkpoints[0].radius, def.category);
    this.cb.onSubtitle(`${def.title} — ${def.subtitle}`);
    this.cb.onChime(true);
  }

  private placeObjectiveBeacon(x: number, z: number, radius: number, category: MissionDefinition['category']): void {
    this.clearObjectiveBeacon();
    const color = category === 'story' ? 0xfacc15 : category === 'side' ? 0xc084fc : 0x22d3ee;
    const vis = this.createBeaconMesh(color, Math.max(2.4, radius * 0.6));
    vis.group.position.set(x, 0, z);
    this.scene.add(vis.group);
    this.activeObjectiveBeacon = {
      missionId: 'active-obj',
      category,
      group: vis.group,
      ring: vis.ring,
      beam: vis.beam,
      x,
      z,
    };
  }

  private clearObjectiveBeacon(): void {
    if (this.activeObjectiveBeacon) {
      this.scene.remove(this.activeObjectiveBeacon.group);
      this.activeObjectiveBeacon = null;
    }
  }

  cancelActiveMission(reason = 'Mission aborted'): void {
    if (!this.activeMission) return;
    this.clearObjectiveBeacon();
    this.activeMission = null;
    this.cb.onToast(reason);
  }

  update(
    dt: number,
    elapsed: number,
    playerX: number,
    playerZ: number,
    activeVehicleKind: VehicleKind | null,
    caughtByGuard: boolean,
    isRaining: boolean
  ): void {
    // Animate start beacons (hide while a mission is active)
    for (const b of this.beacons) {
      b.group.visible = !this.activeMission;
      if (b.group.visible) {
        const s = 1 + Math.sin(elapsed * 3.5) * 0.1;
        b.ring.scale.set(s, s, 1);
      }
    }

    if (this.activeObjectiveBeacon) {
      const s = 1 + Math.sin(elapsed * 4.5) * 0.14;
      this.activeObjectiveBeacon.ring.scale.set(s, s, 1);
    }

    const m = this.activeMission;
    if (!m || m.status !== 'active') return;

    if (m.definition.category === 'gig' && isRaining) {
      m.rainBonusApplied = true;
    }

    // Story 1 ID Guard hazard penalty
    if (m.definition.hasIdGuardHazard && caughtByGuard) {
      m.timeRemaining = Math.max(2, m.timeRemaining - 6);
      this.cb.onSubtitle('Guard: "Hey ID card check!" (-6s delay! Dodge the red zone!)');
      this.cb.onTeleportPlayer(63.5, -17.5, Math.PI * 0.5);
      this.cb.onChime(false);
    }

    m.timeRemaining -= dt;
    if (m.timeRemaining <= 0) {
      this.clearObjectiveBeacon();
      this.cb.onSubtitle(`Time's up on ${m.definition.title}! Try again macha!`);
      this.cb.onChime(false);
      this.activeMission = null;
      return;
    }

    const cp = m.definition.checkpoints[m.checkpointIndex];
    if (!cp) return;

    const dist = Math.hypot(playerX - cp.x, playerZ - cp.z);
    if (dist <= cp.radius) {
      if (cp.requiresVehicle && activeVehicleKind !== cp.requiresVehicle) {
        this.cb.onToast(`Requires an Auto-Rickshaw (${cp.requiresVehicle})!`);
        return;
      }
      if (cp.onFootOnly && activeVehicleKind !== null) {
        this.cb.onToast('Exit your vehicle [F] to finish on foot!');
        return;
      }

      if (cp.dialogue) {
        this.cb.onSubtitle(cp.dialogue);
      }

      m.checkpointIndex++;
      if (m.checkpointIndex >= m.definition.checkpoints.length) {
        // Completed!
        const bonus = m.rainBonusApplied ? Math.round(m.definition.rewardCash * 0.25) : 0;
        const total = m.definition.rewardCash + bonus;
        this.clearObjectiveBeacon();
        this.completedIds.add(m.definition.id);
        this.cb.onCashEarned(total);
        this.cb.onMissionComplete(m.definition.id, m.definition.category === 'gig');
        this.cb.onToast(
          bonus > 0
            ? `${m.definition.title} Complete! +₹${total} (incl. +25% Rain Bonus!)`
            : `${m.definition.title} Complete! +₹${total}`
        );
        this.cb.onChime(true);
        this.activeMission = null;
      } else {
        const nextCp = m.definition.checkpoints[m.checkpointIndex];
        this.placeObjectiveBeacon(nextCp.x, nextCp.z, nextCp.radius, m.definition.category);
        this.cb.onChime(true);
      }
    }
  }

  getBlips(): MinimapBlip[] {
    if (this.activeMission && this.activeObjectiveBeacon) {
      return [
        {
          x: this.activeObjectiveBeacon.x,
          z: this.activeObjectiveBeacon.z,
          color:
            this.activeMission.definition.category === 'story'
              ? '#facc15'
              : this.activeMission.definition.category === 'side'
                ? '#c084fc'
                : '#22d3ee',
          label: 'Objective',
          kind: 'objective',
        },
      ];
    }

    return STORY_AND_SIDE_MISSIONS.map((m) => ({
      x: m.startPos.x,
      z: m.startPos.z,
      color: m.category === 'story' ? '#facc15' : '#a855f7',
      label: m.title,
      kind: m.category,
    }));
  }

  getGigCatalog(): GigTemplate[] {
    return GIG_TEMPLATES;
  }
}
