export type ActionKey =
  | 'interact'
  | 'vehicleToggle'
  | 'horn'
  | 'phone'
  | 'map'
  | 'terminal'
  | 'photo'
  | 'clip'
  | 'pause'
  | 'jump';

export class InputManager {
  private keys = new Set<string>();
  private justPressed = new Set<string>();
  public mouseDeltaX = 0;
  public mouseDeltaY = 0;
  public wheelDelta = 0;
  public isPointerLocked = false;
  public uiBlocksGameplay = false;
  private canvas: HTMLCanvasElement;
  private onActionCallbacks = new Map<ActionKey, Array<() => void>>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.bindEvents();
  }

  private bindEvents(): void {
    window.addEventListener('keydown', (e) => {
      const code = e.code;

      // Global modal toggles work even when UI blocks movement (except when typing in an <input>)
      const activeTag = document.activeElement?.tagName;
      const typingInInput = activeTag === 'INPUT' || activeTag === 'TEXTAREA';

      if (code === 'Escape') {
        this.emit('pause');
        return;
      }

      if (code === 'Backquote') {
        e.preventDefault();
        this.emit('terminal');
        return;
      }

      if (typingInInput) return;

      if (!this.keys.has(code)) {
        this.justPressed.add(code);
        this.dispatchAction(code);
      }
      this.keys.add(code);

      if (code === 'Space' && !this.uiBlocksGameplay) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.justPressed.clear();
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.canvas;
    });

    this.canvas.addEventListener('click', () => {
      if (!this.uiBlocksGameplay && !this.isPointerLocked) {
        this.requestPointerLock();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked) {
        this.mouseDeltaX += e.movementX;
        this.mouseDeltaY += e.movementY;
      }
    });

    window.addEventListener(
      'wheel',
      (e) => {
        if (!this.uiBlocksGameplay) {
          this.wheelDelta += e.deltaY;
        }
      },
      { passive: true }
    );
  }

  private dispatchAction(code: string): void {
    switch (code) {
      case 'KeyP':
        this.emit('phone');
        return;
      case 'KeyM':
        this.emit('map');
        return;
      case 'KeyO':
        this.emit('photo');
        return;
      case 'KeyB':
        this.emit('clip');
        return;
      default:
        break;
    }

    if (this.uiBlocksGameplay) return;

    switch (code) {
      case 'KeyE':
        this.emit('interact');
        break;
      case 'KeyF':
        this.emit('vehicleToggle');
        break;
      case 'KeyH':
        this.emit('horn');
        break;
      case 'Space':
        this.emit('jump');
        break;
    }
  }

  onAction(action: ActionKey, cb: () => void): void {
    const list = this.onActionCallbacks.get(action) ?? [];
    list.push(cb);
    this.onActionCallbacks.set(action, list);
  }

  private emit(action: ActionKey): void {
    const list = this.onActionCallbacks.get(action);
    if (!list) return;
    for (const cb of list) cb();
  }

  requestPointerLock(): void {
    try {
      const maybePromise = this.canvas.requestPointerLock?.() as unknown as Promise<void> | undefined;
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(() => {});
      }
    } catch {
      // Ignore browser pointer lock rejection
    }
  }

  exitPointerLock(): void {
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }

  isDown(code: string): boolean {
    if (this.uiBlocksGameplay) return false;
    return this.keys.has(code);
  }

  isDownRaw(code: string): boolean {
    return this.keys.has(code);
  }

  getMoveAxes(): { forward: number; right: number; sprint: boolean; brake: boolean } {
    if (this.uiBlocksGameplay) {
      return { forward: 0, right: 0, sprint: false, brake: false };
    }
    const forward = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    const right = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const brake = this.keys.has('Space');
    return { forward, right, sprint, brake };
  }

  consumeMouseDelta(): { dx: number; dy: number; wheel: number } {
    const dx = this.mouseDeltaX;
    const dy = this.mouseDeltaY;
    const wheel = this.wheelDelta;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.wheelDelta = 0;
    return { dx, dy, wheel };
  }

  clearFrame(): void {
    this.justPressed.clear();
  }
}
