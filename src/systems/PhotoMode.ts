import type * as THREE from 'three';
import type { ChaseCamera } from '../player/ChaseCamera';
import type { HudOverlay } from '../ui/HudOverlay';

export class PhotoMode {
  public active = false;
  private bannerEl: HTMLElement;
  private canvas: HTMLCanvasElement;
  private chaseCam: ChaseCamera;
  private camera: THREE.PerspectiveCamera;
  private hud: HudOverlay;

  constructor(
    uiRoot: HTMLElement,
    canvas: HTMLCanvasElement,
    chaseCam: ChaseCamera,
    camera: THREE.PerspectiveCamera,
    hud: HudOverlay
  ) {
    this.canvas = canvas;
    this.chaseCam = chaseCam;
    this.camera = camera;
    this.hud = hud;

    this.bannerEl = document.createElement('div');
    this.bannerEl.className =
      'hidden pointer-events-auto absolute bottom-5 left-1/2 -translate-x-1/2 hud-glass rounded-full px-5 py-2 flex items-center gap-3 text-xs text-white shadow-2xl';
    this.bannerEl.innerHTML = `
      <span class="font-bold text-amber-300">PHOTO MODE</span>
      <span class="text-slate-300">WASD + Space/C Fly • Mouse Look</span>
      <button id="photo-snap-btn" class="px-3 py-1 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer">
        Snap PNG
      </button>
      <button id="photo-exit-btn" class="px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 text-white font-semibold cursor-pointer">
        Exit (O)
      </button>
    `;
    uiRoot.appendChild(this.bannerEl);

    this.bannerEl.querySelector('#photo-snap-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.downloadSnapshot();
    });
    this.bannerEl.querySelector('#photo-exit-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    window.addEventListener('keydown', (e) => {
      if (this.active && e.code === 'Enter') {
        e.preventDefault();
        this.downloadSnapshot();
      }
    });
  }

  toggle(): boolean {
    this.active = !this.active;
    if (this.active) {
      this.hud.setVisible(false);
      this.bannerEl.classList.remove('hidden');
      this.chaseCam.enterPhotoMode(this.camera);
    } else {
      this.bannerEl.classList.add('hidden');
      this.hud.setVisible(true);
      this.chaseCam.exitPhotoMode();
    }
    return this.active;
  }

  downloadSnapshot(): void {
    const dataUrl = this.canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `namma-rvitm-photo-${Date.now()}.png`;
    a.click();
    this.hud.showToast('Photo saved (PNG)!');
  }
}
