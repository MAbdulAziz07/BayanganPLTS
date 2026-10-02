import { ObstacleConfig, PVArrayConfig, SolarPosition, ModuleShadingState, HourlySimPoint, DailySimulationResult, IrradianceData } from '../types/solar';
import { DEG2RAD, calculateSolarPosition, calculateIrradiance } from './solarMath';

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

  const alpha = sunAltDeg * DEG2RAD;
  const psi = sunAzDeg * DEG2RAD;

  // Sun unit vector (X = East, Y = Up, Z = North)
  // Azimuth: 0=N (+Z), 90=E (+X), 180=S (-Z), 270=W (-X)
  const sunX = Math.sin(psi) * Math.cos(alpha);
  const sunY = Math.sin(alpha);
  const sunZ = Math.cos(psi) * Math.cos(alpha);

  if (sunY <= 0.01) return false; // Below or at horizon

  // Obstacle position relative to array center (0,0)
  const obsAzRad = obstacle.azimuth * DEG2RAD;
  const obsCenterX = Math.sin(obsAzRad) * obstacle.distance;
  const obsCenterZ = Math.cos(obsAzRad) * obstacle.distance;
  const baseElev = obstacle.baseElevation || 0;
  const topY = baseElev + obstacle.height;

  // Intersect ray P + t * Sun with obstacle geometry
  if (obstacle.type === 'tree') {
    // Tree modeled as a foliage sphere on top of a trunk cylinder
    const trunkHeight = obstacle.height * 0.45;
    const crownRadius = obstacle.width / 2;
    const crownCenterY = baseElev + trunkHeight + crownRadius;

    // Check foliage sphere intersection
    const dx = px - obsCenterX;
    const dy = py - crownCenterY;
    const dz = pz - obsCenterZ;

    const b = 2 * (dx * sunX + dy * sunY + dz * sunZ);
    const c = dx * dx + dy * dy + dz * dz - crownRadius * crownRadius;
    const discriminant = b * b - 4 * c;

    if (discriminant >= 0) {
      const t1 = (-b - Math.sqrt(discriminant)) / 2;
      const t2 = (-b + Math.sqrt(discriminant)) / 2;
      if (t2 > 0) return true; // hits tree crown towards sun
    }

    // Check trunk cylinder (radius ~0.25m)
    const trunkRadius = 0.25;
    const tToTrunk = (obsCenterZ - pz) / sunZ;
    if (tToTrunk > 0) {
      const hitX = px + tToTrunk * sunX;
      const hitY = py + tToTrunk * sunY;
      if (
        Math.abs(hitX - obsCenterX) <= trunkRadius &&
        hitY >= baseElev &&
        hitY <= baseElev + trunkHeight
      ) {
        return true;
      }
    }
  } else if (obstacle.type === 'building' || obstacle.type === 'wall' || obstacle.type === 'front_row') {
    // Box / Wall obstacle
    const halfW = obstacle.width / 2;
    const depth = obstacle.depth || (obstacle.type === 'wall' ? 0.3 : obstacle.type === 'front_row' ? 1.5 : 4);
    const halfD = depth / 2;

    // Fast bounding box ray test
    const minX = obsCenterX - halfW;
    const maxX = obsCenterX + halfW;
    const minZ = obsCenterZ - halfD;
    const maxZ = obsCenterZ + halfD;

    // Check if ray towards sun passes through box [minX..maxX, baseElev..topY, minZ..maxZ]
    const tx1 = (minX - px) / (sunX || 0.0001);
    const tx2 = (maxX - px) / (sunX || 0.0001);
    const tminX = Math.min(tx1, tx2);
    const tmaxX = Math.max(tx1, tx2);

    const ty1 = (baseElev - py) / sunY;
    const ty2 = (topY - py) / sunY;
    const tminY = Math.min(ty1, ty2);
    const tmaxY = Math.max(ty1, ty2);

    const tz1 = (minZ - pz) / (sunZ || 0.0001);
    const tz2 = (maxZ - pz) / (sunZ || 0.0001);
    const tminZ = Math.min(tz1, tz2);
    const tmaxZ = Math.max(tz1, tz2);

    const tEnter = Math.max(tminX, tminY, tminZ);
    const tExit = Math.min(tmaxX, tmaxY, tmaxZ);

    if (tEnter <= tExit && tExit > 0) {
      return true;
    }
  } else if (obstacle.type === 'pole') {
    // Narrow vertical cylinder
    const poleRadius = obstacle.width ? obstacle.width / 2 : 0.15;
    const t = (obsCenterZ - pz) / (sunZ || 0.0001);
    if (t > 0) {
      const hitX = px + t * sunX;
      const hitY = py + t * sunY;
      if (Math.abs(hitX - obsCenterX) <= poleRadius && hitY >= baseElev && hitY <= topY) {
        return true;
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
  const { moduleCountX, moduleCountY, moduleLength, moduleWidth, tilt, azimuth, mountHeight } = arrayConfig;
  const totalModules = moduleCountX * moduleCountY;

  if (!solarPos.isDaylight || obstacles.filter(o => o.enabled).length === 0) {
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
    return {
      modules: defaultModules,
      totalShadedFraction: 0,
      mismatchFactor: 1.0,
    };
  }

  const tiltRad = tilt * DEG2RAD;
  const azRad = azimuth * DEG2RAD;

  // Array center is (0,0)
  const totalW = moduleCountX * moduleWidth;
  const totalL = moduleCountY * moduleLength;

  const modules: ModuleShadingState[] = [];
  let totalSamplePoints = 0;
  let shadedSamplePoints = 0;

  for (let r = 0; r < moduleCountY; r++) {
    for (let c = 0; c < moduleCountX; c++) {
      const index = r * moduleCountX + c;

      // Module local coordinates relative to array center (before tilt & azimuth)
      // c goes from -totalW/2 to +totalW/2
      const localX = (c + 0.5) * moduleWidth - totalW / 2;
      // r goes along slope from bottom to top
      const localYAlongSlope = (r + 0.5) * moduleLength - totalL / 2;

      // Check 3 sub-strings across module width/length
      // A standard PV module has 3 bypass diode zones (sub-strings 1, 2, 3)
      const subStringShaded: [boolean, boolean, boolean] = [false, false, false];
      let moduleShadedPoints = 0;
      const pointsPerSub = 3; // 3 points per sub-string = 9 sample points per module

      for (let s = 0; s < 3; s++) {
        let subHasShade = false;
        for (let p = 0; p < pointsPerSub; p++) {
          totalSamplePoints++;
          // Offset within module
          const subXOffset = ((s + 0.5) / 3 - 0.5) * moduleWidth;
          const subYOffset = ((p + 0.5) / pointsPerSub - 0.5) * moduleLength;

          const pxLocal = localX + subXOffset;
          const pySlope = localYAlongSlope + subYOffset;

          // Transform with tilt: panel tilted around horizontal axis
          // y (height) = mountHeight + pySlope * sin(tilt)
          // z (depth) = pySlope * cos(tilt)
          const pxTilted = pxLocal;
          const pyTilted = mountHeight + pySlope * Math.sin(tiltRad);
          const pzTilted = pySlope * Math.cos(tiltRad);

          // Rotate by array azimuth around Y axis
          const pxWorld = pxTilted * Math.cos(azRad) + pzTilted * Math.sin(azRad);
          const pyWorld = pyTilted;
          const pzWorld = -pxTilted * Math.sin(azRad) + pzTilted * Math.cos(azRad);

          let ptShaded = false;
          for (const obs of obstacles) {
            if (obs.enabled && isPointShadedByObstacle(pxWorld, pyWorld, pzWorld, solarPos.altitude, solarPos.azimuth, obs)) {
              ptShaded = true;
              break;
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

      // Relative power calculation of this module considering bypass diodes:
      // If 1 substring is shaded: bypass diode activates -> module delivers 2/3 voltage (approx 66% power)
      // If 2 substrings shaded: 1/3 voltage (approx 33% power)
      // If 3 substrings shaded: 0% direct power (only diffuse ~10%)
      let relativePower = 1.0;
      const activeSubstrings = subStringShaded.filter(s => !s).length;
      if (activeSubstrings === 3) {
        relativePower = 1.0;
      } else if (activeSubstrings === 2) {
        relativePower = 0.66;
      } else if (activeSubstrings === 1) {
        relativePower = 0.33;
      } else {
        relativePower = 0.08; // only diffuse irradiance
      }

      modules.push({
        index,
        row: r,
        col: c,
        shadedRatio,
        subStringsShaded: subStringShaded,
        relativePower,
      });
    }
  }

  const totalShadedFraction = totalSamplePoints > 0 ? shadedSamplePoints / totalSamplePoints : 0;

  // Electrical Mismatch factor based on inverter topology:
  let mismatchFactor = 1.0;
  if (arrayConfig.inverterType === 'microinverter') {
    // Microinverter: each module has individual MPPT, power is simple sum
    const sumRel = modules.reduce((acc, m) => acc + m.relativePower, 0);
    mismatchFactor = sumRel / totalModules;
  } else if (arrayConfig.inverterType === 'optimizer') {
    // DC Optimizer: series string current is matched by buck/boost per module
    // 98% efficiency with almost independent module output
    const sumRel = modules.reduce((acc, m) => acc + m.relativePower, 0);
    mismatchFactor = (sumRel / totalModules) * 0.98;
  } else {
    // Traditional String Inverter:
    // When one or more modules are shaded, the string's operating current is constrained.
    // If bypass diodes conduct, current is maintained but voltage drops by the bypassed diodes.
    // However, if shading is uneven across rows, string MPPT incurs curve mismatch loss.
    const sumRel = modules.reduce((acc, m) => acc + m.relativePower, 0);
    const avgRel = sumRel / totalModules;
    const worstModule = Math.min(...modules.map(m => m.relativePower));

    if (totalShadedFraction === 0) {
      mismatchFactor = 1.0;
    } else {
      // String inverter penalty: ~15-25% extra mismatch loss when partial shade occurs
      const penalty = worstModule < 0.5 ? 0.85 : 0.93;
      mismatchFactor = Math.max(0.05, avgRel * penalty);
    }
  }

  return {
    modules,
    totalShadedFraction,
    mismatchFactor: Math.min(1.0, Math.max(0, mismatchFactor)),
  };
}

/**
 * Runs a complete 24-hour simulation (sampled every 30-60 mins during daylight)
 */
export function simulateFullDay(
  latitude: number,
  month: number, // 1 to 12
  arrayConfig: PVArrayConfig,
  obstacles: ObstacleConfig[]
): DailySimulationResult {
  const daysInMonths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let doy = 0;
  for (let i = 0; i < month - 1; i++) doy += daysInMonths[i];
  doy += 15; // mid of month

  const totalKWp = (arrayConfig.moduleCountX * arrayConfig.moduleCountY * arrayConfig.moduleWattage) / 1000;
  const inverterEfficiency = 0.96; // 96% standard European / CEC inverter efficiency
  const tempDerating = 0.90; // Tropical ambient temperature derating (~45°C cell temp = -0.38%/°C)

  const hourlyPoints: HourlySimPoint[] = [];
  let totalEnergyKWh = 0;
  let unshadedEnergyKWh = 0;
  let peakPowerKW = 0;

  // Evaluate hourly from 6:00 to 18:00
  for (let h = 6; h <= 18; h += 0.5) {
    const solarPos = calculateSolarPosition(latitude, doy, h);
    const irradiance = calculateIrradiance(solarPos, arrayConfig.tilt, arrayConfig.azimuth);

    if (!solarPos.isDaylight || irradiance.poaTotalUnshaded <= 1) {
      hourlyPoints.push({
        hour: h,
        solarPos,
        irradiance,
        shadingLossPercent: 0,
        effectivePOA: 0,
        dcPowerKW: 0,
        acPowerKW: 0,
        unshadedACPowerKW: 0,
      });
      continue;
    }

    const shadingResult = calculateArrayShading(arrayConfig, obstacles, solarPos);

    // Unshaded power: standard STC (1000 W/m²) scaling
    const unshadedDCPowerKW = totalKWp * (irradiance.poaTotalUnshaded / 1000) * tempDerating;
    const unshadedACPowerKW = unshadedDCPowerKW * inverterEfficiency;

    // Shaded power: effective POA accounts for direct beam blockage + electrical mismatch factor
    const effectivePOA = irradiance.poaTotalUnshaded * (1 - shadingResult.totalShadedFraction * (irradiance.poaBeam / Math.max(1, irradiance.poaTotalUnshaded)));
    const dcPowerKW = totalKWp * (irradiance.poaTotalUnshaded / 1000) * tempDerating * shadingResult.mismatchFactor;
    const acPowerKW = dcPowerKW * inverterEfficiency;

    const shadingLossPercent = unshadedACPowerKW > 0.01
      ? Math.max(0, Math.min(100, ((unshadedACPowerKW - acPowerKW) / unshadedACPowerKW) * 100))
      : 0;

    peakPowerKW = Math.max(peakPowerKW, acPowerKW);

    // Energy integration: dt = 0.5 hours
    totalEnergyKWh += acPowerKW * 0.5;
    unshadedEnergyKWh += unshadedACPowerKW * 0.5;

    hourlyPoints.push({
      hour: h,
      solarPos,
      irradiance,
      shadingLossPercent: Math.round(shadingLossPercent * 10) / 10,
      effectivePOA: Math.round(effectivePOA),
      dcPowerKW: Math.round(dcPowerKW * 100) / 100,
      acPowerKW: Math.round(acPowerKW * 100) / 100,
      unshadedACPowerKW: Math.round(unshadedACPowerKW * 100) / 100,
    });
  }

  const energyLostKWh = Math.max(0, unshadedEnergyKWh - totalEnergyKWh);
  const overallLoss = unshadedEnergyKWh > 0 ? (energyLostKWh / unshadedEnergyKWh) * 100 : 0;
  const specificYield = totalKWp > 0 ? totalEnergyKWh / totalKWp : 0;

  // Performance Ratio (PR): Actual yield / Reference yield
  const referenceYield = unshadedEnergyKWh / Math.max(0.1, totalKWp);
  const performanceRatio = referenceYield > 0 ? Math.min(0.95, (specificYield / referenceYield) * 0.82) : 0.80;

  return {
    hourly: hourlyPoints,
    totalEnergyKWh: Math.round(totalEnergyKWh * 100) / 100,
    unshadedEnergyKWh: Math.round(unshadedEnergyKWh * 100) / 100,
    energyLostKWh: Math.round(energyLostKWh * 100) / 100,
    overallShadingLossPercent: Math.round(overallLoss * 10) / 10,
    peakPowerKW: Math.round(peakPowerKW * 100) / 100,
    systemCapacityKWp: totalKWp,
    specificYieldKWhPerKWp: Math.round(specificYield * 100) / 100,
    performanceRatio: Math.round(performanceRatio * 100) / 100,
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
