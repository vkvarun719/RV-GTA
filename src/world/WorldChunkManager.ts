/**
 * WorldChunkManager.ts
 *
 * Streams 500 m × 500 m world chunks in and out based on player position,
 * preventing duplicate loads and disposing unloaded GPU/physics resources.
 */

import * as THREE from 'three';
import {
  CHUNK_SIZE_M,
  distanceToChunkBounds,
} from './WorldCoordinateSystem';
import type {
  WorldAssetLoader,
  WorldManifest,
  WorldManifestChunk,
} from './WorldAssetLoader';
import type { WorldCollisionManager } from './WorldCollisionManager';

export interface WorldChunkManagerOptions {
  loadRadiusM?: number;
  unloadRadiusM?: number;
  maxConcurrentLoads?: number;
  onError?: (message: string) => void;
}

interface LoadedChunk {
  entry: WorldManifestChunk;
  group: THREE.Group;
  colliderTris: number;
}

export class WorldChunkManager {
  private parentGroup: THREE.Group;
  private loader: WorldAssetLoader;
  private collision: WorldCollisionManager;
  private manifest: WorldManifest | null = null;

  private loaded = new Map<string, LoadedChunk>();
  private loading = new Set<string>();
  private failed = new Map<string, string>();

  public loadRadiusM: number;
  public unloadRadiusM: number;
  private maxConcurrentLoads: number;
  private onError?: (message: string) => void;

  constructor(
    parentGroup: THREE.Group,
    loader: WorldAssetLoader,
    collision: WorldCollisionManager,
    options: WorldChunkManagerOptions = {}
  ) {
    this.parentGroup = parentGroup;
    this.loader = loader;
    this.collision = collision;
    this.loadRadiusM = options.loadRadiusM ?? 900;
    this.unloadRadiusM = options.unloadRadiusM ?? 1300;
    this.maxConcurrentLoads = options.maxConcurrentLoads ?? 3;
    this.onError = options.onError;
  }

  setManifest(manifest: WorldManifest): void {
    this.manifest = manifest;
  }

  update(playerX: number, playerZ: number): void {
    if (!this.manifest) return;
    const chunkSize = this.manifest.chunkSize || CHUNK_SIZE_M;

    // 1. Unload distant chunks
    for (const [key, item] of this.loaded) {
      const dist = distanceToChunkBounds(
        item.entry.cx,
        item.entry.cz,
        playerX,
        playerZ,
        chunkSize
      );
      if (dist > this.unloadRadiusM) {
        this.unloadChunk(key);
      }
    }

    // 2. Find chunks within load radius, sorted closest first
    const candidates: Array<{ chunk: WorldManifestChunk; dist: number }> = [];
    for (const chunk of this.manifest.chunks) {
      if (
        this.loaded.has(chunk.chunkKey) ||
        this.loading.has(chunk.chunkKey) ||
        this.failed.has(chunk.chunkKey)
      ) {
        continue;
      }
      const dist = distanceToChunkBounds(
        chunk.cx,
        chunk.cz,
        playerX,
        playerZ,
        chunkSize
      );
      if (dist <= this.loadRadiusM) {
        candidates.push({ chunk, dist });
      }
    }

    if (candidates.length === 0) return;
    candidates.sort((a, b) => a.dist - b.dist);

    // 3. Dispatch async loads without exceeding concurrency cap
    for (const { chunk } of candidates) {
      if (this.loading.size >= this.maxConcurrentLoads) break;
      this.startLoad(chunk);
    }
  }

  private startLoad(chunk: WorldManifestChunk): void {
    if (this.loaded.has(chunk.chunkKey) || this.loading.has(chunk.chunkKey)) return;
    this.loading.add(chunk.chunkKey);

    this.loader
      .loadChunk(chunk)
      .then((group) => {
        this.loading.delete(chunk.chunkKey);
        if (this.loaded.has(chunk.chunkKey)) return;

        this.parentGroup.add(group);
        const colliderTris = this.collision.registerChunk(chunk.chunkKey, group);
        this.loaded.set(chunk.chunkKey, { entry: chunk, group, colliderTris });
      })
      .catch((err) => {
        this.loading.delete(chunk.chunkKey);
        const msg = err instanceof Error ? err.message : String(err);
        this.failed.set(chunk.chunkKey, msg);
        this.onError?.(msg);
      });
  }

  private unloadChunk(key: string): void {
    const item = this.loaded.get(key);
    if (!item) return;

    this.collision.removeChunk(key);
    this.parentGroup.remove(item.group);

    item.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else {
          m.material?.dispose();
        }
      }
    });

    this.loaded.delete(key);
  }

  retryFailed(): void {
    this.failed.clear();
  }

  getLoadedKeys(): string[] {
    return [...this.loaded.keys()];
  }

  getLoadingKeys(): string[] {
    return [...this.loading.keys()];
  }

  getFailedCount(): number {
    return this.failed.size;
  }

  dispose(): void {
    for (const key of [...this.loaded.keys()]) {
      this.unloadChunk(key);
    }
    this.loading.clear();
    this.failed.clear();
  }
}
