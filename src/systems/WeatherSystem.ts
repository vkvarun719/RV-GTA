import * as THREE from 'three';
import type { GraphicsManager } from './GraphicsManager';
import type { WeatherMode, WeatherState } from '../types/game';

export interface WeatherTargets {
  roadMaterials: THREE.MeshStandardMaterial[];
  pavingMaterials: THREE.MeshStandardMaterial[];
  nightLights: THREE.MeshStandardMaterial[];
}

export class WeatherSystem {
  public state: WeatherState = {
    mode: 'sunny',
    override: 'auto',
    temperatureC: 26,
    weatherCode: 1,
    isRaining: false,
    label: 'Bengaluru Sunny',
    source: 'fallback',
  };

  private liveSnapshot: Omit<WeatherState, 'override'> | null = null;
  private graphics: GraphicsManager;
  private targets: WeatherTargets;

  private rainPoints!: THREE.Points;
  private rainPositions!: Float32Array;
  private readonly rainCount = 1400;

  constructor(graphics: GraphicsManager, targets: WeatherTargets, initialOverride: WeatherMode = 'auto') {
    this.graphics = graphics;
    this.targets = targets;
    this.state.override = initialOverride;

    this.createRainSystem();
    this.applyCurrentMode();
    void this.fetchOpenMeteo();
  }

