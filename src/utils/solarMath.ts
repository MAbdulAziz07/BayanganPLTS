import { LocationConfig, SolarPosition, IrradianceData, SkyConfig } from '../types/solar';

export const CITIES_INDONESIA: LocationConfig[] = [
  { name: 'Jakarta (DKI Jakarta)', latitude: -6.2088, longitude: 106.8456, timezoneOffset: 7 },
  { name: 'Surabaya (Jawa Timur)', latitude: -7.2575, longitude: 112.7521, timezoneOffset: 7 },
  { name: 'Bandung (Jawa Barat)', latitude: -6.9175, longitude: 107.6191, timezoneOffset: 7 },
  { name: 'Batam (Kepulauan Riau)', latitude: 1.1301, longitude: 104.0529, timezoneOffset: 7 },
  { name: 'Medan (Sumatera Utara)', latitude: 3.5952, longitude: 98.6722, timezoneOffset: 7 },
  { name: 'Denpasar (Bali)', latitude: -8.6705, longitude: 115.2126, timezoneOffset: 8 },
  { name: 'Makassar (Sulawesi Selatan)', latitude: -5.1477, longitude: 119.4327, timezoneOffset: 8 },
  { name: 'Pontianak (Khatulistiwa 0°)', latitude: 0.0000, longitude: 109.3333, timezoneOffset: 7 },
  { name: 'Balikpapan (IKN / Kaltim)', latitude: -1.2654, longitude: 116.8312, timezoneOffset: 8 },
  { name: 'Kupang (NTT - Radiasi Tinggi)', latitude: -10.1772, longitude: 123.6070, timezoneOffset: 8 },
];

export const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

/** Default sky: average-sky model with a clearness index typical for humid tropical Indonesia. */
export const DEFAULT_SKY: SkyConfig = { mode: 'climate', kt: 0.5 };

/** Local time-zone label (WIB / WITA / WIT) for a UTC offset. */
export function timeZoneLabel(offset: number): string {
  if (offset === 7) return 'WIB';
  if (offset === 8) return 'WITA';
  if (offset === 9) return 'WIT';
  return `UTC${offset >= 0 ? '+' : ''}${offset}`;
}

