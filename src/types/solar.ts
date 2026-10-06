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

export type PanelColorMode =
  | 'high_contrast'   // Perak / Silver-Platinum (Kontras Maksimal untuk Bayangan)
  | 'sky_blue';       // Biru Langit

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
  rowSpacing: number; // meters, row pitch (front edge to front edge) to the identical row in front
  frontRowEnabled?: boolean; // simulate an identical PV row in front of this one at `rowSpacing`
}

/**
 * Sky / climate model.
 * - 'climate'  : average-sky model. Daily GHI = KT × extraterrestrial irradiation (H0),
 *                split into beam/diffuse (Erbs daily correlation) and distributed hourly
 *                (Collares-Pereira & Rabl / Liu & Jordan).
 * - 'clearsky' : cloudless reference sky (upper bound, for comparison only).
 */
export interface SkyConfig {
  mode: 'climate' | 'clearsky';
  kt: number; // monthly-average daily clearness index (0.30 – 0.75), typical humid tropics ≈ 0.45–0.55
}

export interface SolarPosition {
  altitude: number; // degrees above horizon
  azimuth: number; // degrees (0=N, 90=E, 180=S, 270=W)
  declination: number; // degrees
  hourAngle: number; // degrees
  zenith: number; // degrees
  isDaylight: boolean;
  solarTime?: number; // apparent solar time (hours) corresponding to the requested clock time
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
  cellTempC?: number; // module cell temperature (°C)
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
  performanceRatio: number; // IEC 61724: PR = (E_AC / P0) / (H_POA / G_STC), includes shading
  unshadedPerformanceRatio: number; // same, without obstacles (temperature, soiling, wiring, inverter only)
  ghiDailyKWhm2: number; // daily global horizontal irradiation (kWh/m²)
  poaDailyKWhm2: number; // daily plane-of-array irradiation, unshaded (kWh/m²)
  peakHour: number; // clock hour of peak AC power
}
