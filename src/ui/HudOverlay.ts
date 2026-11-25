import { ACADEMIC_BLOCK, LANDMARKS } from '../data/campus-layout';
import osmDataRaw from '../data/campus-osm.json';
import type {
  ActiveMissionState,
  MinimapBlip,
  OsmDataset,
  VehicleTelemetry,
  WeatherState,
} from '../types/game';

const osmData = osmDataRaw as OsmDataset;

export class HudOverlay {
  public readonly root: HTMLElement;
  private minimapCanvas!: HTMLCanvasElement;
  private minimapCtx!: CanvasRenderingContext2D;

  private cashEl!: HTMLElement;
  private zoneEl!: HTMLElement;
  private weatherEl!: HTMLElement;
  private fpsEl!: HTMLElement;
  private radioEl!: HTMLElement;

  private missionBoxEl!: HTMLElement;
  private missionTitleEl!: HTMLElement;
  private missionObjEl!: HTMLElement;
  private missionTimerEl!: HTMLElement;

  private promptEl!: HTMLElement;
  private subtitleEl!: HTMLElement;
  private toastEl!: HTMLElement;
  private lockHintEl!: HTMLElement;

  private vehicleBoxEl!: HTMLElement;
  private speedEl!: HTMLElement;
  private vehicleNameEl!: HTMLElement;
  private autoMeterEl!: HTMLElement;

  private subtitleTimer = 0;
  private toastTimer = 0;
  public visible = true;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'w-full h-full relative';
    this.root.innerHTML = `
      <!-- Top Left: Brand, Zone, Weather -->
      <div class="absolute top-4 left-4 flex flex-col gap-2">
        <div class="hud-glass rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-xl">
          <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-700 to-amber-500 flex items-center justify-center font-black text-sm tracking-tight text-white shadow">
            RV
          </div>
          <div>
            <div class="text-xs font-extrabold tracking-widest text-amber-400 uppercase">Namma RVITM</div>
            <div id="hud-zone" class="text-sm font-semibold text-white">80 Feet Road • Main Gate</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <div id="hud-weather" class="hud-pill rounded-lg px-3 py-1.5 text-xs font-medium text-sky-200 flex items-center gap-1.5">
            <span>☀️</span><span>26°C Bengaluru</span>
          </div>
          <div id="hud-radio" class="hud-pill rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-300 hidden">
            📻 Radio Lo-Fi
          </div>
          <div id="hud-fps" class="hud-pill rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-300">
            60 FPS
          </div>
        </div>
      </div>

      <!-- Top Right: Cash & Active Mission -->
      <div class="absolute top-4 right-4 flex flex-col items-end gap-2 max-w-xs">
        <div class="hud-glass rounded-xl px-4 py-2 flex items-center gap-3 shadow-xl">
          <span class="text-xs uppercase tracking-wider text-slate-400 font-semibold">Balance</span>
          <span id="hud-cash" class="text-xl font-black text-emerald-400 tabular-nums">₹500</span>
        </div>
        <div id="hud-mission" class="hud-glass rounded-xl px-4 py-3 w-72 hidden border-l-4 border-amber-400 shadow-xl">
          <div class="flex items-center justify-between gap-2">
            <span id="hud-mission-title" class="text-xs font-extrabold uppercase tracking-wider text-amber-300">Mission</span>
            <span id="hud-mission-timer" class="text-sm font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded">01:30</span>
          </div>
          <div id="hud-mission-obj" class="mt-1 text-xs text-slate-200 leading-snug">Reach the target</div>
        </div>
      </div>

      <!-- Center Pointer Lock Hint -->
      <div id="hud-lock-hint" class="max-md:hidden absolute top-4 left-1/2 -translate-x-1/2 hud-pill rounded-full px-4 py-1.5 text-xs text-slate-200 shadow-lg whitespace-nowrap">
        Click view to lock camera • <span class="text-amber-300 font-semibold">Esc</span> Pause
      </div>

      <!-- Center Bottom: Subtitles, Interaction Prompt, Toast -->
      <div class="absolute bottom-60 md:bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 max-w-md w-full px-4">
        <div id="hud-toast" class="hidden hud-pill rounded-full px-4 py-1.5 text-xs font-bold text-amber-300 shadow-lg"></div>
        <div id="hud-prompt" class="hidden hud-glass rounded-xl px-4 py-2 text-sm font-bold text-white border border-amber-400/50 shadow-xl"></div>
        <div id="hud-subtitle" class="hidden hud-glass rounded-xl px-5 py-2.5 text-sm font-medium text-amber-100 text-center shadow-2xl"></div>
      </div>

      <!-- Bottom Left: Minimap Radar -->
      <div class="absolute bottom-4 left-4 flex flex-col items-start gap-1.5">
        <div class="hud-glass p-1.5 rounded-2xl shadow-2xl">
          <canvas id="minimap-canvas" width="176" height="176" class="rounded-xl block bg-slate-900"></canvas>
        </div>
        <div class="text-[10px] font-semibold tracking-wide text-slate-300/90 hud-text-shadow px-1">
          [M] Full Map • [P] Phone • [~] Cheats
        </div>
      </div>

      <!-- Bottom Right: Vehicle Speedometer / Auto Meter + Controls Strip -->
      <div class="absolute bottom-4 right-4 flex flex-col items-end gap-2">
        <div id="hud-vehicle" class="hidden hud-glass rounded-xl px-4 py-3 min-w-[210px] shadow-xl">
          <div class="flex items-baseline justify-between gap-4">
            <span id="hud-veh-name" class="text-xs font-bold uppercase tracking-wider text-amber-300">Scooter</span>
            <div>
              <span id="hud-speed" class="text-2xl font-black text-white tabular-nums">0</span>
              <span class="text-[11px] text-slate-400 font-semibold ml-0.5">km/h</span>
            </div>
          </div>
          <div id="hud-auto-meter" class="hidden mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-xs">
            <span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">METER ON</span>
            <span class="font-mono font-bold text-amber-300">₹30.00</span>
          </div>
        </div>
        <div class="hud-pill rounded-xl px-3 py-1.5 text-[11px] text-slate-300 hidden md:flex items-center gap-2.5">
          <span><b class="text-white">WASD</b> Move</span>
          <span><b class="text-white">Shift</b> Sprint</span>
          <span><b class="text-white">Space</b> Jump/Drift</span>
          <span><b class="text-white">F</b> Vehicle</span>
          <span><b class="text-white">E</b> Interact</span>
          <span><b class="text-white">H</b> Horn</span>
          <span><b class="text-white">O</b> Photo</span>
          <span><b class="text-white">B</b> 15s Clip</span>
        </div>
      </div>
    `;
    container.appendChild(this.root);

