import {
  ObstacleConfig,
  PVArrayConfig,
  SolarPosition,
  ModuleShadingState,
  HourlySimPoint,
  DailySimulationResult,
  LocationConfig,
  SkyConfig,
} from '../types/solar';
import { DEG2RAD, calculateSolarPosition, calculateIrradiance, getDayOfYear } from './solarMath';
import { acPowerKW } from './pvModel';

type Vec3 = [number, number, number];

/** Sun unit vector (X = East, Y = Up, Z = North). */
function sunVector(sunAltDeg: number, sunAzDeg: number): Vec3 {
  const alpha = sunAltDeg * DEG2RAD;
  const psi = sunAzDeg * DEG2RAD;
  return [Math.sin(psi) * Math.cos(alpha), Math.sin(alpha), Math.cos(psi) * Math.cos(alpha)];
}

/**
 * Array frame → world. Local axes: u along the row (width), s up the slope (−L/2 … +L/2).
 * The panel faces `azimuth` (0 = N), so the LOW edge points toward the facing direction and the
 * HIGH edge points away from it (rotation by azimuth + 180°). The 3D viewport uses the same
 * convention (rotation order YXZ).
 */
/**
 * Jarak dari pusat array ke TITIK TENGAH rintangan.
 * Untuk gedung, `distance` diartikan sebagai jarak ke DINDING yang menghadap PLTS,
 * sehingga mengubah panjang (depth) gedung tidak menggeser dindingnya mendekati panel.
 */
export function obstacleCenterDistance(o: ObstacleConfig): number {
  return o.type === 'building' ? o.distance + (o.depth || 5) / 2 : o.distance;
}

export function arrayLocalToWorld(u: number, s: number, cfg: PVArrayConfig, offset: Vec3 = [0, 0, 0]): Vec3 {
  const tiltRad = cfg.tilt * DEG2RAD;
  const phi = (cfg.azimuth + 180) * DEG2RAD;
  const lx = u;
  const ly = cfg.mountHeight + s * Math.sin(tiltRad);
  const lz = s * Math.cos(tiltRad);
  return [
    lx * Math.cos(phi) + lz * Math.sin(phi) + offset[0],
    ly + offset[1],
    -lx * Math.sin(phi) + lz * Math.cos(phi) + offset[2],
  ];
}

/** Horizontal offset of the identical row in front (toward the facing direction). */
export function frontRowOffset(cfg: PVArrayConfig): Vec3 {
  const az = cfg.azimuth * DEG2RAD;
  return [Math.sin(az) * cfg.rowSpacing, 0, Math.cos(az) * cfg.rowSpacing];
}

/** Tree geometry: trunk + ellipsoidal crown whose TOP is exactly at baseElevation + height. */
export function getTreeGeometry(obs: ObstacleConfig) {
  const rh = Math.max(0.25, obs.width / 2); // horizontal crown radius
  const rv = Math.max(0.2, Math.min(rh, obs.height * 0.35)); // vertical crown radius
  const crownCenterY = obs.height - rv; // relative to base
  return { rh, rv, crownCenterY, trunkTopY: crownCenterY, trunkRadius: 0.25 };
}

