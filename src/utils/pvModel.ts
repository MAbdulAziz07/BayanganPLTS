import { IrradianceData, SkyConfig } from '../types/solar';
import { calculateIrradiance, calculateSolarPosition, getDayOfYear } from './solarMath';

/**
 * Electrical / thermal model of the PV system (shared by every view so numbers stay consistent).
 *
 * P_AC = P0 × (G_POA / 1000) × f_temp × f_soiling × f_other × MF × η_inv
 *   f_temp    = 1 + γ·(T_cell − 25),  T_cell = T_amb + (NOCT − 20)/800 × G_POA
 *   f_soiling = depends on tilt (flat panels are not washed by rain)
 *   f_other   = wiring, module mismatch, LID … (lumped)
 *   MF        = shading / electrical mismatch factor (1 = no shade)
 */
export const PV_CONSTANTS = {
  inverterEfficiency: 0.96,
  tempCoeffPerC: -0.0035, // γ, mono-Si typical (−0.35 %/°C)
  noctC: 45, // nominal operating cell temperature
  otherLossFactor: 0.97, // wiring, module mismatch, light-induced degradation
};

/** Soiling factor as a function of tilt: flat modules keep dirt and puddles in the tropics. */
export function soilingFactor(tiltDeg: number): number {
  if (tiltDeg < 2.5) return 0.9; // ~10 % (standing water, dust crust)
  if (tiltDeg < 7.5) return 0.95; // ~5 %
  if (tiltDeg < 10) return 0.97;
  return 0.98; // self-cleaning by rain, residual ~2 %
}

/** Typical tropical ambient temperature profile (°C) versus solar time. */
export function ambientTempC(solarHour: number): number {
  const s = Math.sin((Math.PI * (solarHour - 8)) / 12);
  return 26 + 6 * Math.max(0, s); // 26 °C at dawn, ≈32 °C mid-afternoon
}

export function cellTempC(poa: number, solarHour: number): number {
  return ambientTempC(solarHour) + ((PV_CONSTANTS.noctC - 20) / 800) * poa;
}

/** AC power (kW) for a given POA irradiance and mismatch factor. */
export function acPowerKW(
  kWp: number,
  poa: number,
  solarHour: number,
  tiltDeg: number,
  mismatchFactor: number = 1
): { acKW: number; dcKW: number; cellTemp: number } {
  if (poa <= 0) return { acKW: 0, dcKW: 0, cellTemp: ambientTempC(solarHour) };
  const tc = cellTempC(poa, solarHour);
  const fTemp = 1 + PV_CONSTANTS.tempCoeffPerC * (tc - 25);
  const dcKW = kWp * (poa / 1000) * fTemp * soilingFactor(tiltDeg) * PV_CONSTANTS.otherLossFactor * mismatchFactor;
  return { acKW: dcKW * PV_CONSTANTS.inverterEfficiency, dcKW, cellTemp: tc };
}

/**
 * Unshaded daily AC energy per kWp for a mid-month day (used by the tilt-sensitivity analysis).
 * Integrates over solar time with 30-minute steps.
 */
export function unshadedDailyKWhPerKWp(
  latitude: number,
  month: number,
  tiltDeg: number,
  azimuthDeg: number,
  sky: SkyConfig
): number {
  const doy = getDayOfYear(month, 15);
  let e = 0;
  for (let h = 5; h <= 19; h += 0.5) {
    const sp = calculateSolarPosition(latitude, doy, h);
    if (!sp.isDaylight) continue;
    const irr: IrradianceData = calculateIrradiance(sp, tiltDeg, azimuthDeg, { sky, latitude, dayOfYear: doy });
    e += acPowerKW(1, irr.poaTotalUnshaded, h, tiltDeg).acKW * 0.5;
  }
  return e;
}