    this.minimapCanvas = this.root.querySelector('#minimap-canvas')!;
    this.minimapCtx = this.minimapCanvas.getContext('2d')!;
    this.cashEl = this.root.querySelector('#hud-cash')!;
    this.zoneEl = this.root.querySelector('#hud-zone')!;
    this.weatherEl = this.root.querySelector('#hud-weather')!;
    this.fpsEl = this.root.querySelector('#hud-fps')!;
    this.radioEl = this.root.querySelector('#hud-radio')!;

    this.missionBoxEl = this.root.querySelector('#hud-mission')!;
    this.missionTitleEl = this.root.querySelector('#hud-mission-title')!;
    this.missionObjEl = this.root.querySelector('#hud-mission-obj')!;
    this.missionTimerEl = this.root.querySelector('#hud-mission-timer')!;

    this.promptEl = this.root.querySelector('#hud-prompt')!;
    this.subtitleEl = this.root.querySelector('#hud-subtitle')!;
    this.toastEl = this.root.querySelector('#hud-toast')!;
    this.lockHintEl = this.root.querySelector('#hud-lock-hint')!;

    this.vehicleBoxEl = this.root.querySelector('#hud-vehicle')!;
    this.speedEl = this.root.querySelector('#hud-speed')!;
    this.vehicleNameEl = this.root.querySelector('#hud-veh-name')!;
    this.autoMeterEl = this.root.querySelector('#hud-auto-meter')!;
  }

  setVisible(vis: boolean): void {
    this.visible = vis;
    this.root.style.display = vis ? 'block' : 'none';
  }

  setPointerLocked(locked: boolean): void {
    this.lockHintEl.classList.toggle('hidden', locked);
  }

  showSubtitle(text: string, duration = 4.5): void {
    this.subtitleEl.textContent = text;
    this.subtitleEl.classList.remove('hidden');
    this.subtitleTimer = duration;
  }

  showToast(text: string, duration = 2.8): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden');
    this.toastTimer = duration;
  }

  setPrompt(text: string | null): void {
    if (!text) {
      this.promptEl.classList.add('hidden');
      return;
    }
    this.promptEl.textContent = text;
    this.promptEl.classList.remove('hidden');
  }

  update(
    dt: number,
    playerX: number,
    playerZ: number,
    headingYaw: number,
    cash: number,
    fps: number,
    weather: WeatherState,
    radioOn: boolean,
    mission: ActiveMissionState | null,
    vehicle: VehicleTelemetry | null,
    blips: MinimapBlip[]
  ): void {
    if (this.subtitleTimer > 0) {
      this.subtitleTimer -= dt;
      if (this.subtitleTimer <= 0) this.subtitleEl.classList.add('hidden');
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.classList.add('hidden');
    }

    this.cashEl.textContent = `₹${cash.toLocaleString('en-IN')}`;
    this.fpsEl.textContent = `${fps} FPS`;
    this.zoneEl.textContent = this.resolveZoneName(playerX, playerZ);
    this.weatherEl.innerHTML = `<span>${weather.isRaining ? '🌧️' : weather.mode === 'night' ? '🌙' : weather.mode === 'golden' ? '🌇' : '☀️'}</span><span>${weather.temperatureC}°C • ${weather.label}</span>`;
    this.radioEl.classList.toggle('hidden', !radioOn);

    if (mission && mission.status === 'active') {
      const cp = mission.definition.checkpoints[mission.checkpointIndex];
      this.missionBoxEl.classList.remove('hidden');
      this.missionTitleEl.textContent = mission.definition.title;
      this.missionObjEl.textContent = cp ? cp.label : mission.definition.brief;
      const mins = Math.floor(Math.max(0, mission.timeRemaining) / 60);
      const secs = Math.floor(Math.max(0, mission.timeRemaining) % 60);
      this.missionTimerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      this.missionTimerEl.classList.toggle('text-rose-400', mission.timeRemaining < 15);
    } else {
      this.missionBoxEl.classList.add('hidden');
    }

    if (vehicle) {
      this.vehicleBoxEl.classList.remove('hidden');
      this.vehicleNameEl.textContent = vehicle.name;
      this.speedEl.textContent = `${Math.round(vehicle.speedKmh)}`;
      if (vehicle.isAutoRickshaw) {
        this.autoMeterEl.classList.remove('hidden');
        this.autoMeterEl.innerHTML = `
          <span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">METER ON</span>
          <span class="font-mono font-bold text-amber-300">₹${vehicle.fareInr.toFixed(0)} • ${vehicle.distanceKm.toFixed(2)} km</span>
        `;
      } else {
        this.autoMeterEl.classList.add('hidden');
      }
    } else {
      this.vehicleBoxEl.classList.add('hidden');
    }

    this.drawMinimap(playerX, playerZ, headingYaw, blips);
  }

  private resolveZoneName(x: number, z: number): string {
    if (Math.hypot(x - ACADEMIC_BLOCK.entranceTarget.x, z - ACADEMIC_BLOCK.entranceTarget.z) < 16) {
      return '7-Floor Academic Block Porch';
    }
    if (Math.hypot(x - LANDMARKS.canteen.x, z - LANDMARKS.canteen.z) < 14) {
      return 'RVITM Canteen & Food Court';
    }
    if (Math.hypot(x - LANDMARKS.basketballCourt.x, z - LANDMARKS.basketballCourt.z) < 16) {
      return 'RVITM Basketball & Turf';
    }
    if (Math.hypot(x - LANDMARKS.parking.x, z - LANDMARKS.parking.z) < 14) {
      return 'Student Parking Lot';
    }
    if (Math.hypot(x - LANDMARKS.chaiStall.x, z - LANDMARKS.chaiStall.z) < 14) {
      return 'Goli Chai Tapri (Opp. Gate)';
    }
    if (Math.hypot(x - LANDMARKS.xeroxShop.x, z - LANDMARKS.xeroxShop.z) < 12) {
      return 'Benglooru Xerox & Records';
    }
    if (x > -34 && x < 54 && z > -55 && z < 88) {
      return 'RVITM Campus Courtyard';
    }
    if (x >= 54 && x < 78) {
      return '80 Feet Road • JP Nagar 8th Phase';
    }
    if (z > 130) {
      return 'Brookes Haven Main Road';
    }
    return 'Chaithanya Layout • JP Nagar';
  }

  private drawMinimap(px: number, pz: number, yaw: number, blips: MinimapBlip[]): void {
    const ctx = this.minimapCtx;
    const size = this.minimapCanvas.width;
    const half = size * 0.5;
    const scale = 1.05; // 1 meter = 1.05px (~165m diameter radar)

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(half, half);
    // Rotate radar around camera/player heading so "up" is forward
    ctx.rotate(yaw);

    const drawPoly = (pts: [number, number][], fill: string, stroke?: string) => {
      if (pts.length < 2) return;
      ctx.beginPath();
      pts.forEach(([x, z], i) => {
        const sx = (x - px) * scale;
        const sy = (z - pz) * scale;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    };

    // Campus ground polygon
    drawPoly(osmData.campusPolygon as [number, number][], 'rgba(34, 197, 94, 0.16)', 'rgba(134, 239, 172, 0.45)');

    // Roads
    for (const r of osmData.roads) {
      ctx.beginPath();
      r.points.forEach(([x, z], i) => {
        const sx = (x - px) * scale;
        const sy = (z - pz) * scale;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.strokeStyle = r.highway === 'secondary' ? '#64748b' : '#334155';
      ctx.lineWidth = r.highway === 'secondary' ? 7 : 3.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // 7-Floor Academic Block footprint
    drawPoly(osmData.academicBuilding as [number, number][], '#991b1b', '#fca5a5');

    // Blips (missions, vehicles, shops)
    for (const b of blips) {
      const dx = (b.x - px) * scale;
      const dz = (b.z - pz) * scale;
      const dist = Math.hypot(dx, dz);
      const maxR = half - 10;
      const clampedX = dist > maxR ? (dx / dist) * maxR : dx;
      const clampedZ = dist > maxR ? (dz / dist) * maxR : dz;

      ctx.beginPath();
      ctx.arc(clampedX, clampedZ, b.kind === 'objective' ? 5.5 : b.kind === 'story' || b.kind === 'side' ? 4.8 : 3.2, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();

    // Player Center Arrow
    ctx.save();
    ctx.translate(half, half);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
