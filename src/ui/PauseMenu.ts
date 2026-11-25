import { STORY_AND_SIDE_MISSIONS } from '../missions/MissionData';
import type { GraphicsQuality, SaveData, WeatherMode } from '../types/game';

export interface PauseMenuCallbacks {
  onResume: () => void;
  onStartMission: (id: string) => void;
  onCancelMission: () => void;
  onGraphicsChange: (q: GraphicsQuality, auto: boolean) => void;
  onWeatherChange: (mode: WeatherMode) => void;
  onExportSave: () => void;
  onImportSave: (json: string) => boolean;
  onResetSave: () => void;
}

export class PauseMenu {
  public isOpen = false;
  private el: HTMLElement;
  private cb: PauseMenuCallbacks;

  constructor(uiRoot: HTMLElement, cb: PauseMenuCallbacks) {
    this.cb = cb;
    this.el = document.createElement('div');
    this.el.className =
      'hidden pointer-events-auto absolute inset-0 bg-slate-950/82 backdrop-blur-md flex items-start md:items-center justify-center p-4 z-50 overflow-y-auto';
    this.el.innerHTML = `
      <div class="hud-glass rounded-3xl max-w-4xl w-full my-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-5 shadow-2xl">
        <!-- Left Column: Missions & Controls -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-2xl font-black text-white">NAMMA RVITM</h2>
              <p class="text-xs text-amber-300 font-semibold">JP Nagar 8th Phase • Pause & Mission Briefs</p>
            </div>
            <button id="pause-resume-btn" class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer">
              Resume [Esc]
            </button>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs uppercase tracking-wider font-bold text-slate-400">Missions (Brief / Replay)</span>
              <button id="pause-abort-btn" class="text-[11px] text-rose-400 hover:text-rose-300 font-semibold cursor-pointer">Abort Current</button>
            </div>
            <div id="pause-missions-list" class="space-y-2 max-h-64 overflow-y-auto pr-1"></div>
          </div>

          <div class="rounded-2xl bg-white/5 border border-white/10 p-3 text-[11px] text-slate-300 space-y-1">
            <div class="font-bold text-white mb-1">Controls</div>
            <div class="grid grid-cols-2 gap-x-3 gap-y-0.5">
              <span><b>WASD</b> Move / Drive</span>
              <span><b>Mouse</b> Look / Orbit</span>
              <span><b>Shift</b> Sprint</span>
              <span><b>Space</b> Jump / Drift</span>
              <span><b>F</b> Enter / Exit Vehicle</span>
              <span><b>E</b> Interact / Start / Chai</span>
              <span><b>H</b> Vehicle Horn</span>
              <span><b>P</b> Smartphone</span>
              <span><b>M</b> Full Map</span>
              <span><b>~</b> Cheat Terminal</span>
              <span><b>O</b> Photo Mode (PNG)</span>
              <span><b>B</b> Save 15s Clip</span>
            </div>
          </div>
        </div>

        <!-- Right Column: Graphics, Weather & Save Persistence -->
        <div class="space-y-4">
          <div class="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
            <div class="text-xs uppercase tracking-wider font-bold text-slate-400">Graphics Quality</div>
            <div class="grid grid-cols-3 gap-2">
              <button data-gfx="low" class="gfx-btn py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 cursor-pointer">Low</button>
              <button data-gfx="medium" class="gfx-btn py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 cursor-pointer">Medium</button>
              <button data-gfx="high" class="gfx-btn py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 cursor-pointer">High</button>
            </div>
            <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input id="pause-auto-gfx" type="checkbox" class="accent-amber-400" />
              <span>Auto-scale quality if FPS drops below 38</span>
            </label>
          </div>

          <div class="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
            <div class="text-xs uppercase tracking-wider font-bold text-slate-400">Bengaluru Weather Override</div>
            <div class="grid grid-cols-3 gap-2">
              ${(
                [
                  ['auto', 'Live Auto'],
                  ['sunny', 'Sunny'],
                  ['golden', 'Golden Hr'],
                  ['night', 'Night'],
                  ['rain', 'Rain'],
                ] as Array<[WeatherMode, string]>
              )
                .map(
                  ([mode, label]) =>
                    `<button data-weather="${mode}" class="wx-btn py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 cursor-pointer">${label}</button>`
                )
                .join('')}
            </div>
          </div>

          <div class="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs uppercase tracking-wider font-bold text-slate-400">Save Data (localStorage)</span>
              <span id="pause-stats" class="text-[11px] text-emerald-300 font-semibold"></span>
            </div>
            <div class="flex flex-wrap gap-2">
              <button id="save-export-btn" class="flex-1 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer">
                Export JSON
              </button>
              <label class="flex-1 py-2 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs text-center cursor-pointer">
                Import JSON
                <input id="save-import-input" type="file" accept="application/json" class="hidden" />
              </label>
              <button id="save-reset-btn" class="py-2 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 font-bold text-xs cursor-pointer">
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    uiRoot.appendChild(this.el);

    this.el.querySelector('#pause-resume-btn')!.addEventListener('click', () => {
      this.toggle(false);
      this.cb.onResume();
    });
    this.el.querySelector('#pause-abort-btn')!.addEventListener('click', () => {
      this.cb.onCancelMission();
    });

    this.el.querySelectorAll('.gfx-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const q = btn.getAttribute('data-gfx') as GraphicsQuality;
        const auto = (this.el.querySelector('#pause-auto-gfx') as HTMLInputElement).checked;
        this.cb.onGraphicsChange(q, auto);
        this.highlightGfx(q);
      });
    });

    this.el.querySelector('#pause-auto-gfx')!.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      const activeBtn = this.el.querySelector('.gfx-btn.bg-amber-500');
      const q = (activeBtn?.getAttribute('data-gfx') as GraphicsQuality) ?? 'high';
      this.cb.onGraphicsChange(q, checked);
    });

    this.el.querySelectorAll('.wx-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-weather') as WeatherMode;
        this.cb.onWeatherChange(mode);
        this.highlightWeather(mode);
      });
    });

    this.el.querySelector('#save-export-btn')!.addEventListener('click', () => this.cb.onExportSave());

    this.el.querySelector('#save-import-input')!.addEventListener('change', async (e) => {
      const input = e.target as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;
      const txt = await file.text();
      this.cb.onImportSave(txt);
      input.value = '';
    });

    this.el.querySelector('#save-reset-btn')!.addEventListener('click', () => this.cb.onResetSave());
  }

  private highlightGfx(q: GraphicsQuality): void {
    this.el.querySelectorAll('.gfx-btn').forEach((b) => {
      const active = b.getAttribute('data-gfx') === q;
      b.className = active
        ? 'gfx-btn py-2 rounded-xl text-xs font-black bg-amber-500 text-slate-950 cursor-pointer'
        : 'gfx-btn py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white cursor-pointer';
    });
  }

  private highlightWeather(mode: WeatherMode): void {
    this.el.querySelectorAll('.wx-btn').forEach((b) => {
      const active = b.getAttribute('data-weather') === mode;
      b.className = active
        ? 'wx-btn py-2 rounded-xl text-xs font-black bg-sky-400 text-slate-950 cursor-pointer'
        : 'wx-btn py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white cursor-pointer';
    });
  }

  toggle(force?: boolean, saveData?: SaveData, autoGfx = false): boolean {
    this.isOpen = force !== undefined ? force : !this.isOpen;
    this.el.classList.toggle('hidden', !this.isOpen);
    if (this.isOpen && saveData) {
      this.renderState(saveData, autoGfx);
    }
    return this.isOpen;
  }

  renderState(saveData: SaveData, autoGfx: boolean): void {
    this.highlightGfx(saveData.graphicsQuality);
    this.highlightWeather(saveData.weatherOverride);
    (this.el.querySelector('#pause-auto-gfx') as HTMLInputElement).checked = autoGfx;
    this.el.querySelector('#pause-stats')!.textContent =
      `₹${saveData.cash.toLocaleString('en-IN')} • ${saveData.completedMissions.length}/4 Done • ${saveData.gigsCompleted} Gigs`;

    const list = this.el.querySelector('#pause-missions-list')!;
    list.innerHTML = '';
    for (const m of STORY_AND_SIDE_MISSIONS) {
      const done = saveData.completedMissions.includes(m.id);
      const badgeColor = m.category === 'story' ? 'text-amber-300' : 'text-purple-300';
      const card = document.createElement('div');
      card.className = 'rounded-xl bg-white/5 border border-white/10 p-2.5 flex items-start justify-between gap-2';
      card.innerHTML = `
        <div>
          <div class="text-xs font-bold ${badgeColor}">${m.title} ${done ? '✅' : ''}</div>
          <p class="text-[11px] text-slate-300 leading-snug mt-0.5">${m.brief}</p>
        </div>
        <button class="shrink-0 px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-amber-500 hover:text-slate-950 text-white text-[11px] font-bold cursor-pointer">
          ${done ? 'Replay' : 'Play'}
        </button>
      `;
      card.querySelector('button')!.addEventListener('click', () => {
        this.toggle(false);
        this.cb.onStartMission(m.id);
      });
      list.appendChild(card);
    }
  }
}
