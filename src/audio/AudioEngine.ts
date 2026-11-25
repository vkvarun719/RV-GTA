import type { VehicleKind } from '../types/game';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  private rainSource: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;

  public radioEnabled = false;
  private radioTimer: number | null = null;
  private radioStep = 0;

  private unlocked = false;

  constructor() {
    const unlock = () => {
      if (this.unlocked) return;
      this.unlocked = true;
      this.initContext();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  private initContext(): void {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.45;
    this.masterGain.connect(this.ctx.destination);

    // Engine oscillator chain
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 48;

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 180;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;

    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);
    this.engineOsc.start();

    // Rain noise chain
    const sampleRate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, sampleRate * 2, sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2 + white * 0.06) * 0.35;
    }
    this.rainSource = this.ctx.createBufferSource();
    this.rainSource.buffer = buffer;
    this.rainSource.loop = true;

    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 1100;
    rainFilter.Q.value = 0.7;

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0;

    this.rainSource.connect(rainFilter);
    rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);
    this.rainSource.start();
  }

  private ensureRunning(): boolean {
    if (!this.ctx) this.initContext();
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return true;
  }

  updateEngine(activeKind: VehicleKind | null, speedKmh: number): void {
    if (!this.ctx || !this.engineOsc || !this.engineGain || !this.engineFilter) return;
    const now = this.ctx.currentTime;
    if (!activeKind) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    const baseFreq: Record<VehicleKind, number> = {
      scooter: 68,
      bike: 58,
      auto: 52,
      bus: 36,
      tanker: 32,
    };
    const freq = baseFreq[activeKind] + Math.min(115, speedKmh * 1.45);
    this.engineOsc.type = activeKind === 'scooter' ? 'triangle' : 'sawtooth';
    this.engineOsc.frequency.setTargetAtTime(freq, now, 0.06);
    this.engineFilter.frequency.setTargetAtTime(160 + speedKmh * 6, now, 0.08);
    this.engineGain.gain.setTargetAtTime(0.06 + Math.min(0.11, speedKmh * 0.002), now, 0.08);
  }

  setRainIntensity(isRaining: boolean): void {
    if (!this.ctx || !this.rainGain) return;
    this.rainGain.gain.setTargetAtTime(isRaining ? 0.24 : 0, this.ctx.currentTime, 0.5);
  }

  playHorn(kind: VehicleKind): void {
    if (!this.ensureRunning() || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    if (kind === 'scooter' || kind === 'bike') {
      const f = kind === 'scooter' ? 540 : 460;
      this.toneBurst(f, 'square', now, 0.14, 0.14);
      this.toneBurst(f * 1.05, 'square', now + 0.17, 0.16, 0.14);
    } else if (kind === 'auto') {
      // Classic Bengaluru double-beep auto horn
      this.toneBurst(410, 'sawtooth', now, 0.11, 0.16);
      this.toneBurst(615, 'triangle', now, 0.11, 0.11);
      this.toneBurst(410, 'sawtooth', now + 0.14, 0.18, 0.16);
      this.toneBurst(615, 'triangle', now + 0.14, 0.18, 0.11);
    } else {
      // BMTC Bus / Water Tanker heavy dual air-horn
      const base = kind === 'bus' ? 195 : 155;
      this.toneBurst(base, 'sawtooth', now, 0.42, 0.22);
      this.toneBurst(base * 1.25, 'sawtooth', now, 0.42, 0.18);
    }
  }

  playFootstep(): void {
    if (!this.ctx || !this.masterGain) return;
    this.toneBurst(95 + Math.random() * 25, 'triangle', this.ctx.currentTime, 0.045, 0.05);
  }

  playChime(success = true): void {
    if (!this.ensureRunning() || !this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = success ? [523.25, 659.25, 783.99, 1046.5] : [330, 261.6];
    notes.forEach((n, idx) => {
      this.toneBurst(n, 'sine', now + idx * 0.09, 0.18, 0.15);
    });
  }

  toggleRadio(enabled?: boolean): boolean {
    this.radioEnabled = enabled !== undefined ? enabled : !this.radioEnabled;
    if (this.radioEnabled) {
      this.ensureRunning();
      if (this.radioTimer === null) {
        this.playRadioBar();
        this.radioTimer = window.setInterval(() => this.playRadioBar(), 1600);
      }
    } else if (this.radioTimer !== null) {
      window.clearInterval(this.radioTimer);
      this.radioTimer = null;
    }
    return this.radioEnabled;
  }

  private playRadioBar(): void {
    if (!this.ctx || !this.masterGain || !this.radioEnabled) return;
    // Warm Bengaluru Lo-Fi pentatonic chord progression
    const chords = [
      [261.63, 329.63, 392.0, 493.88],
      [220.0, 261.63, 329.63, 392.0],
      [174.61, 220.0, 261.63, 349.23],
      [196.0, 246.94, 293.66, 392.0],
    ];
    const chord = chords[this.radioStep % chords.length];
    this.radioStep++;
    const now = this.ctx.currentTime;
    chord.forEach((freq, i) => {
      this.toneBurst(freq, 'sine', now + i * 0.06, 1.35, 0.038);
    });
    // Soft kick/hat pulse
    this.toneBurst(72, 'sine', now, 0.14, 0.07);
    this.toneBurst(72, 'sine', now + 0.8, 0.12, 0.06);
  }

  private toneBurst(
    freq: number,
    type: OscillatorType,
    startTime: number,
    duration: number,
    volume: number
  ): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }
}
