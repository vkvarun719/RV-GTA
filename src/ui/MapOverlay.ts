import { ACADEMIC_BLOCK, LANDMARKS } from '../data/campus-layout';
import osmDataRaw from '../data/campus-osm.json';
import type { MinimapBlip, OsmDataset } from '../types/game';

const osmData = osmDataRaw as OsmDataset;

export class MapOverlay {
  public isOpen = false;
  private el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  public onOpenChange?: (open: boolean) => void;

  constructor(uiRoot: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className =
      'hidden pointer-events-auto absolute inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-6 z-40';
    this.el.innerHTML = `
      <div class="hud-glass rounded-3xl p-5 max-w-4xl w-full flex flex-col gap-3 shadow-2xl">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-black text-white tracking-tight">Namma RVITM — Campus & JP Nagar 8th Phase Map</h2>
            <p class="text-xs text-slate-400">OpenStreetMap Live Geometry (12.8729° N, 77.5757° E • Chaithanya Layout & 80 Feet Road)</p>
          </div>
          <button id="map-close-btn" class="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white cursor-pointer">
            Close [M]
          </button>
        </div>
        <canvas id="full-map-canvas" width="840" height="520" class="w-full rounded-2xl bg-slate-900 border border-white/10"></canvas>
        <div class="flex flex-wrap items-center gap-4 text-xs text-slate-300 px-1">
          <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-white inline-block"></span> You</span>
          <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-amber-400 inline-block"></span> Story Mission</span>
          <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-purple-400 inline-block"></span> Side Story</span>
          <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-sky-400 inline-block"></span> Vehicles</span>
          <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-rose-700 inline-block"></span> 7-Floor Academic Block</span>
        </div>
      </div>
    `;
    uiRoot.appendChild(this.el);

    this.canvas = this.el.querySelector('#full-map-canvas')!;
    this.ctx = this.canvas.getContext('2d')!;

    this.el.querySelector('#map-close-btn')!.addEventListener('click', () => this.toggle(false));
  }

  toggle(force?: boolean): boolean {
    this.isOpen = force !== undefined ? force : !this.isOpen;
    this.el.classList.toggle('hidden', !this.isOpen);
    this.onOpenChange?.(this.isOpen);
    return this.isOpen;
  }

  render(playerX: number, playerZ: number, blips: MinimapBlip[]): void {
    if (!this.isOpen) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const scale = 1.35;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0b1120';
    ctx.fillRect(0, 0, w, h);

    const toScreen = (x: number, z: number): [number, number] => [cx + x * scale, cy + z * scale];

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let gx = -300; gx <= 300; gx += 50) {
      const [sx] = toScreen(gx, 0);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
      ctx.stroke();
    }
    for (let gz = -200; gz <= 200; gz += 50) {
      const [, sy] = toScreen(0, gz);
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
      ctx.stroke();
    }

    // Surrounding OSM buildings
    for (const b of osmData.buildings) {
      if (b.points.length < 3) continue;
      ctx.beginPath();
      b.points.forEach(([x, z], i) => {
        const [sx, sy] = toScreen(x, z);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.closePath();
      ctx.fillStyle = 'rgba(148, 163, 184, 0.2)';
      ctx.fill();
    }

    // RVITM Campus Parcel
    ctx.beginPath();
    osmData.campusPolygon.forEach(([x, z], i) => {
      const [sx, sy] = toScreen(x, z);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(34, 197, 94, 0.18)';
    ctx.fill();
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2;
    ctx.stroke();

    // OSM Roads
    for (const r of osmData.roads) {
      ctx.beginPath();
      r.points.forEach(([x, z], i) => {
        const [sx, sy] = toScreen(x, z);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.strokeStyle = r.highway === 'secondary' ? '#94a3b8' : '#475569';
      ctx.lineWidth = r.highway === 'secondary' ? 7 : 3.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Academic Block
    ctx.beginPath();
    osmData.academicBuilding.forEach(([x, z], i) => {
      const [sx, sy] = toScreen(x, z);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.closePath();
    ctx.fillStyle = '#991b1b';
    ctx.fill();
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Landmark Labels
    const labels = [
      { x: ACADEMIC_BLOCK.center.x - 10, z: ACADEMIC_BLOCK.center.z, text: '7F ACADEMIC BLOCK' },
      { x: LANDMARKS.canteen.x, z: LANDMARKS.canteen.z, text: 'CANTEEN' },
      { x: LANDMARKS.basketballCourt.x, z: LANDMARKS.basketballCourt.z, text: 'COURTS' },
      { x: LANDMARKS.chaiStall.x + 8, z: LANDMARKS.chaiStall.z, text: 'GOLI CHAI' },
      { x: LANDMARKS.xeroxShop.x + 8, z: LANDMARKS.xeroxShop.z, text: 'XEROX' },
      { x: 64, z: -90, text: '80 FEET ROAD' },
      { x: -100, z: 150, text: 'BROOKES HAVEN MAIN RD' },
      { x: -105, z: -20, text: 'CHAITHANYA LAYOUT' },
    ];
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const l of labels) {
      const [sx, sy] = toScreen(l.x, l.z);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(l.text, sx, sy);
    }

    // Blips
    for (const b of blips) {
      const [sx, sy] = toScreen(b.x, b.z);
      ctx.beginPath();
      ctx.arc(sx, sy, b.kind === 'vehicle' ? 4 : 6, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Player Marker
    const [px, py] = toScreen(playerX, playerZ);
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}