/** Ray (P + t·D, t > 0) vs. the tilted rectangle of the PV row in front. */
function isPointShadedByFrontRow(p: Vec3, sun: Vec3, cfg: PVArrayConfig): boolean {
  if (!cfg.frontRowEnabled || cfg.rowSpacing <= 0) return false;
  const off = frontRowOffset(cfg);
  const c = arrayLocalToWorld(0, 0, cfg, off);
  const eu = arrayLocalToWorld(1, 0, cfg, off).map((v, i) => v - c[i]) as Vec3;
  const es = arrayLocalToWorld(0, 1, cfg, off).map((v, i) => v - c[i]) as Vec3;
  const n: Vec3 = [eu[1] * es[2] - eu[2] * es[1], eu[2] * es[0] - eu[0] * es[2], eu[0] * es[1] - eu[1] * es[0]];
  const denom = n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2];
  if (Math.abs(denom) < 1e-6) return false;
  const t = (n[0] * (c[0] - p[0]) + n[1] * (c[1] - p[1]) + n[2] * (c[2] - p[2])) / denom;
  if (t <= 1e-4) return false;
  const q: Vec3 = [p[0] + t * sun[0] - c[0], p[1] + t * sun[1] - c[1], p[2] + t * sun[2] - c[2]];
  const u = q[0] * eu[0] + q[1] * eu[1] + q[2] * eu[2];
  const s = q[0] * es[0] + q[1] * es[1] + q[2] * es[2];
  const halfW = (cfg.moduleCountX * cfg.moduleWidth) / 2;
  const halfL = (cfg.moduleCountY * cfg.moduleLength) / 2;
  return Math.abs(u) <= halfW && Math.abs(s) <= halfL;
}

/**
 * Checks if a 3D ray from point P towards the Sun vector hits an obstacle
 */
export function isPointShadedByObstacle(
  px: number,
  py: number,
  pz: number,
  sunAltDeg: number,
  sunAzDeg: number,
  obstacle: ObstacleConfig
): boolean {
  if (!obstacle.enabled || sunAltDeg <= 0.5) return false;

  const [sunX, sunY, sunZ] = sunVector(sunAltDeg, sunAzDeg);
  if (sunY <= 0.01) return false; // Below or at horizon

  // Obstacle position relative to array center (0,0)
  const obsAzRad = obstacle.azimuth * DEG2RAD;
  const centerDist = obstacleCenterDistance(obstacle);
  const obsCenterX = Math.sin(obsAzRad) * centerDist;
  const obsCenterZ = Math.cos(obsAzRad) * centerDist;
  const baseElev = obstacle.baseElevation || 0;
  const topY = baseElev + obstacle.height;

  if (obstacle.type === 'tree') {
    // Tree = vertical trunk + ellipsoidal crown (horizontal radius rh, vertical radius rv),
    // crown top exactly at baseElevation + height.
    const g = getTreeGeometry(obstacle);
    const k = g.rh / g.rv; // scale Y so the ellipsoid becomes a sphere of radius rh
    const dx = px - obsCenterX;
    const dy = (py - (baseElev + g.crownCenterY)) * k;
    const dz = pz - obsCenterZ;
    const ux = sunX, uy = sunY * k, uz = sunZ;
    const A = ux * ux + uy * uy + uz * uz;
    const B = 2 * (dx * ux + dy * uy + dz * uz);
    const C = dx * dx + dy * dy + dz * dz - g.rh * g.rh;
    const disc = B * B - 4 * A * C;
    if (disc >= 0) {
      const t2 = (-B + Math.sqrt(disc)) / (2 * A);
      if (t2 > 0) return true;
    }

    // Trunk: vertical cylinder — closest approach of the ray to the trunk axis (horizontal plane)
    const hx = sunX, hz = sunZ;
    const hh = hx * hx + hz * hz;
    if (hh > 1e-9) {
      const t = ((obsCenterX - px) * hx + (obsCenterZ - pz) * hz) / hh;
      if (t > 0) {
        const cx = px + t * sunX - obsCenterX;
        const cz = pz + t * sunZ - obsCenterZ;
        const cy = py + t * sunY;
        if (Math.hypot(cx, cz) <= g.trunkRadius && cy >= baseElev && cy <= baseElev + g.trunkTopY) return true;
      }
    }
  } else if (obstacle.type === 'building' || obstacle.type === 'wall' || obstacle.type === 'front_row') {
    // Box / wall obstacle, oriented so its WIDTH runs across the line of sight from the array
    // (tangential) and its DEPTH runs along it (radial). Same orientation as the 3D viewport.
    const halfW = obstacle.width / 2;
    const depth = obstacle.depth || (obstacle.type === 'wall' ? 0.3 : obstacle.type === 'front_row' ? 1.2 : 5);
    const halfD = depth / 2;
    const tX = Math.cos(obsAzRad), tZ = -Math.sin(obsAzRad); // tangential axis
    const rX = Math.sin(obsAzRad), rZ = Math.cos(obsAzRad); // radial axis

    const dx = px - obsCenterX, dz = pz - obsCenterZ;
    const pu = dx * tX + dz * tZ; // point, local tangential
    const pv = dx * rX + dz * rZ; // point, local radial
    const su = sunX * tX + sunZ * tZ;
    const sv = sunX * rX + sunZ * rZ;

    const tu1 = (-halfW - pu) / (su || 1e-9);
    const tu2 = (halfW - pu) / (su || 1e-9);
    const ty1 = (baseElev - py) / sunY;
    const ty2 = (topY - py) / sunY;
    const tv1 = (-halfD - pv) / (sv || 1e-9);
    const tv2 = (halfD - pv) / (sv || 1e-9);

    const tEnter = Math.max(Math.min(tu1, tu2), Math.min(ty1, ty2), Math.min(tv1, tv2));
    const tExit = Math.min(Math.max(tu1, tu2), Math.max(ty1, ty2), Math.max(tv1, tv2));

    if (tEnter <= tExit && tExit > 0) {
      return true;
    }
  } else if (obstacle.type === 'pole') {
    // Narrow vertical cylinder
    const poleRadius = obstacle.width ? obstacle.width / 2 : 0.15;
    const hh = sunX * sunX + sunZ * sunZ;
    if (hh > 1e-9) {
      const t = ((obsCenterX - px) * sunX + (obsCenterZ - pz) * sunZ) / hh;
      if (t > 0) {
        const cx = px + t * sunX - obsCenterX;
        const cz = pz + t * sunZ - obsCenterZ;
        const cy = py + t * sunY;
        if (Math.hypot(cx, cz) <= poleRadius && cy >= baseElev && cy <= topY) return true;
      }
    }
  }

  return false;
}

