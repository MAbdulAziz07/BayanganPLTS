export interface LocationConfig {
  name: string;
  latitude: number; // degrees, positive North, negative South
  longitude: number; // degrees, positive East
  timezoneOffset: number; // UTC+7 for WIB, etc.
}

export type ObstacleType = 'tree' | 'building' | 'wall' | 'pole' | 'front_row';

export interface ObstacleConfig {
  id: string;
  type: ObstacleType;
  name: string;
  enabled: boolean;
  distance: number; // meters from array center
  azimuth: number; // degrees (0=North, 90=East, 180=South, 270=West)
  height: number; // meters (tinggi objek/rintangan)
  width: number; // meters
  depth?: number; // meters
  baseElevation?: number; // meters (elevasi dasar rintangan di atas permukaan tanah/lantai dasar)
}

export interface PVArrayConfig {
  moduleCountX: number; // modules per row (e.g. 4)
  moduleCountY: number; // rows (e.g. 2)
  moduleWattage: number; // Wp per module, e.g. 550 Wp
  moduleLength: number; // meters (e.g. 2.27 m)
  moduleWidth: number; // meters (e.g. 1.13 m)
  tilt: number; // slope / tilt angle in degrees (0 = flat, 90 = vertical)
  azimuth: number; // orientation angle (0=North, 90=East, 180=South, 270=West)
  mountHeight: number; // meters above ground
  mountType: 'rooftop_sloped' | 'rooftop_flat' | 'ground';
  inverterType: 'string' | 'optimizer' | 'microinverter';
  rowSpacing: number; // meters (for multi-row ground or flat roof)
}

export interface SolarPosition {
  altitude: number; // degrees above horizon
  azimuth: number; // degrees (0=N, 90=E, 180=S, 270=W)
  declination: number; // degrees
  hourAngle: number; // degrees
  zenith: number; // degrees
  isDaylight: boolean;
}

export interface IrradianceData {
  ghi: number; // Global Horizontal Irradiance (W/m²)
  dni: number; // Direct Normal Irradiance (W/m²)
  dhi: number; // Diffuse Horizontal Irradiance (W/m²)
  poaBeam: number; // Beam component on tilted array (W/m²)
  poaDiffuse: number; // Diffuse component on tilted array (W/m²)
  poaGround: number; // Ground reflected on tilted array (W/m²)
  poaTotalUnshaded: number; // Total unshaded POA (W/m²)
  aoi: number; // Angle of Incidence (degrees)
}

export interface ModuleShadingState {
  index: number;
  row: number;
  col: number;
  shadedRatio: number; // 0 = fully lit, 1 = fully shaded
  subStringsShaded: [boolean, boolean, boolean]; // 3 bypass diode zones
  relativePower: number; // 0.0 to 1.0
}

export interface HourlySimPoint {
  hour: number; // 6 to 18
  solarPos: SolarPosition;
  irradiance: IrradianceData;
  shadingLossPercent: number; // 0 - 100%
  effectivePOA: number; // W/m²
  dcPowerKW: number; // kW
  acPowerKW: number; // kW after inverter/string mismatch
  unshadedACPowerKW: number; // kW without any shade
}

export interface DailySimulationResult {
  hourly: HourlySimPoint[];
  totalEnergyKWh: number; // shaded daily yield
  unshadedEnergyKWh: number; // ideal daily yield
  energyLostKWh: number;
  overallShadingLossPercent: number;
  peakPowerKW: number;
  systemCapacityKWp: number;
  specificYieldKWhPerKWp: number;
  performanceRatio: number;
}
