import type { VehicleKind } from '../types/game';

/**
 * Canonical XZ coordinates (meters, +X East, +Z South) anchored to real OSM data
 * around RVITM (12.8729154, 77.5757331).
 */
export const CAMPUS_CENTER = { lat: 12.8729154, lon: 77.5757331 };

export const ACADEMIC_BLOCK = {
  center: { x: -2.7, z: 11.6 },
  width: 28,
  length: 92,
  floors: 7,
  floorHeight: 3.7,
  rotationY: -0.21, // Matches ~12 deg tilt along 80 Feet Road
  porchWorld: { x: 18.2, z: -13.5 },
  entranceTarget: { x: 19.5, z: -13.2 },
};

export const MAIN_GATE = {
  entryCenter: { x: 54.8, z: -14.5 },
  exitCenter: { x: 56.2, z: -26.2 },
  boardCenter: { x: 55.5, z: -20.4 },
  rotationY: -0.14,
  securityCabin: { x: 53.0, z: -20.5 },
};

export const LANDMARKS = {
  courtyard: { x: 27.5, z: 10.0, label: 'Central Quadrangle' },
  canteen: { x: 29.0, z: 33.5, label: 'RVITM Canteen & Cafeteria' },
  parking: { x: 40.5, z: 4.0, label: 'Student Two-Wheeler Parking' },
  basketballCourt: { x: 26.0, z: 54.0, label: 'Basketball Court' },
  cricketTurf: { x: 20.5, z: 71.0, label: 'Cricket Practice Turf' },
  chaiStall: { x: 82.0, z: -23.0, label: 'Goli Chai & Bun Tapri' },
  xeroxShop: { x: 81.5, z: -5.5, label: 'Benglooru Xerox & Records' },
  cafeShop: { x: 80.5, z: 13.5, label: 'Filter Kaapi & Toast Cafe' },
  bmtcStop: { x: 75.5, z: -52.0, label: '80 Ft Rd Bus Stop' },
  brookesHavenCorner: { x: 35.0, z: 146.0, label: 'Brookes Haven Main Rd' },
  chaithanyaWest: { x: -75.0, z: 12.0, label: 'Chaithanya Layout West' },
};

export const PLAYER_SPAWN = {
  x: 72.5,
  y: 1.2,
  z: -17.5,
  yaw: Math.PI * 0.52, // Facing West across 80 Feet Road straight at RVITM Gate & 7-floor block
};

export const VEHICLE_SPAWNS: Array<{
  id: string;
  kind: VehicleKind;
  x: number;
  z: number;
  yaw: number;
}> = [
  { id: 'veh-scooter-1', kind: 'scooter', x: 42.5, z: -2.0, yaw: -1.75 },
  { id: 'veh-scooter-2', kind: 'scooter', x: 74.5, z: -8.0, yaw: 0.1 },
  { id: 'veh-bike-1', kind: 'bike', x: 41.0, z: 12.0, yaw: -1.75 },
  { id: 'veh-auto-1', kind: 'auto', x: 73.5, z: -31.0, yaw: Math.PI - 0.12 },
  { id: 'veh-bus-1', kind: 'bus', x: 72.8, z: -58.0, yaw: Math.PI - 0.12 },
  { id: 'veh-tanker-1', kind: 'tanker', x: 54.0, z: 62.0, yaw: -0.14 },
];

export const INTERACTABLES = [
  {
    id: 'buy-chai',
    label: 'Buy Cutting Chai & Bun (₹20)',
    x: 79.5,
    z: -23.0,
    radius: 3.5,
    type: 'chai' as const,
  },
  {
    id: 'buy-samosa',
    label: 'Grab Canteen Masala Dosa / Samosa (₹35)',
    x: 29.0,
    z: 30.0,
    radius: 4.0,
    type: 'canteen' as const,
  },
  {
    id: 'xerox-counter',
    label: 'Print Lab Record (₹30)',
    x: 79.0,
    z: -5.5,
    radius: 3.5,
    type: 'xerox' as const,
  },
];

// Outer loop for AI traffic along 80 Feet Road & Brookes Haven / Amruth Nagar perimeter
export const AI_TRAFFIC_LOOP_EAST: [number, number][] = [
  [65.5, -165.0],
  [60.0, -75.0],
  [54.5, 0.0],
  [44.5, 85.0],
  [36.5, 165.0],
  [44.0, 165.0],
  [52.5, 85.0],
  [62.5, 0.0],
  [68.5, -75.0],
  [73.5, -165.0],
];

export const AI_TRAFFIC_LOOP_CROSS: [number, number][] = [
  [38.0, 145.0],
  [-15.8, 147.4],
  [-113.5, 152.5],
  [-180.0, 155.0],
  [-180.0, 162.0],
  [-113.5, 160.0],
  [-15.8, 156.0],
  [39.0, 154.0],
];

export const CAMPUS_WALKER_PATHS: [number, number][][] = [
  [
    [22.0, -14.0],
    [25.0, 12.0],
    [28.0, 28.0],
    [20.0, 42.0],
    [16.0, 15.0],
  ],
  [
    [48.0, -15.0],
    [32.0, -16.0],
    [21.0, -12.0],
    [35.0, 2.0],
    [46.0, -6.0],
  ],
  [
    [76.0, -35.0],
    [77.5, -18.0],
    [78.5, 2.0],
    [77.0, 22.0],
    [75.5, -8.0],
  ],
];
