import * as THREE from 'three';
import type { GraphicsQuality } from '../types/game';

export class GraphicsManager {
  public readonly renderer: THREE.WebGLRenderer;
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public sunLight: THREE.DirectionalLight;
  public hemiLight: THREE.HemisphereLight;
  public quality: GraphicsQuality = 'high';
  public autoQuality = false;

  private fpsSampleTime = 0;
  private fpsFrames = 0;
  public currentFps = 60;

  constructor(canvas: HTMLCanvasElement, initialQuality: GraphicsQuality = 'high') {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true, // Enables crisp PNG snapshots on Photo Mode (O)
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8ec5ea);
    this.scene.fog = new THREE.FogExp2(0x9dcbe6, 0.0024);

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.25, 650);

    this.hemiLight = new THREE.HemisphereLight(0xdff1ff, 0x56594e, 0.95);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 2.1);
    this.sunLight.position.set(85, 115, 55);
    this.sunLight.castShadow = true;
    // Capped at 1024x1024 per performance target
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 15;
    this.sunLight.shadow.camera.far = 320;
    const d = 115;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0007;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.setQuality(initialQuality);
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
  }

  setQuality(q: GraphicsQuality): void {
    this.quality = q;
    const dpr = window.devicePixelRatio || 1;
    if (q === 'low') {
      this.renderer.setPixelRatio(Math.min(dpr, 1.0));
      this.renderer.shadowMap.enabled = false;
      this.sunLight.castShadow = false;
      this.camera.far = 380;
    } else if (q === 'medium') {
      this.renderer.setPixelRatio(Math.min(dpr, 1.25));
      this.renderer.shadowMap.enabled = true;
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(512, 512);
      this.sunLight.shadow.map?.dispose();
      this.sunLight.shadow.map = null;
      this.camera.far = 520;
    } else {
      this.renderer.setPixelRatio(Math.min(dpr, 1.75));
      this.renderer.shadowMap.enabled = true;
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(1024, 1024);
      this.sunLight.shadow.map?.dispose();
      this.sunLight.shadow.map = null;
      this.camera.far = 650;
    }
    this.camera.updateProjectionMatrix();
  }

  handleResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  updateShadowFollow(targetX: number, targetZ: number): void {
    if (!this.sunLight.castShadow) return;
    // Snap shadow camera center in texel-ish increments to avoid shimmer
    const snap = 4;
    const sx = Math.round(targetX / snap) * snap;
    const sz = Math.round(targetZ / snap) * snap;
    this.sunLight.target.position.set(sx, 0, sz);
    this.sunLight.position.set(sx + 80, 115, sz + 52);
  }

  trackFrame(dt: number): void {
    this.fpsSampleTime += dt;
    this.fpsFrames++;
    if (this.fpsSampleTime >= 1.5) {
      this.currentFps = Math.round(this.fpsFrames / this.fpsSampleTime);
      if (this.autoQuality) {
        if (this.currentFps < 38 && this.quality === 'high') {
          this.setQuality('medium');
        } else if (this.currentFps < 30 && this.quality === 'medium') {
          this.setQuality('low');
        }
      }
      this.fpsSampleTime = 0;
      this.fpsFrames = 0;
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
