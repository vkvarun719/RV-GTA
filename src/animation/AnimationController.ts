/**
 * AnimationController.ts
 *
 * Manages all skeletal animations for the player character using Three.js
 * AnimationMixer.  Clip names are matched against those bundled inside the
 * player.glb (Mixamo-compatible export) and blended smoothly.
 *
 * Animation states
 * ───────────────
 *  Idle          – standing still
 *  Walk          – slow movement (< ~6 m/s)
 *  Run           – normal run (< ~9 m/s)
 *  Sprint        – top-speed run (Shift held)
 *  Jump          – airborne (ascending)
 *  Land          – brief landing recovery
 *  Turn          – sharp direction change while nearly stationary
 *  VehicleEnter  – getting into a vehicle
 *  VehicleExit   – stepping out of a vehicle
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

/** Mapping from our canonical state names to possible clip names inside GLBs. */
const CLIP_ALIASES: Record<AnimState, string[]> = {
  Idle:         ['Idle', 'idle', 'T-Pose', 'TPose', 'mixamo.com'],
  Walk:         ['Walk', 'walk', 'Walking', 'walking'],
  Run:          ['Run', 'run', 'Running', 'running', 'Jog', 'jog'],
  Sprint:       ['Sprint', 'sprint', 'FastRun', 'fast_run', 'Running Fast'],
  Jump:         ['Jump', 'jump', 'Jumping', 'jumping', 'Jump Up'],
  Land:         ['Land', 'land', 'Landing', 'landing', 'Land Soft'],
  Turn:         ['Turn', 'turn', 'TurnLeft', 'TurnRight', 'Turning'],
  VehicleEnter: ['VehicleEnter', 'vehicle_enter', 'Get In Car', 'GetIn'],
  VehicleExit:  ['VehicleExit', 'vehicle_exit', 'Get Out Car', 'GetOut'],
};

/** Default cross-fade durations (seconds) for each transition. */
const FADE_DURATION: Record<AnimState, number> = {
  Idle:         0.25,
  Walk:         0.20,
  Run:          0.18,
  Sprint:       0.15,
  Jump:         0.12,
  Land:         0.10,
  Turn:         0.15,
  VehicleEnter: 0.20,
  VehicleExit:  0.20,
};

/** One-shot states that should not loop and transition back to Idle on finish. */
const ONE_SHOT: Set<AnimState> = new Set(['Jump', 'Land', 'Turn', 'VehicleEnter', 'VehicleExit']);

export class AnimationController {
  private mixer: THREE.AnimationMixer;
  private actions: Map<AnimState, THREE.AnimationAction> = new Map();
  private currentState: AnimState = 'Idle';
  private oneShotFinished = false;

  /** True once the GLB and at least Idle/Walk/Run clips have been registered. */
  public ready = false;

  constructor(rootObject: THREE.Object3D) {
    this.mixer = new THREE.AnimationMixer(rootObject);

    // Listen for finished one-shot actions so we can return to Idle
    this.mixer.addEventListener('finished', (_e: THREE.Event) => {
      if (ONE_SHOT.has(this.currentState)) {
        this.oneShotFinished = true;
      }
    });
  }

  /**
   * Register animation clips from a loaded GLTF.
   * Call this once after GLTFLoader resolves.
   */
  public registerClips(clips: THREE.AnimationClip[]): void {
    for (const [state, aliases] of Object.entries(CLIP_ALIASES) as [AnimState, string[]][]) {
      if (this.actions.has(state)) continue; // already found

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
          break;
        }
      }
    }

    // Start Idle if available
    const idle = this.actions.get('Idle');
    if (idle) {
      idle.setEffectiveWeight(1);
      idle.play();
      this.currentState = 'Idle';
      this.ready = true;
    } else if (this.actions.size > 0) {
      // Fall back to whatever we have
      const first = this.actions.values().next().value!;
      first.setEffectiveWeight(1);
      first.play();
      this.ready = true;
    }

    const found = [...this.actions.keys()].join(', ');
    console.log(`[AnimationController] Registered clips: ${found || 'none'}`);
  }

  /**
   * Transition to a new animation state with cross-fading.
   * Returns true if the transition was applied.
   */
  public transition(next: AnimState, fadeOverride?: number): boolean {
    if (!this.ready) return false;
    if (this.currentState === next && !ONE_SHOT.has(next)) return false;

    const nextAction = this.actions.get(next);
    if (!nextAction) {
      // Fall back to closest available state
      const fallback = this.getFallback(next);
      if (fallback) return this.transition(fallback, fadeOverride);
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

  /** Select a fallback state when the requested clip isn't loaded. */
  private getFallback(state: AnimState): AnimState | null {
    const fallbacks: Partial<Record<AnimState, AnimState>> = {
      Sprint:       'Run',
      Run:          'Walk',
      Land:         'Idle',
      Turn:         'Idle',
      VehicleEnter: 'Idle',
      VehicleExit:  'Idle',
    };
    return fallbacks[state] ?? null;
  }

  /**
   * Drive animation time scale so that Walk/Run cycles match actual movement speed.
   * @param horizSpeed  Horizontal speed in m/s
   */
  public syncSpeed(horizSpeed: number): void {
    const walkAction   = this.actions.get('Walk');
    const runAction    = this.actions.get('Run');
    const sprintAction = this.actions.get('Sprint');

    if (walkAction && (this.currentState === 'Walk')) {
      // Clamp scale: 0.5 (creeping) → 1.4 (brisk walk)
      walkAction.setEffectiveTimeScale(Math.max(0.5, Math.min(1.4, horizSpeed / 3.5)));
    }
    if (runAction && (this.currentState === 'Run')) {
      runAction.setEffectiveTimeScale(Math.max(0.7, Math.min(1.5, horizSpeed / 7.0)));
    }
    if (sprintAction && (this.currentState === 'Sprint')) {
      sprintAction.setEffectiveTimeScale(Math.max(1.0, Math.min(2.0, horizSpeed / 9.0)));
    }
  }

  /**
   * Must be called every frame with the elapsed time in seconds.
   * Returns true if a one-shot animation finished this frame.
   */
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

  /** True if the given state has a loaded clip. */
  public hasClip(state: AnimState): boolean {
    return this.actions.has(state);
  }
}