  private createRainSystem(): void {
    const geo = new THREE.BufferGeometry();
    this.rainPositions = new Float32Array(this.rainCount * 3);
    for (let i = 0; i < this.rainCount; i++) {
      this.rainPositions[i * 3] = (Math.random() - 0.5) * 90;
      this.rainPositions[i * 3 + 1] = Math.random() * 35;
      this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xcbd5e1,
      size: 0.22,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    this.rainPoints = new THREE.Points(geo, mat);
    this.rainPoints.frustumCulled = false;
    this.rainPoints.visible = false;
    this.graphics.scene.add(this.rainPoints);
  }

  async fetchOpenMeteo(): Promise<void> {
    try {
      const url =
        'https://api.open-meteo.com/v1/forecast?latitude=12.8729&longitude=77.5757&current=temperature_2m,weather_code,rain,is_day&timezone=Asia%2FKolkata';
      const res = await fetch(url);
      if (!res.ok) return;
      const json = (await res.json()) as {
        current?: {
          temperature_2m?: number;
          weather_code?: number;
          rain?: number;
          is_day?: number;
        };
      };
      const cur = json.current;
      if (!cur) return;

      const temp = Math.round(cur.temperature_2m ?? 25);
      const code = cur.weather_code ?? 0;
      const rainMm = cur.rain ?? 0;
      const isDay = (cur.is_day ?? 1) === 1;
      const istHour = Number.parseInt(
        new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(new Date()),
        10
      );

      const isRainCode = rainMm > 0 || (code >= 51 && code <= 99);
      let mode: WeatherState['mode'] = 'sunny';
      let label = 'Bengaluru Clear';
      if (isRainCode) {
        mode = 'rain';
        label = 'Bengaluru Rain';
      } else if (!isDay || istHour >= 19 || istHour < 6) {
        mode = 'night';
        label = 'JP Nagar Night';
      } else if (istHour >= 17 || istHour === 6) {
        mode = 'golden';
        label = 'Golden Hour';
      }

      this.liveSnapshot = {
        mode,
        temperatureC: temp,
        weatherCode: code,
        isRaining: isRainCode,
        label,
        source: 'open-meteo',
      };
      this.applyCurrentMode();
    } catch {
      // Offline / blocked: keep local fallback cleanly
    }
  }

  setOverride(override: WeatherMode): void {
    this.state.override = override;
    this.applyCurrentMode();
  }

  private applyCurrentMode(): void {
    const ov = this.state.override;
    if (ov === 'auto') {
      if (this.liveSnapshot) {
        this.state = { ...this.liveSnapshot, override: 'auto' };
      } else {
        const hr = new Date().getHours();
        const mode: WeatherState['mode'] = hr >= 19 || hr < 6 ? 'night' : hr >= 17 || hr === 6 ? 'golden' : 'sunny';
        this.state = {
          mode,
          override: 'auto',
          temperatureC: 26,
          weatherCode: 1,
          isRaining: false,
          label: mode === 'night' ? 'JP Nagar Night' : mode === 'golden' ? 'Golden Hour' : 'Bengaluru Pleasant',
          source: 'fallback',
        };
      }
    } else {
      const labels: Record<Exclude<WeatherMode, 'auto'>, string> = {
        sunny: 'Bengaluru Sunny',
        golden: 'Golden Hour',
        night: 'JP Nagar Night',
        rain: 'Bengaluru Rain',
      };
      this.state = {
        mode: ov,
        override: ov,
        temperatureC: ov === 'rain' ? 21 : ov === 'night' ? 20 : 27,
        weatherCode: ov === 'rain' ? 63 : 1,
        isRaining: ov === 'rain',
        label: labels[ov],
        source: 'manual',
      };
    }

    this.applyAtmosphere();
  }

  private applyAtmosphere(): void {
    const { scene, sunLight, hemiLight } = this.graphics;
    const mode = this.state.mode;

    if (mode === 'sunny') {
      scene.background = new THREE.Color(0x8ec5ea);
      scene.fog = new THREE.FogExp2(0x9dcbe6, 0.0022);
      sunLight.color.setHex(0xfff1d6);
      sunLight.intensity = 2.15;
      hemiLight.color.setHex(0xdff1ff);
      hemiLight.groundColor.setHex(0x56594e);
      hemiLight.intensity = 0.95;
    } else if (mode === 'golden') {
      scene.background = new THREE.Color(0xe69f68);
      scene.fog = new THREE.FogExp2(0xd99262, 0.003);
      sunLight.color.setHex(0xffae52);
      sunLight.intensity = 1.9;
      hemiLight.color.setHex(0xffd2a1);
      hemiLight.groundColor.setHex(0x4a3b32);
      hemiLight.intensity = 0.85;
    } else if (mode === 'night') {
      scene.background = new THREE.Color(0x0b1324);
      scene.fog = new THREE.FogExp2(0x0f1a30, 0.0042);
      sunLight.color.setHex(0x8bb0ff);
      sunLight.intensity = 0.45;
      hemiLight.color.setHex(0x334c7d);
      hemiLight.groundColor.setHex(0x141821);
      hemiLight.intensity = 0.55;
    } else {
      // Rain
      scene.background = new THREE.Color(0x536475);
      scene.fog = new THREE.FogExp2(0x5e6f80, 0.0052);
      sunLight.color.setHex(0xb8c8d8);
      sunLight.intensity = 0.85;
      hemiLight.color.setHex(0x9aaec2);
      hemiLight.groundColor.setHex(0x2d353e);
      hemiLight.intensity = 0.78;
    }

    const lightsBright = mode === 'night' || mode === 'rain';
    for (const mat of this.targets.nightLights) {
      mat.emissiveIntensity = mode === 'night' ? 2.1 : mode === 'rain' ? 1.45 : mode === 'golden' ? 0.9 : 0.25;
    }

    // Wet road sheen during Bengaluru rain!
    const wet = mode === 'rain';
    for (const r of this.targets.roadMaterials) {
      r.roughness = wet ? 0.16 : 0.86;
      r.metalness = wet ? 0.58 : 0.06;
    }
    for (const p of this.targets.pavingMaterials) {
      p.roughness = wet ? 0.28 : 0.86;
      p.metalness = wet ? 0.35 : 0.04;
    }

    this.rainPoints.visible = lightsBright && wet;
  }

  update(dt: number, anchorX: number, anchorZ: number): void {
    if (!this.state.isRaining) {
      this.rainPoints.visible = false;
      return;
    }
    this.rainPoints.visible = true;
    this.rainPoints.position.set(anchorX, 0, anchorZ);

    for (let i = 0; i < this.rainCount; i++) {
      const idx = i * 3;
      this.rainPositions[idx + 1] -= 34 * dt;
      this.rainPositions[idx] -= 3.2 * dt; // Slight Bengaluru monsoon wind slant
      if (this.rainPositions[idx + 1] < 0) {
        this.rainPositions[idx] = (Math.random() - 0.5) * 90;
        this.rainPositions[idx + 1] = 28 + Math.random() * 10;
        this.rainPositions[idx + 2] = (Math.random() - 0.5) * 90;
      }
    }
    this.rainPoints.geometry.attributes.position.needsUpdate = true;
  }
}