/**
 * Calculates detailed shading for each module in the PV array
 */
export function calculateArrayShading(
  arrayConfig: PVArrayConfig,
  obstacles: ObstacleConfig[],
  solarPos: SolarPosition
): {
  modules: ModuleShadingState[];
  totalShadedFraction: number; // 0 to 1
  mismatchFactor: number; // 0 to 1 (accounts for bypass diodes and string topology)
} {
  const { moduleCountX, moduleCountY, moduleLength, moduleWidth } = arrayConfig;
  const totalModules = moduleCountX * moduleCountY;
  const activeObstacles = obstacles.filter((o) => o.enabled);

  if (!solarPos.isDaylight || (activeObstacles.length === 0 && !arrayConfig.frontRowEnabled)) {
    const defaultModules: ModuleShadingState[] = [];
    for (let i = 0; i < totalModules; i++) {
      defaultModules.push({
        index: i,
        row: Math.floor(i / moduleCountX),
        col: i % moduleCountX,
        shadedRatio: 0,
        subStringsShaded: [false, false, false],
        relativePower: 1.0,
      });
    }
    return { modules: defaultModules, totalShadedFraction: 0, mismatchFactor: 1.0 };
  }

  const sun = sunVector(solarPos.altitude, solarPos.azimuth);
  const totalW = moduleCountX * moduleWidth;
  const totalL = moduleCountY * moduleLength;

  const modules: ModuleShadingState[] = [];
  let totalSamplePoints = 0;
  let shadedSamplePoints = 0;

  for (let r = 0; r < moduleCountY; r++) {
    for (let c = 0; c < moduleCountX; c++) {
      const index = r * moduleCountX + c;
      const localX = (c + 0.5) * moduleWidth - totalW / 2;
      const localYAlongSlope = (r + 0.5) * moduleLength - totalL / 2;

      // A standard PV module has 3 bypass diode zones (sub-strings 1, 2, 3)
      const subStringShaded: [boolean, boolean, boolean] = [false, false, false];
      let moduleShadedPoints = 0;
      const pointsPerSub = 3; // 3 points per sub-string = 9 sample points per module

      for (let s = 0; s < 3; s++) {
        let subHasShade = false;
        for (let p = 0; p < pointsPerSub; p++) {
          totalSamplePoints++;
          const subXOffset = ((s + 0.5) / 3 - 0.5) * moduleWidth;
          const subYOffset = ((p + 0.5) / pointsPerSub - 0.5) * moduleLength;
          const pt = arrayLocalToWorld(localX + subXOffset, localYAlongSlope + subYOffset, arrayConfig);

          let ptShaded = isPointShadedByFrontRow(pt, sun, arrayConfig);
          if (!ptShaded) {
            for (const obs of activeObstacles) {
              if (isPointShadedByObstacle(pt[0], pt[1], pt[2], solarPos.altitude, solarPos.azimuth, obs)) {
                ptShaded = true;
                break;
              }
            }
          }

          if (ptShaded) {
            subHasShade = true;
            moduleShadedPoints++;
            shadedSamplePoints++;
          }
        }
        subStringShaded[s] = subHasShade;
      }

      const shadedRatio = moduleShadedPoints / (3 * pointsPerSub);

      // Relative power of this module considering bypass diodes:
      // 1 substring shaded → bypass diode conducts → ≈2/3 power; 2 → ≈1/3; 3 → diffuse only (~8 %)
      const activeSubstrings = subStringShaded.filter((v) => !v).length;
      const relativePower = activeSubstrings === 3 ? 1.0 : activeSubstrings === 2 ? 0.66 : activeSubstrings === 1 ? 0.33 : 0.08;

      modules.push({ index, row: r, col: c, shadedRatio, subStringsShaded: subStringShaded, relativePower });
    }
  }

  const totalShadedFraction = totalSamplePoints > 0 ? shadedSamplePoints / totalSamplePoints : 0;

  // Electrical mismatch factor based on inverter topology
  const sumRel = modules.reduce((acc, m) => acc + m.relativePower, 0);
  const avgRel = sumRel / totalModules;
  let mismatchFactor = 1.0;
  if (arrayConfig.inverterType === 'microinverter') {
    mismatchFactor = avgRel; // independent MPPT per module
  } else if (arrayConfig.inverterType === 'optimizer') {
    mismatchFactor = avgRel; // module-level MPPT (DC/DC): shaded modules no longer drag down the string
  } else if (totalShadedFraction > 0) {
    // String inverter: extra mismatch / multi-peak MPPT penalty under partial shade
    const worstModule = Math.min(...modules.map((m) => m.relativePower));
    const penalty = worstModule < 0.5 ? 0.85 : 0.93;
    mismatchFactor = Math.max(0.05, avgRel * penalty);
  }

  return {
    modules,
    totalShadedFraction,
    mismatchFactor: Math.min(1.0, Math.max(0, mismatchFactor)),
  };
}

