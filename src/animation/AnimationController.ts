/**
 * AnimationController.ts
 *
 * Manages skeletal animation clips and tracks which states have real clips
 * versus procedural fallbacks. Never maps T-Pose as an Idle animation.
 */

import * as THREE from 'three';

export type AnimState =
  | 'Idle'
  | 'Walk'
  | 'Run'
  | 'Sprint'
  | 'Jump'
  | 'Land'
  | 'Turn'
  | 'VehicleEnter'
  | 'VehicleExit';

const CLIP_ALIASES: Record<AnimState, string[]> = {
  Idle: ['Idle', 'idle'],
  Walk: ['Walk', 'walk', 'Walking', 'walking'],
  Run: ['Run', 'run', 'Running', 'running', 'Jog', 'jog'],
  Sprint: ['Sprint', 'sprint', 'FastRun', 'fast_run', 'Running Fast'],
  Jump: ['Jump', 'jump', 'Jumping', 'jumping', 'Jump Up'],
  Land: ['Land', 'land', 'Landing', 'landing', 'Land Soft'],
  Turn: ['Turn', 'turn', 'TurnLeft', 'TurnRight', 'Turning'],
  VehicleEnter: ['VehicleEnter', 'vehicle_enter', 'Get In Car', 'GetIn'],
  VehicleExit: ['VehicleExit', 'vehicle_exit', 'Get Out Car', 'GetOut'],
};

const FADE_DURATION: Record<AnimState, number> = {
  Idle: 0.25,
  Walk: 0.2,
  Run: 0.18,
  Sprint: 0.15,
  Jump: 0.12,
  Land: 0.1,
  Turn: 0.15,
  VehicleEnter: 0.2,
  VehicleExit: 0.2,
};

const ONE_SHOT: Set<AnimState> = new Set([
  'Jump',
  'Land',
  'Turn',
  'VehicleEnter',
  'VehicleExit',
]);

export class AnimationController {
  private mixer: THREE.AnimationMixer;
  private actions: Map<AnimState, THREE.AnimationAction> = new Map();
  private realClipStates: Set<AnimState> = new Set();
  private currentState: AnimState = 'Idle';
  private oneShotFinished = false;

  public ready = false;

  constructor(rootObject: THREE.Object3D) {
    this.mixer = new THREE.AnimationMixer(rootObject);
    this.mixer.addEventListener('finished', () => {
      if (ONE_SHOT.has(this.currentState)) {
        this.oneShotFinished = true;
      }
    });
  }

  public registerClips(clips: THREE.AnimationClip[]): void {
    for (const [state, aliases] of Object.entries(CLIP_ALIASES) as [AnimState, string[]][]) {
      if (this.actions.has(state)) continue;
      for (const alias of aliases) {
        const clip = THREE.AnimationClip.findByName(clips, alias);
        if (clip) {
          const action = this.mixer.clipAction(clip);
          action.enabled = true;
          action.setEffectiveWeight(0);
          if (ONE_SHOT.has(state)) {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
          } else {
            action.setLoop(THREE.LoopRepeat, Infinity);
          }
          this.actions.set(state, action);
          this.realClipStates.add(state);
          break;
        }
      }
    }

    const idle = this.actions.get('Idle');
    if (idle) {
      idle.setEffectiveWeight(1);
      idle.play();
      this.currentState = 'Idle';
      this.ready = true;
    }
  }

  public transition(next: AnimState, fadeOverride?: number): boolean {
    if (!this.ready) return false;
    if (this.currentState === next && !ONE_SHOT.has(next)) return false;

    const nextAction = this.actions.get(next);
    if (!nextAction) {
      this.currentState = next;
      this.oneShotFinished = false;
      return false;
    }

    const prevAction = this.actions.get(this.currentState);
    const fade = fadeOverride ?? FADE_DURATION[next] ?? 0.2;

    nextAction.reset();
    nextAction.setEffectiveWeight(1);
    nextAction.play();

    if (prevAction && prevAction !== nextAction) {
      prevAction.crossFadeTo(nextAction, fade, true);
    }

    this.currentState = next;
    this.oneShotFinished = false;
    return true;
  }

  public syncSpeed(horizSpeed: number): void {
    const walkAction = this.actions.get('Walk');
    const runAction = this.actions.get('Run');
    const sprintAction = this.actions.get('Sprint');

    if (walkAction && this.currentState === 'Walk') {
      walkAction.setEffectiveTimeScale(Math.max(0.5, Math.min(1.4, horizSpeed / 3.5)));
    }
    if (runAction && this.currentState === 'Run') {
      runAction.setEffectiveTimeScale(Math.max(0.7, Math.min(1.5, horizSpeed / 7.0)));
    }
    if (sprintAction && this.currentState === 'Sprint') {
      sprintAction.setEffectiveTimeScale(Math.max(1.0, Math.min(2.0, horizSpeed / 9.0)));
    }
  }

  public update(dt: number): boolean {
    this.mixer.update(dt);
    if (this.oneShotFinished) {
      this.oneShotFinished = false;
      this.transition('Idle');
      return true;
    }
    return false;
  }

  get state(): AnimState {
    return this.currentState;
  }

  public hasRealClip(state: AnimState): boolean {
    return this.realClipStates.has(state);
  }
}
