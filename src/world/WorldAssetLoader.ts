/**
 * WorldAssetLoader.ts
 *
 * Loads the generated world manifest and individual chunk GLBs with
 * in-flight request deduplication and recoverable error handling.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ChunkBounds } from './WorldCoordinateSystem';
import { createAsphaltTexture, createMicroNoiseBumpTexture } from './Textures';

let sharedRoadTex: THREE.CanvasTexture | null = null;
let sharedBumpTex: THREE.CanvasTexture | null = null;

export interface WorldManifestChunk {
  file: string;
  chunkKey: string;
  cx: number;
  cz: number;
  cellBounds: ChunkBounds;
  bbox: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  triangles: number;
}

export interface WorldManifest {
  generatedAt: string;
  chunkSize: number;
  chunks: WorldManifestChunk[];
}

export class WorldAssetLoader {
  private loader = new GLTFLoader();
  private inFlight = new Map<string, Promise<THREE.Group>>();
  private baseUrl: string;

  constructor(baseUrl = '/world/generated') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async loadManifest(): Promise<WorldManifest> {
    const url = `${this.baseUrl}/manifest.json`;
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) {
      throw new Error(`Failed to fetch world manifest (${res.status} ${res.statusText})`);
    }
    const data = (await res.json()) as WorldManifest;
    if (!data || !Array.isArray(data.chunks)) {
      throw new Error('Invalid world manifest format: missing chunks array');
    }
    return data;
  }

  loadChunk(chunk: WorldManifestChunk): Promise<THREE.Group> {
    const existing = this.inFlight.get(chunk.chunkKey);
    if (existing) return existing;

    const url = `${this.baseUrl}/${chunk.file}`;
    const promise = new Promise<THREE.Group>((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          const group = gltf.scene || new THREE.Group();
          group.name = `world_chunk_${chunk.chunkKey}`;
          group.traverse((obj) => {
            if ((obj as THREE.Mesh).isMesh) {
              const mesh = obj as THREE.Mesh;
              mesh.receiveShadow = true;
              if (!sharedRoadTex) sharedRoadTex = createAsphaltTexture();
              if (!sharedBumpTex) sharedBumpTex = createMicroNoiseBumpTexture(12, 12);

              const mat = mesh.material as THREE.MeshStandardMaterial;
              if (mesh.name.startsWith('buildings')) {
                mesh.castShadow = true;
                if (mat && mat.isMeshStandardMaterial) {
                  mat.bumpMap = sharedBumpTex;
                  mat.bumpScale = 0.04;
                  mat.roughness = 0.85;
                  mat.needsUpdate = true;
                }
              } else if (mesh.name.startsWith('roads') && !mesh.name.includes('kerbs')) {
                if (mat && mat.isMeshStandardMaterial) {
                  mat.map = sharedRoadTex;
                  mat.bumpMap = sharedBumpTex;
                  mat.bumpScale = 0.03;
                  mat.roughness = 0.88;
                  mat.needsUpdate = true;
                }
              }
            }
          });
          this.inFlight.delete(chunk.chunkKey);
          resolve(group);
        },
        undefined,
        (err) => {
          this.inFlight.delete(chunk.chunkKey);
          const msg = err instanceof Error ? err.message : String(err);
          reject(new Error(`Failed to load ${chunk.file}: ${msg}`));
        }
      );
    });

    this.inFlight.set(chunk.chunkKey, promise);
    return promise;
  }
}