/** Formats decimal hours as HH:MM. */
export function formatClock(h: number): string {
  let hours = Math.floor(h);
  let mins = Math.round((h - hours) * 60);
  if (mins === 60) { hours += 1; mins = 0; }
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Get day of year (1 - 365) from month (1 - 12) and day (1 - 31)
 */
export function getDayOfYear(month: number, day: number = 15): number {
  let doy = 0;
  for (let i = 0; i < month - 1; i++) {
    doy += DAYS_IN_MONTH[i];
  }
  return doy + day;
}

/** Solar declination in degrees (Cooper). */
export function solarDeclination(dayOfYear: number): number {
  return 23.45 * Math.sin(DEG2RAD * ((360 / 365) * (284 + dayOfYear)));
}

/** Equation of time in minutes (Spencer / Duffie & Beckman approximation). */
export function equationOfTime(dayOfYear: number): number {
  const B = DEG2RAD * (360 * (dayOfYear - 81)) / 364;
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
}

/**
 * Converts local clock time (WIB/WITA/WIT) to apparent solar time:
 * solar = clock + [4·(λ − 15·UTC offset) + EoT] / 60
 */
export function clockToSolarTime(clockHour: number, longitude: number, timezoneOffset: number, dayOfYear: number): number {
  return clockHour + (4 * (longitude - 15 * timezoneOffset) + equationOfTime(dayOfYear)) / 60;
}

/** Local clock time at which the sun is highest (solar noon). */
export function solarNoonClock(longitude: number, timezoneOffset: number, dayOfYear: number): number {
  return 12 - (4 * (longitude - 15 * timezoneOffset) + equationOfTime(dayOfYear)) / 60;
}

/** Sunset hour angle ωs in degrees. */
export function sunsetHourAngle(latitudeDeg: number, declinationDeg: number): number {
  const x = -Math.tan(latitudeDeg * DEG2RAD) * Math.tan(declinationDeg * DEG2RAD);
  return Math.acos(Math.max(-1, Math.min(1, x))) * RAD2DEG;
}

/**
 * Calculates solar position (altitude and azimuth in degrees).
 * If `longitude` and `timezoneOffset` are given, `hourDecimal` is LOCAL CLOCK TIME and is
 * converted to solar time (longitude + equation of time). Otherwise it is solar time.
 */
export function calculateSolarPosition(
  latitudeDeg: number,
  dayOfYear: number,
  hourDecimal: number,
  longitude?: number,
  timezoneOffset?: number
): SolarPosition {
  const solarTime =
    longitude !== undefined && timezoneOffset !== undefined
      ? clockToSolarTime(hourDecimal, longitude, timezoneOffset, dayOfYear)
      : hourDecimal;

  const phi = latitudeDeg * DEG2RAD;

  // Solar declination (Cooper's formula)
  const declinationDeg = solarDeclination(dayOfYear);
  const delta = declinationDeg * DEG2RAD;

  // Hour angle: omega = 15° * (solar time - 12)
  const hourAngleDeg = 15 * (solarTime - 12);
  const omega = hourAngleDeg * DEG2RAD;

  // Solar altitude / elevation: sin(alpha) = sin(phi)*sin(delta) + cos(phi)*cos(delta)*cos(omega)
  const sinAlpha = Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(omega);
  const alpha = Math.asin(Math.max(-1, Math.min(1, sinAlpha)));
  const altitudeDeg = alpha * RAD2DEG;

  const isDaylight = altitudeDeg > 0.5;

  if (!isDaylight) {
    return {
      altitude: Math.max(0, altitudeDeg),
      azimuth: 180,
      declination: declinationDeg,
      hourAngle: hourAngleDeg,
      zenith: 90,
      isDaylight: false,
      solarTime,
    };
  }

  // Solar azimuth calculation (0° = North, 90° = East, 180° = South, 270° = West)
  // cos(gamma_s) = (sin(alpha)*sin(phi) - sin(delta)) / (cos(alpha)*cos(phi))
  const sinZenith = Math.cos(alpha);

  let cosAzimuth = (sinAlpha * Math.sin(phi) - Math.sin(delta)) / (sinZenith * Math.cos(phi));
  cosAzimuth = Math.max(-1, Math.min(1, cosAzimuth));
  const gammaRad = Math.acos(cosAzimuth);
  let azimuthDeg = gammaRad * RAD2DEG;

  // Adjust for morning vs afternoon (hour angle < 0 is morning / East, > 0 is afternoon / West).
  // acos() gives the angle measured from South; after the +180° shift below, morning must land
  // on the East side (0–180°) and afternoon on the West side (180–360°).
  if (hourAngleDeg < 0) {
    azimuthDeg = 360 - azimuthDeg;
  }

  const finalAzimuth = (azimuthDeg + 180) % 360;

  return {
    altitude: altitudeDeg,
    azimuth: finalAzimuth,
    declination: declinationDeg,
    hourAngle: hourAngleDeg,
    zenith: 90 - altitudeDeg,
    isDaylight: true,
    solarTime,
  };
}

/**
 * Calculates Angle of Incidence (AOI) between sun beam and tilted surface
 * beta = tilt angle (0 = flat, 90 = vertical)
 * gamma = panel orientation azimuth (0 = North, 90 = East, 180 = South, 270 = West)
 */
export function calculateAOI(
  solarAltDeg: number,
  solarAzDeg: number,
  panelTiltDeg: number,
  panelAzDeg: number
): number {
  if (solarAltDeg <= 0) return 90;

  const alpha = solarAltDeg * DEG2RAD;
  const psi = solarAzDeg * DEG2RAD;
  const beta = panelTiltDeg * DEG2RAD;
  const gamma = panelAzDeg * DEG2RAD;

  // cos(theta) = sin(alpha)*cos(beta) + cos(alpha)*sin(beta)*cos(psi - gamma)
  const cosTheta = Math.sin(alpha) * Math.cos(beta) + Math.cos(alpha) * Math.sin(beta) * Math.cos(psi - gamma);
  const clampedCos = Math.max(0, Math.min(1, cosTheta));
  return Math.acos(clampedCos) * RAD2DEG;
}

/** Daily extraterrestrial irradiation on a horizontal surface H0 (kWh/m²/day). */
export function extraterrestrialDaily(latitudeDeg: number, dayOfYear: number): number {
  const Gsc = 1367;
  const phi = latitudeDeg * DEG2RAD;
  const dec = solarDeclination(dayOfYear);
  const delta = dec * DEG2RAD;
  const ws = sunsetHourAngle(latitudeDeg, dec) * DEG2RAD;
  const ecc = 1 + 0.033 * Math.cos(DEG2RAD * (360 * dayOfYear) / 365);
  const H0 = (24 / Math.PI) * Gsc * ecc *
    (Math.cos(phi) * Math.cos(delta) * Math.sin(ws) + ws * Math.sin(phi) * Math.sin(delta));
  return Math.max(0, H0 / 1000);
}

/** Daily diffuse fraction Hd/H from the daily clearness index (Erbs et al., 1982). */
export function dailyDiffuseFraction(kt: number, sunsetHourAngleDeg: number): number {
  if (sunsetHourAngleDeg <= 81.4) {
    if (kt < 0.715) return 1 - 0.2727 * kt + 2.4495 * kt ** 2 - 11.9514 * kt ** 3 + 9.3879 * kt ** 4;
    return 0.143;
  }
  if (kt < 0.722) return 1 + 0.2832 * kt - 2.5557 * kt ** 2 + 0.8448 * kt ** 3;
  return 0.175;
}

/** Monthly-average daily global horizontal irradiation (kWh/m²/day) for the climate model. */
export function climateDailyGHI(latitudeDeg: number, dayOfYear: number, kt: number): number {
  return kt * extraterrestrialDaily(latitudeDeg, dayOfYear);
}

/** Clear-sky beam/diffuse (simple tropical model) used for the 'clearsky' mode and as a DNI cap. */
function clearSkyComponents(altitudeDeg: number): { dni: number; dhi: number } {
  const I0 = 1367;
  const zenithDeg = 90 - altitudeDeg;
  const airMass = 1 / (Math.cos(zenithDeg * DEG2RAD) + 0.50572 * Math.pow(96.07995 - zenithDeg, -1.6364));
  const dni = Math.max(0, I0 * Math.pow(0.7, Math.pow(airMass, 0.678)));
  const dhi = Math.max(0, 0.12 * I0 * Math.sin(altitudeDeg * DEG2RAD));
  return { dni, dhi };
}

export interface IrradianceOptions {
  sky?: SkyConfig; // defaults to clear-sky when omitted
  latitude?: number; // required for the climate model
  dayOfYear?: number; // required for the climate model
  albedo?: number; // ground reflectance (default 0.2)
}

/**
 * Calculates GHI/DNI/DHI and plane-of-array (POA) irradiance.
 * Climate mode: daily GHI = KT·H0 → diffuse fraction (Erbs) → hourly ratios rt (Collares-Pereira & Rabl)
 * and rd (Liu & Jordan) → hourly GHI & DHI → DNI = (GHI − DHI)/sin(α).
 * Transposition to the tilted plane: isotropic sky (Liu & Jordan) + ground reflection.
 */
export function calculateIrradiance(
  solarPos: SolarPosition,
  panelTiltDeg: number,
  panelAzDeg: number,
  opts: IrradianceOptions = {}
): IrradianceData {
  const albedo = opts.albedo ?? 0.2;
  if (!solarPos.isDaylight || solarPos.altitude <= 1) {
    return { ghi: 0, dni: 0, dhi: 0, poaBeam: 0, poaDiffuse: 0, poaGround: 0, poaTotalUnshaded: 0, aoi: 90 };
  }

  const sinAlpha = Math.sin(solarPos.altitude * DEG2RAD);
  const clear = clearSkyComponents(solarPos.altitude);

  let dni: number;
  let dhi: number;

  const useClimate = opts.sky?.mode === 'climate' && opts.latitude !== undefined && opts.dayOfYear !== undefined;
  if (useClimate) {
    const lat = opts.latitude as number;
    const doy = opts.dayOfYear as number;
    const kt = opts.sky!.kt;
    const ws = sunsetHourAngle(lat, solarPos.declination);
    const wsRad = ws * DEG2RAD;
    const w = solarPos.hourAngle * DEG2RAD;
    const H = climateDailyGHI(lat, doy, kt); // kWh/m²/day
    const Hd = H * dailyDiffuseFraction(kt, ws);
    const denom = Math.sin(wsRad) - wsRad * Math.cos(wsRad);
    const shape = Math.max(0, Math.cos(w) - Math.cos(wsRad)) / denom;
    const a = 0.409 + 0.5016 * Math.sin(wsRad - Math.PI / 3);
    const b = 0.6609 - 0.4767 * Math.sin(wsRad - Math.PI / 3);
    const rt = (Math.PI / 24) * (a + b * Math.cos(w)) * shape;
    const rd = (Math.PI / 24) * shape;
    const ghiH = rt * H * 1000; // W/m² (hour average)
    dhi = Math.min(ghiH, rd * Hd * 1000);
    dni = Math.min(clear.dni, Math.max(0, (ghiH - dhi) / sinAlpha));
  } else {
    dni = clear.dni;
    dhi = clear.dhi;
  }
  const ghi = dni * sinAlpha + dhi;

  // Angle of Incidence
  const aoiDeg = calculateAOI(solarPos.altitude, solarPos.azimuth, panelTiltDeg, panelAzDeg);
  const cosTheta = Math.max(0, Math.cos(aoiDeg * DEG2RAD));

  const betaRad = panelTiltDeg * DEG2RAD;
  const poaBeam = dni * cosTheta;
  const poaDiffuse = dhi * ((1 + Math.cos(betaRad)) / 2);
  const poaGround = ghi * albedo * ((1 - Math.cos(betaRad)) / 2);
  const poaTotalUnshaded = Math.max(0, poaBeam + poaDiffuse + poaGround);

  return {
    ghi: Math.round(ghi),
    dni: Math.round(dni),
    dhi: Math.round(dhi),
    poaBeam: Math.round(poaBeam),
    poaDiffuse: Math.round(poaDiffuse),
    poaGround: Math.round(poaGround),
    poaTotalUnshaded: Math.round(poaTotalUnshaded),
    aoi: Math.round(aoiDeg * 10) / 10,
  };
}

/**
 * Calculates optimal slope / tilt for annual energy yield in a given latitude.
 * For tropical Indonesia (-10° to +5°), mathematical optimum is near |lat| (5°-10°),
 * but solar PV design standards (IEC / SNI) require at least 10°-15° tilt
 * to ensure rainwater runoff washes off dirt/soiling (self-cleaning).
 */
export function getRecommendedTilt(latitude: number): {
  mathematicalOptimal: number;
  practicalRecommended: number;
  recommendedAzimuth: number; // 0=North, 180=South
  explanation: string;
} {
  const absLat = Math.abs(latitude);
  const mathOpt = Math.max(5, Math.round(absLat * 0.9 + 2));
  // In tropical climate with frequent rain and dust, min 10° is crucial for self-cleaning
  const practical = Math.max(10, mathOpt);
  // Facing direction: if South of equator, face North (0°); if North of equator, face South (180°)
  const recAz = latitude < 0 ? 0 : 180;
  const azName = recAz === 0 ? 'Utara (0°)' : 'Selatan (180°)';

  let explanation = '';
  if (Math.abs(latitude) < 2) {
    explanation = `Lokasi berada tepat di dekat Khatulistiwa. Matahari melintas di utara pada April-Agustus dan di selatan pada Oktober-Februari. Kemiringan 10°–15° (hadap ${azName}) sangat dianjurkan agar air hujan dapat mengalir lancar dan membersihkan debu modul secara alami (self-cleaning).`;
  } else if (latitude < 0) {
    explanation = `Lokasi berada di Belahan Bumi Selatan (Lintang ${latitude.toFixed(1)}° S). Panel dianjurkan menghadap ke ${azName} dengan kemiringan ${practical}° untuk memaksimalkan tangkapan radiasi tahunan sekaligus mencegah genangan air hujan dan akumulasi debu/lumut.`;
  } else {
    explanation = `Lokasi berada di Belahan Bumi Utara (Lintang ${latitude.toFixed(1)}° N). Panel dianjurkan menghadap ke ${azName} dengan kemiringan ${practical}° untuk tangkapan energi optimal dan self-cleaning.`;
  }

  return {
    mathematicalOptimal: mathOpt,
    practicalRecommended: practical,
    recommendedAzimuth: recAz,
    explanation,
  };
}
