import type { GigTemplate } from '../missions/MissionData';
import type { WeatherState } from '../types/game';
import type { CheatHandler } from './CheatTerminal';

export interface PhoneCallbacks {
  onAcceptGig: (tpl: GigTemplate) => void;
  onOpenFullMap: () => void;
  onToggleRadio: () => boolean;
  onCheat: CheatHandler;
  onOpenChange?: (open: boolean) => void;
}

export class PhoneOverlay {
  public isOpen = false;
  private el: HTMLElement;
  private tabContentEl: HTMLElement;
  private activeTab: 'gigs' | 'inside' | 'map' | 'dialer' = 'gigs';
  private cb: PhoneCallbacks;
  private gigs: GigTemplate[];
  private latestWeather!: WeatherState;
  private radioOn = false;

  constructor(uiRoot: HTMLElement, gigs: GigTemplate[], cb: PhoneCallbacks) {
    this.gigs = gigs;
    this.cb = cb;

    this.el = document.createElement('div');
    this.el.className =
      'hidden pointer-events-auto absolute bottom-8 right-8 w-80 rounded-[32px] bg-slate-950 border-[5px] border-slate-800 shadow-2xl overflow-hidden z-30 flex flex-col';
    this.el.style.height = '510px';
    this.el.innerHTML = `
      <!-- Phone Top Notch & Status -->
      <div class="bg-slate-900 px-5 pt-3 pb-2 border-b border-white/10">
        <div class="w-16 h-1.5 bg-slate-700 rounded-full mx-auto mb-2"></div>
        <div class="flex items-center justify-between text-[11px] text-slate-300">
          <span class="font-bold text-amber-400">NammaOS 5G</span>
          <span id="phone-time" class="font-mono">09:00 AM</span>
          <span class="text-emerald-400 font-bold">94%</span>
        </div>
      </div>

      <!-- Radio Mini Bar -->
      <div class="bg-slate-900/70 px-4 py-2 border-b border-white/10 flex items-center justify-between">
        <div class="text-xs">
          <div class="font-bold text-white">📻 Namma Campus Radio</div>
          <div id="phone-radio-status" class="text-[10px] text-slate-400">Off • Tap to chill</div>
        </div>
        <button id="phone-radio-btn" class="px-2.5 py-1 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold cursor-pointer">
          Toggle
        </button>
      </div>

      <!-- Dynamic Body -->
      <div id="phone-body" class="flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-gradient-to-b from-slate-950 to-slate-900"></div>

      <!-- Bottom Tabs -->
      <div class="bg-slate-900 border-t border-white/10 grid grid-cols-4 text-[11px] font-semibold">
        <button data-tab="gigs" class="py-2.5 text-amber-400 border-t-2 border-amber-400 cursor-pointer">Gigs</button>
        <button data-tab="inside" class="py-2.5 text-slate-400 hover:text-white cursor-pointer">Inside</button>
        <button data-tab="map" class="py-2.5 text-slate-400 hover:text-white cursor-pointer">Map</button>
        <button data-tab="dialer" class="py-2.5 text-slate-400 hover:text-white cursor-pointer">Cheats</button>
      </div>
    `;
    uiRoot.appendChild(this.el);

    this.tabContentEl = this.el.querySelector('#phone-body')!;

    this.el.querySelector('#phone-radio-btn')!.addEventListener('click', () => {
      this.radioOn = this.cb.onToggleRadio();
      this.updateRadioLabel();
    });

    this.el.querySelectorAll('button[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = btn.getAttribute('data-tab') as 'gigs' | 'inside' | 'map' | 'dialer';
        this.activeTab = t;
        this.el.querySelectorAll('button[data-tab]').forEach((b) => {
          const active = b.getAttribute('data-tab') === t;
          b.className = active
            ? 'py-2.5 text-amber-400 border-t-2 border-amber-400 cursor-pointer'
            : 'py-2.5 text-slate-400 hover:text-white cursor-pointer';
        });
        this.renderTab();
      });
    });
  }

  private updateRadioLabel(): void {
    const lbl = this.el.querySelector('#phone-radio-status');
    if (lbl) lbl.textContent = this.radioOn ? 'Playing Bengaluru Lo-Fi' : 'Off • Tap to chill';
  }

  toggle(weather: WeatherState, radioOn: boolean, force?: boolean): boolean {
    this.latestWeather = weather;
    this.radioOn = radioOn;
    this.isOpen = force !== undefined ? force : !this.isOpen;
    this.el.classList.toggle('hidden', !this.isOpen);
    this.cb.onOpenChange?.(this.isOpen);
    if (this.isOpen) {
      const timeEl = this.el.querySelector('#phone-time');
      if (timeEl) {
        timeEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      this.updateRadioLabel();
      this.renderTab();
    }
    return this.isOpen;
  }

  private renderTab(): void {
    if (this.activeTab === 'gigs') {
      const raining = this.latestWeather?.isRaining ?? false;
      this.tabContentEl.innerHTML = `
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-300">Campus Side Gigs</span>
          ${raining ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/25 text-sky-300">+25% RAIN BONUS</span>' : ''}
        </div>
      `;

      this.gigs.forEach((g) => {
        const pay = raining ? Math.round(g.rewardCash * 1.25) : g.rewardCash;
        const card = document.createElement('div');
        card.className = 'rounded-xl bg-white/5 border border-white/10 p-2.5 space-y-1.5';
        card.innerHTML = `
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-bold text-white">${g.title}</span>
            <span class="text-xs font-black text-emerald-400">₹${pay}</span>
          </div>
          <p class="text-[11px] text-slate-300 leading-snug">${g.brief}</p>
          <button class="w-full py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer">
            Accept Gig
          </button>
        `;
        card.querySelector('button')!.addEventListener('click', () => {
          this.cb.onAcceptGig(g);
          this.toggle(this.latestWeather, this.radioOn, false);
        });
        this.tabContentEl.appendChild(card);
      });
    } else if (this.activeTab === 'inside') {
      const photos = [
        { src: '/refs/campus-DSC6716.jpg', title: 'RVITM Auditorium', desc: 'Chevron acoustic walls & stage truss lighting' },
        { src: '/refs/campus-DSC6776.jpg', title: 'CSE / ISE Computer Lab', desc: 'Workstations, smart desks & vision/mission boards' },
        { src: '/refs/campus-DSC6936.jpg', title: 'ICT Smart Classroom', desc: 'Interactive display, green chalkboard & stepped seating' },
        { src: '/refs/campus-DSC7061.jpg', title: 'Library & Info Centre', desc: 'Signature orange racks & engineering reference collection' },
        { src: '/refs/campus-overview.jpg', title: 'Campus Cafeteria Hall', desc: 'Granite floor, stainless dining tables & grid ceiling' },
        { src: '/refs/campus-DSC7079.jpg', title: 'Student Brick Lounge', desc: 'Exposed terracotta brick walls & colorful hangout tables' },
      ];
      this.tabContentEl.innerHTML = `
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-bold uppercase tracking-wider text-amber-300">Inside RVITM Gallery</span>
          <img src="/refs/rvitm-logo.png" alt="RV Crest" class="w-5 h-5 rounded-full bg-white p-0.5" />
        </div>
      `;
      for (const p of photos) {
        const card = document.createElement('div');
        card.className = 'rounded-xl overflow-hidden bg-white/5 border border-white/10';
        card.innerHTML = `
          <img src="${p.src}" alt="${p.title}" class="w-full h-28 object-cover" />
          <div class="p-2">
            <div class="text-xs font-bold text-white">${p.title}</div>
            <div class="text-[10px] text-slate-300">${p.desc}</div>
          </div>
        `;
        this.tabContentEl.appendChild(card);
      }
    } else if (this.activeTab === 'map') {
      this.tabContentEl.innerHTML = `
        <div class="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2 text-xs">
          <div class="font-bold text-amber-300">RVITM Campus Directory</div>
          <div class="text-slate-300 space-y-1 text-[11px]">
            <div>🏫 <b>7-Floor Academic Block</b> — Center West</div>
            <div>🚧 <b>Main Gate & Boom</b> — 80 Feet Road East</div>
            <div>🍛 <b>Canteen & Turf</b> — South Courtyard</div>
            <div>🛵 <b>Student Parking</b> — Inside Gate South</div>
            <div>☕ <b>Goli Chai & Xerox</b> — Opposite Gate</div>
          </div>
          <button id="phone-open-map" class="w-full mt-2 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs cursor-pointer">
            Open Full JP Nagar Map [M]
          </button>
        </div>
      `;
      this.tabContentEl.querySelector('#phone-open-map')!.addEventListener('click', () => {
        this.toggle(this.latestWeather, this.radioOn, false);
        this.cb.onOpenFullMap();
      });
    } else {
      this.tabContentEl.innerHTML = `
        <div class="space-y-2.5">
          <div class="text-xs font-bold text-slate-200">Dial Kannada Cheat Code</div>
          <div class="flex gap-1.5">
            <input id="phone-cheat-input" type="text" placeholder="Enter code..."
              class="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white uppercase focus:outline-none focus:border-amber-400" />
            <button id="phone-dial-btn" class="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer">
              Dial
            </button>
          </div>
          <div id="phone-dial-msg" class="text-[11px] text-emerald-300 min-h-[16px]"></div>
          <div class="text-[10px] uppercase tracking-wider text-slate-400 pt-1">Quick Speed-Dial</div>
          <div class="grid grid-cols-2 gap-1.5">
            ${['AUTOWALA', 'BULLET', 'TANKER', 'MALEBANTHU', 'MACHA', 'KASU']
              .map(
                (code) =>
                  `<button data-code="${code}" class="py-1.5 px-2 rounded-lg bg-white/8 hover:bg-white/15 text-[11px] font-mono font-bold text-amber-200 cursor-pointer">${code}</button>`
              )
              .join('')}
          </div>
        </div>
      `;

      const input = this.tabContentEl.querySelector('#phone-cheat-input') as HTMLInputElement;
      const msg = this.tabContentEl.querySelector('#phone-dial-msg')!;
      const runCode = (c: string) => {
        const res = this.cb.onCheat(c);
        msg.textContent = res.message;
        msg.className = res.ok ? 'text-[11px] text-emerald-300' : 'text-[11px] text-rose-400';
      };

      this.tabContentEl.querySelector('#phone-dial-btn')!.addEventListener('click', () => {
        if (input.value.trim()) runCode(input.value.trim());
      });
      this.tabContentEl.querySelectorAll('button[data-code]').forEach((b) => {
        b.addEventListener('click', () => runCode(b.getAttribute('data-code')!));
      });
    }
  }
}
