/**
 * WorldCoordinateSystem.ts
 *
 * Shared geospatial and chunk-grid coordinate utilities anchored at
 * RV Institute of Technology and Management (RVITM), Bengaluru.
 */

export const WORLD_ORIGIN = {
  lat: 12.8729154,
  lon: 77.5757331,
} as const;

export const CHUNK_SIZE_M = 500;

const METERS_PER_LAT = 111132;
const METERS_PER_LON = 111320 * Math.cos((WORLD_ORIGIN.lat * Math.PI) / 180);

export interface ChunkCoord {
  cx: number;
  cz: number;
  key: string;
}

export interface ChunkBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function latLonToXZ(lat: number, lon: number): [number, number] {
  const x = (lon - WORLD_ORIGIN.lon) * METERS_PER_LON;
  const z = (WORLD_ORIGIN.lat - lat) * METERS_PER_LAT;
  return [x, z];
}

export function xzToLatLon(x: number, z: number): { lat: number; lon: number } {
  return {
    lat: WORLD_ORIGIN.lat - z / METERS_PER_LAT,
    lon: WORLD_ORIGIN.lon + x / METERS_PER_LON,
  };
}

export function worldToChunk(x: number, z: number, chunkSize = CHUNK_SIZE_M): ChunkCoord {
  const cx = Math.floor(x / chunkSize);
  const cz = Math.floor(z / chunkSize);
  return { cx, cz, key: `${cx}_${cz}` };
}

export function chunkBounds(cx: number, cz: number, chunkSize = CHUNK_SIZE_M): ChunkBounds {
  return {
    minX: cx * chunkSize,
    maxX: (cx + 1) * chunkSize,
    minZ: cz * chunkSize,
    maxZ: (cz + 1) * chunkSize,
  };
}

/**
 * Shortest 2D Euclidean distance from point (px, pz) to a chunk's AABB.
 * Returns 0 when the point is inside the chunk.
 */
export function distanceToChunkBounds(
  cx: number,
  cz: number,
  px: number,
  pz: number,
  chunkSize = CHUNK_SIZE_M
): number {
  const b = chunkBounds(cx, cz, chunkSize);
  const dx = px < b.minX ? b.minX - px : px > b.maxX ? px - b.maxX : 0;
  const dz = pz < b.minZ ? b.minZ - pz : pz > b.maxZ ? pz - b.maxZ : 0;
  return Math.hypot(dx, dz);
}
