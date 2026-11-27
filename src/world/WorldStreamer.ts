/**
 * WorldStreamer.ts
 *
 * Top-level world streaming coordinator for NAMMA RVITM.
 * Manages the single terrain ground plane and streams generated 500 m × 500 m
 * OSM world chunks around the active player/vehicle position.
 */

import * as THREE from 'three';
import type { PhysicsWorld } from '../systems/PhysicsWorld';
import { WorldAssetLoader } from './WorldAssetLoader';
import { WorldChunkManager } from './WorldChunkManager';
import { WorldCollisionManager } from './WorldCollisionManager';

export interface WorldStreamerOptions {
  baseUrl?: string;
  loadRadiusM?: number;
  unloadRadiusM?: number;
  onError?: (message: string) => void;
}

export interface WorldStreamerStats {
  ready: boolean;
  totalManifestChunks: number;
  loadedChunks: number;
  loadingChunks: number;
  failedChunks: number;
  loadedKeys: string[];
  lastError: string | null;
}

export class WorldStreamer {
  public readonly group = new THREE.Group();
  public readonly groundMaterial: THREE.MeshStandardMaterial;

  private loader: WorldAssetLoader;
  private collision: WorldCollisionManager;
  private chunkManager: WorldChunkManager;

  private ready = false;
  private totalManifestChunks = 0;
  private lastError: string | null = null;
  private onError?: (message: string) => void;

  constructor(
    scene: THREE.Scene,
    physics: PhysicsWorld,
    options: WorldStreamerOptions = {}
  ) {
    this.group.name = 'streamed_world_root';
    this.onError = options.onError;

    // Single continuous terrain plane (never duplicated inside chunk GLBs)
    this.groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x5c7c48,
      roughness: 0.96,
      metalness: 0.02,
    });
    const terrain = new THREE.Mesh(
      new THREE.PlaneGeometry(4000, 4000),
      this.groundMaterial
    );
    terrain.name = 'world_terrain_ground';
    terrain.rotation.x = -Math.PI / 2;
    terrain.receiveShadow = true;
    this.group.add(terrain);

    scene.add(this.group);

    this.loader = new WorldAssetLoader(options.baseUrl ?? '/world/generated');
    this.collision = new WorldCollisionManager(physics);
    this.chunkManager = new WorldChunkManager(this.group, this.loader, this.collision, {
      loadRadiusM: options.loadRadiusM ?? 900,
      unloadRadiusM: options.unloadRadiusM ?? 1300,
      onError: (msg) => {
        this.lastError = msg;
        this.onError?.(msg);
      },
    });
  }

  async init(initialX = 0, initialZ = 0): Promise<void> {
    try {
      const manifest = await this.loader.loadManifest();
      this.totalManifestChunks = manifest.chunks.length;
      this.chunkManager.setManifest(manifest);
      this.ready = true;
      this.lastError = null;
      this.chunkManager.update(initialX, initialZ);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.lastError = msg;
      this.ready = false;
      this.onError?.(`World stream unavailable: ${msg}`);
    }
  }

  update(playerX: number, playerZ: number): void {
    if (!this.ready) return;
    this.chunkManager.update(playerX, playerZ);
  }

  setRadii(loadRadiusM: number, unloadRadiusM: number): void {
    this.chunkManager.loadRadiusM = loadRadiusM;
    this.chunkManager.unloadRadiusM = Math.max(unloadRadiusM, loadRadiusM + 100);
  }

  getStats(): WorldStreamerStats {
    const loadedKeys = this.chunkManager.getLoadedKeys();
    const loadingKeys = this.chunkManager.getLoadingKeys();
    return {
      ready: this.ready,
      totalManifestChunks: this.totalManifestChunks,
      loadedChunks: loadedKeys.length,
      loadingChunks: loadingKeys.length,
      failedChunks: this.chunkManager.getFailedCount(),
      loadedKeys,
      lastError: this.lastError,
    };
  }

  dispose(): void {
    this.chunkManager.dispose();
    this.collision.dispose();
    this.groundMaterial.dispose();
  }
}
