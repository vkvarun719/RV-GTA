export type GraphicsQuality = 'low' | 'medium' | 'high';

export type WeatherMode = 'auto' | 'sunny' | 'golden' | 'night' | 'rain';

export type VehicleKind = 'scooter' | 'bike' | 'auto' | 'bus' | 'tanker';

export interface RoadPolyline {
  id: number;
  name?: string;
  highway: string;
  access?: string;
  lanes: number;
  width: number;
  points: [number, number][];
}

export interface BuildingFootprint {
  id: number;
  name?: string;
  levels: number;
  points: [number, number][];
}

export interface CampusPoi {
  name: string;
  type: string;
  x: number;
  z: number;
}

export interface OsmDataset {
  meta: {
    source: string;
    endpoint?: string;
    origin: { lat: number; lon: number };
    radiusMeters: number;
    generatedAt: string;
  };
  campusPolygon: [number, number][];
  academicBuilding: [number, number][];
  roads: RoadPolyline[];
  buildings: BuildingFootprint[];
  pois: CampusPoi[];
}

export interface WeatherState {
  mode: Exclude<WeatherMode, 'auto'>;
  override: WeatherMode;
  temperatureC: number;
  weatherCode: number;
  isRaining: boolean;
  label: string;
  source: 'open-meteo' | 'manual' | 'fallback';
}

export interface SaveData {
  version: number;
  cash: number;
  completedMissions: string[];
  gigsCompleted: number;
  chaiBought: number;
  graphicsQuality: GraphicsQuality;
  weatherOverride: WeatherMode;
  radioEnabled: boolean;
  totalDistanceM: number;
}

export interface MissionCheckpoint {
  id: string;
  label: string;
  x: number;
  z: number;
  radius: number;
  requiresVehicle?: VehicleKind;
  onFootOnly?: boolean;
  dialogue?: string;
}

export interface MissionDefinition {
  id: string;
  title: string;
  category: 'story' | 'side' | 'gig';
  subtitle: string;
  brief: string;
  rewardCash: number;
  timeLimitSec: number;
  startPos: { x: number; z: number };
  spawnPlayerAt?: { x: number; z: number; yaw?: number };
  spawnVehicle?: { kind: VehicleKind; x: number; z: number; yaw: number };
  checkpoints: MissionCheckpoint[];
  hasIdGuardHazard?: boolean;
}

export interface ActiveMissionState {
  definition: MissionDefinition;
  checkpointIndex: number;
  timeRemaining: number;
  rainBonusApplied: boolean;
  status: 'active' | 'completed' | 'failed';
}

export interface VehicleTelemetry {
  id: string;
  kind: VehicleKind;
  name: string;
  speedKmh: number;
  forwardSpeedKmh: number;
  fareInr: number;
  distanceKm: number;
  isAutoRickshaw: boolean;
}

export interface MinimapBlip {
  x: number;
  z: number;
  color: string;
  label?: string;
  kind: 'story' | 'side' | 'gig' | 'objective' | 'vehicle' | 'poi';
}