/**
 * Runs a full-day simulation for the 15th of `month`, LOCAL CLOCK TIME 05:00–19:00 every 30 minutes.
 */
export function simulateFullDay(
  location: LocationConfig,
  month: number, // 1 to 12
  arrayConfig: PVArrayConfig,
  obstacles: ObstacleConfig[],
  sky: SkyConfig
): DailySimulationResult {
  const doy = getDayOfYear(month, 15);
  const totalKWp = (arrayConfig.moduleCountX * arrayConfig.moduleCountY * arrayConfig.moduleWattage) / 1000;

  const hourlyPoints: HourlySimPoint[] = [];
  let totalEnergyKWh = 0;
  let unshadedEnergyKWh = 0;
  let peakPowerKW = 0;
  let peakHour = 12;
  let poaDaily = 0; // Wh/m²
  let ghiDaily = 0; // Wh/m²
  const dt = 0.5;

  for (let h = 5; h <= 19; h += dt) {
    const solarPos = calculateSolarPosition(location.latitude, doy, h, location.longitude, location.timezoneOffset);
    const irradiance = calculateIrradiance(solarPos, arrayConfig.tilt, arrayConfig.azimuth, {
      sky,
      latitude: location.latitude,
      dayOfYear: doy,
    });
    const solarHour = solarPos.solarTime ?? h;

    if (!solarPos.isDaylight || irradiance.poaTotalUnshaded <= 1) {
      hourlyPoints.push({
        hour: h, solarPos, irradiance, shadingLossPercent: 0, effectivePOA: 0,
        dcPowerKW: 0, acPowerKW: 0, unshadedACPowerKW: 0,
      });
      continue;
    }

    const shadingResult = calculateArrayShading(arrayConfig, obstacles, solarPos);
    const ideal = acPowerKW(totalKWp, irradiance.poaTotalUnshaded, solarHour, arrayConfig.tilt, 1);
    const actual = acPowerKW(totalKWp, irradiance.poaTotalUnshaded, solarHour, arrayConfig.tilt, shadingResult.mismatchFactor);

    const effectivePOA = irradiance.poaTotalUnshaded * shadingResult.mismatchFactor;
    const shadingLossPercent = ideal.acKW > 0.01
      ? Math.max(0, Math.min(100, ((ideal.acKW - actual.acKW) / ideal.acKW) * 100))
      : 0;

    if (actual.acKW > peakPowerKW) {
      peakPowerKW = actual.acKW;
      peakHour = h;
    }

    totalEnergyKWh += actual.acKW * dt;
    unshadedEnergyKWh += ideal.acKW * dt;
    poaDaily += irradiance.poaTotalUnshaded * dt;
    ghiDaily += irradiance.ghi * dt;

    hourlyPoints.push({
      hour: h,
      solarPos,
      irradiance,
      shadingLossPercent: Math.round(shadingLossPercent * 10) / 10,
      effectivePOA: Math.round(effectivePOA),
      dcPowerKW: Math.round(actual.dcKW * 100) / 100,
      acPowerKW: Math.round(actual.acKW * 100) / 100,
      unshadedACPowerKW: Math.round(ideal.acKW * 100) / 100,
      cellTempC: Math.round(actual.cellTemp * 10) / 10,
    });
  }

  const energyLostKWh = Math.max(0, unshadedEnergyKWh - totalEnergyKWh);
  const overallLoss = unshadedEnergyKWh > 0 ? (energyLostKWh / unshadedEnergyKWh) * 100 : 0;
  const specificYield = totalKWp > 0 ? totalEnergyKWh / totalKWp : 0;

  // IEC 61724 Performance Ratio: final yield / reference yield
  const poaKWhm2 = poaDaily / 1000;
  const referenceYield = poaKWhm2; // kWh/kWp = H_POA / 1 kW/m²
  const performanceRatio = referenceYield > 0 ? specificYield / referenceYield : 0;
  const unshadedPR = referenceYield > 0 && totalKWp > 0 ? unshadedEnergyKWh / totalKWp / referenceYield : 0;

  return {
    hourly: hourlyPoints,
    totalEnergyKWh: Math.round(totalEnergyKWh * 100) / 100,
    unshadedEnergyKWh: Math.round(unshadedEnergyKWh * 100) / 100,
    energyLostKWh: Math.round(energyLostKWh * 100) / 100,
    overallShadingLossPercent: Math.round(overallLoss * 10) / 10,
    peakPowerKW: Math.round(peakPowerKW * 100) / 100,
    systemCapacityKWp: totalKWp,
    specificYieldKWhPerKWp: Math.round(specificYield * 100) / 100,
    performanceRatio: Math.round(performanceRatio * 1000) / 1000,
    unshadedPerformanceRatio: Math.round(unshadedPR * 1000) / 1000,
    ghiDailyKWhm2: Math.round(ghiDaily / 10) / 100,
    poaDailyKWhm2: Math.round(poaKWhm2 * 100) / 100,
    peakHour,
  };
}

