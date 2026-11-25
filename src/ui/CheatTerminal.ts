export type CheatHandler = (code: string) => { ok: boolean; message: string };

export class CheatTerminal {
  public isOpen = false;
  private el: HTMLElement;
  private inputEl: HTMLInputElement;
  private logEl: HTMLElement;
  private handler: CheatHandler;
  public onOpenChange?: (open: boolean) => void;

  constructor(uiRoot: HTMLElement, handler: CheatHandler) {
    this.handler = handler;
    this.el = document.createElement('div');
    this.el.className =
      'hidden pointer-events-auto absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-xl bg-slate-950/92 backdrop-blur-md border-x border-b border-emerald-500/40 rounded-b-2xl shadow-2xl p-4 font-mono z-50';
    this.el.innerHTML = `
      <div class="flex items-center justify-between text-xs text-emerald-400 mb-2">
        <span class="font-bold tracking-wider">NAMMA RVITM CHEAT CONSOLE [~]</span>
        <span class="text-slate-400">Codes: AUTOWALA • BULLET • TANKER • MALEBANTHU • MACHA • KASU</span>
      </div>
      <div id="cheat-log" class="text-xs text-slate-300 space-y-1 max-h-28 overflow-y-auto mb-2 pr-1">
        <div class="text-slate-400">Type a Kannada cheat code and hit Enter...</div>
      </div>
      <form id="cheat-form" class="flex gap-2">
        <span class="text-emerald-400 font-bold self-center">&gt;</span>
        <input id="cheat-input" type="text" autocomplete="off" placeholder="e.g. AUTOWALA or KASU"
          class="flex-1 bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white uppercase tracking-wider focus:outline-none focus:border-emerald-400" />
        <button type="submit" class="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer">
          RUN
        </button>
      </form>
    `;
    uiRoot.appendChild(this.el);

    this.inputEl = this.el.querySelector('#cheat-input')!;
    this.logEl = this.el.querySelector('#cheat-log')!;

    this.el.querySelector('#cheat-form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const raw = this.inputEl.value.trim();
      if (!raw) return;
      const res = this.handler(raw);
      const line = document.createElement('div');
      line.className = res.ok ? 'text-emerald-300' : 'text-rose-400';
      line.textContent = `> ${raw.toUpperCase()} — ${res.message}`;
      this.logEl.appendChild(line);
      this.logEl.scrollTop = this.logEl.scrollHeight;
      this.inputEl.value = '';
    });
  }

  toggle(force?: boolean): boolean {
    this.isOpen = force !== undefined ? force : !this.isOpen;
    this.el.classList.toggle('hidden', !this.isOpen);
    this.onOpenChange?.(this.isOpen);
    if (this.isOpen) {
      setTimeout(() => this.inputEl.focus(), 10);
    } else {
      this.inputEl.blur();
    }
    return this.isOpen;
  }
}
