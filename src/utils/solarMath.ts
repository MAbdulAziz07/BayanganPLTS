import { LocationConfig, PVArrayConfig, SolarPosition, IrradianceData } from '../types/solar';

export const CITIES_INDONESIA: LocationConfig[] = [
  { name: 'Jakarta (Jawa Barat)', latitude: -6.2088, longitude: 106.8456, timezoneOffset: 7 },
  { name: 'Surabaya (Jawa Timur)', latitude: -7.2575, longitude: 112.7521, timezoneOffset: 7 },
  { name: 'Bandung (Jawa Barat)', latitude: -6.9175, longitude: 107.6191, timezoneOffset: 7 },
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

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

/**
 * Get day of year (1 - 365) from month (1 - 12) and day (1 - 31)
 */
export function getDayOfYear(month: number, day: number = 15): number {
  const daysInMonths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let doy = 0;
  for (let i = 0; i < month - 1; i++) {
    doy += daysInMonths[i];
  }
  return doy + day;
}

/**
 * Calculates solar position (altitude and azimuth in degrees)
 * for a specific latitude, day of year, and local solar hour
 */
export function calculateSolarPosition(
  latitudeDeg: number,
  dayOfYear: number,
  hourDecimal: number
): SolarPosition {
  const phi = latitudeDeg * DEG2RAD;

  // Solar declination (Cooper's formula)
  const declinationDeg = 23.45 * Math.sin(DEG2RAD * ((360 / 365) * (284 + dayOfYear)));
  const delta = declinationDeg * DEG2RAD;

  // Hour angle: omega = 15° * (hour - 12)
  const hourAngleDeg = 15 * (hourDecimal - 12);
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
    };
  }

  // Solar azimuth calculation (0° = North, 90° = East, 180° = South, 270° = West)
  // cos(gamma_s) = (sin(alpha)*sin(phi) - sin(delta)) / (cos(alpha)*cos(phi))
  const cosZenith = Math.sin(alpha);
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

  // Convention: South is 180°, North is 0° / 360°
  // For standard meteorological convention: 0 = N, 90 = E, 180 = S, 270 = W
  // Check solar position relative to equator
  const finalAzimuth = (azimuthDeg + 180) % 360;

  return {
    altitude: altitudeDeg,
    azimuth: finalAzimuth,
    declination: declinationDeg,
    hourAngle: hourAngleDeg,
    zenith: 90 - altitudeDeg,
    isDaylight: true,
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

/**
 * Calculates clear-sky solar irradiance and plane-of-array (POA) irradiance
 */
export function calculateIrradiance(
  solarPos: SolarPosition,
  panelTiltDeg: number,
  panelAzDeg: number,
  albedo: number = 0.2 // ground reflectance factor
): IrradianceData {
  if (!solarPos.isDaylight || solarPos.altitude <= 1) {
    return {
      ghi: 0,
      dni: 0,
      dhi: 0,
      poaBeam: 0,
      poaDiffuse: 0,
      poaGround: 0,
      poaTotalUnshaded: 0,
      aoi: 90,
    };
  }

  const alpha = solarPos.altitude * DEG2RAD;
  const sinAlpha = Math.sin(alpha);

  // Extraterrestrial solar constant ~1367 W/m²
  const I0 = 1367;

  // Air Mass (Kasten-Young formula)
  const zenithDeg = 90 - solarPos.altitude;
  const zenithRad = zenithDeg * DEG2RAD;
  const airMass = 1 / (Math.cos(zenithRad) + 0.50572 * Math.pow(96.07995 - zenithDeg, -1.6364));

  // Clear sky direct normal irradiance (Meinel / Haurwitz model adjusted for tropical regions)
  const dni = Math.max(0, I0 * Math.pow(0.7, Math.pow(airMass, 0.678)));
  const dhi = Math.max(0, 0.12 * I0 * sinAlpha); // tropical diffuse component from humidity
  const ghi = dni * sinAlpha + dhi;

  // Angle of Incidence
  const aoiDeg = calculateAOI(solarPos.altitude, solarPos.azimuth, panelTiltDeg, panelAzDeg);
  const aoiRad = aoiDeg * DEG2RAD;
  const cosTheta = Math.max(0, Math.cos(aoiRad));

  // POA Beam
  const poaBeam = dni * cosTheta;

  // POA Diffuse on tilted plane (Liu & Jordan isotropic model)
  const betaRad = panelTiltDeg * DEG2RAD;
  const poaDiffuse = dhi * ((1 + Math.cos(betaRad)) / 2);

  // POA Ground reflected
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