/** Annual totals: 12 mid-month days × days in month. */
export function simulateYear(
  location: LocationConfig,
  arrayConfig: PVArrayConfig,
  obstacles: ObstacleConfig[],
  sky: SkyConfig
): { annualKWh: number; annualUnshadedKWh: number; annualLostKWh: number; annualLossPercent: number; monthlyKWh: number[] } {
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let a = 0;
  let u = 0;
  const monthlyKWh: number[] = [];
  for (let m = 1; m <= 12; m++) {
    const d = simulateFullDay(location, m, arrayConfig, obstacles, sky);
    monthlyKWh.push(d.totalEnergyKWh * days[m - 1]);
    a += d.totalEnergyKWh * days[m - 1];
    u += d.unshadedEnergyKWh * days[m - 1];
  }
  return {
    annualKWh: Math.round(a),
    annualUnshadedKWh: Math.round(u),
    annualLostKWh: Math.round(u - a),
    annualLossPercent: u > 0 ? Math.round(((u - a) / u) * 1000) / 10 : 0,
    monthlyKWh,
  };
}

/**
 * Calculates optimal inter-row spacing (row pitch) to avoid self-shading
 * between consecutive rows of PV modules at lowest solar altitude of interest
 */
export function calculateInterRowPitch(
  moduleLength: number,
  tiltDeg: number,
  criticalSolarAltDeg: number = 25 // standard critical altitude (typically winter solstice 9 AM / 3 PM)
): {
  minRowPitch: number; // meters from front edge to front edge of next row
  freeSpacing: number; // clear walkway distance between rows
  shadowLength: number; // length of shadow cast by front row
  verticalHeight: number; // height of upper edge above lower edge
  groundCoverRatio: number; // GCR = module length / pitch
  recommendation: string;
} {
  const beta = tiltDeg * DEG2RAD;
  const alpha = criticalSolarAltDeg * DEG2RAD;

  // Vertical height H = L * sin(tilt)
  const verticalHeight = moduleLength * Math.sin(beta);
  // Horizontal projection = L * cos(tilt)
  const horizProj = moduleLength * Math.cos(beta);
  // Shadow length along ground at solar altitude alpha: S = H / tan(alpha)
  const shadowLength = verticalHeight / Math.tan(alpha);
  // Minimum pitch d = horizProj + shadowLength
  const minRowPitch = horizProj + shadowLength;
  const freeSpacing = Math.max(0, shadowLength);
  const groundCoverRatio = minRowPitch > 0 ? moduleLength / minRowPitch : 1;

  let recommendation = '';
  if (tiltDeg <= 5) {
    recommendation = 'Pada kemiringan flat (≤5°), bayangan baris depan sangat minim. Jarak antar baris 0.4–0.6 m sudah cukup untuk akses pemeliharaan teknisi.';
  } else if (tiltDeg <= 15) {
    recommendation = `Kemiringan ideal tropis (${tiltDeg}°). Jarak antar baris minimal ${minRowPitch.toFixed(2)} m (jarak bebas ${freeSpacing.toFixed(2)} m) aman dari bayangan jam 09:00–15:00.`;
  } else {
    recommendation = `Kemiringan cukup curam (${tiltDeg}°). Diperlukan jarak antar baris lebar ${minRowPitch.toFixed(2)} m untuk menghindari self-shading baris depan di pagi/sore hari.`;
  }

  return {
    minRowPitch: Math.round(minRowPitch * 100) / 100,
    freeSpacing: Math.round(freeSpacing * 100) / 100,
    shadowLength: Math.round(shadowLength * 100) / 100,
    verticalHeight: Math.round(verticalHeight * 100) / 100,
    groundCoverRatio: Math.round(groundCoverRatio * 100) / 100,
    recommendation,
  };
}
