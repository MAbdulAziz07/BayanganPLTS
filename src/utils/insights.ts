import {
  LocationConfig,
  PVArrayConfig,
  ObstacleConfig,
  SkyConfig,
  DailySimulationResult,
} from '../types/solar';
import { simulateFullDay, simulateYear, calculateInterRowPitch } from './shadingMath';
import { getRecommendedTilt, formatClock } from './solarMath';

/**
 * Turunan hasil simulasi menjadi ringkasan dan arahan tindakan.
 * Semua angka berasal dari model yang sama dengan tampilan utama (simulateFullDay / simulateYear),
 * sehingga "sebelum" dan "sesudah" selalu dibandingkan dengan asumsi yang identik.
 */

export const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export interface SimInputs {
  location: LocationConfig;
  month: number;
  arrayConfig: PVArrayConfig;
  obstacles: ObstacleConfig[];
  sky: SkyConfig;
}

export type ActionPatch =
  | { kind: 'array'; patch: Partial<PVArrayConfig> }
  | { kind: 'disableObstacle'; id: string };

export interface ActionItem {
  id: string;
  title: string;
  detail: string;
  /** 'bulan' = hari representatif bulan terpilih; 'tahun' = rata-rata harian sepanjang tahun. */
  basis: 'bulan' | 'tahun';
  beforeKWh: number; // kWh per hari
  afterKWh: number; // kWh per hari
  deltaKWh: number;
  deltaPct: number;
  applyLabel: string;
  apply: ActionPatch;
  /** Catatan tambahan, mis. biaya atau kebutuhan lahan. */
  note?: string;
}

export interface ObstacleImpact {
  id: string;
  name: string;
  lostKWh: number;
}

export interface ShadingSummary {
  actualKWh: number;
  unshadedKWh: number;
  lostKWh: number;
  lossPct: number;
  lostPerMonthKWh: number;
  /** Rentang jam dengan kerugian terbesar, mis. "07:00–09:30", atau null bila tidak ada bayangan. */
  worstWindow: string | null;
  /** Rintangan yang paling banyak mengurangi produksi (bila ada). */
  mainCause: ObstacleImpact | null;
  impacts: ObstacleImpact[];
}

export interface Insights {
  summary: ShadingSummary;
  actions: ActionItem[];
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Rata-rata produksi harian sepanjang tahun (kWh/hari). */
export function annualDailyAverage(i: SimInputs, cfg: PVArrayConfig = i.arrayConfig): number {
  const y = simulateYear(i.location, cfg, i.obstacles, i.sky);
  return y.annualKWh / 365;
}

export function dailyKWh(i: SimInputs, cfg: PVArrayConfig = i.arrayConfig, obs: ObstacleConfig[] = i.obstacles): DailySimulationResult {
  return simulateFullDay(i.location, i.month, cfg, obs, i.sky);
}

/** Cari rentang jam berurutan di sekitar puncak kerugian bayangan. */
function findWorstWindow(daily: DailySimulationResult): string | null {
  const pts = daily.hourly.map((p) => ({ h: p.hour, loss: Math.max(0, p.unshadedACPowerKW - p.acPowerKW) }));
  const max = Math.max(0, ...pts.map((p) => p.loss));
  if (max < 0.02) return null;
  const thr = max * 0.3;
  const peak = pts.findIndex((p) => p.loss === max);
  let a = peak;
  let b = peak;
  while (a > 0 && pts[a - 1].loss >= thr) a--;
  while (b < pts.length - 1 && pts[b + 1].loss >= thr) b++;
  return `${formatClock(pts[a].h)}–${formatClock(pts[b].h + 0.5)}`;
}

export function computeInsights(i: SimInputs, baseline: DailySimulationResult): Insights {
  const base = baseline.totalEnergyKWh;
  const enabled = i.obstacles.filter((o) => o.enabled);

  // Kontribusi tiap rintangan: produksi bila hanya rintangan itu yang dihilangkan.
  const impacts: ObstacleImpact[] = enabled
    .map((o) => {
      const without = dailyKWh(i, i.arrayConfig, i.obstacles.map((x) => (x.id === o.id ? { ...x, enabled: false } : x)));
      return { id: o.id, name: o.name, lostKWh: round2(Math.max(0, without.totalEnergyKWh - base)) };
    })
    .sort((a, b) => b.lostKWh - a.lostKWh);

  // Bayangan dari baris panel di depan (self-shading) diperlakukan sebagai "rintangan" tersendiri.
  if (i.arrayConfig.frontRowEnabled) {
    const noFront = dailyKWh(i, { ...i.arrayConfig, frontRowEnabled: false });
    const lost = round2(Math.max(0, noFront.totalEnergyKWh - base));
    if (lost > 0) {
      impacts.push({ id: '__front_row__', name: 'Baris panel di depan', lostKWh: lost });
      impacts.sort((a, b) => b.lostKWh - a.lostKWh);
    }
  }

  const summary: ShadingSummary = {
    actualKWh: baseline.totalEnergyKWh,
    unshadedKWh: baseline.unshadedEnergyKWh,
    lostKWh: baseline.energyLostKWh,
    lossPct: baseline.overallShadingLossPercent,
    lostPerMonthKWh: round2(baseline.energyLostKWh * DAYS_IN_MONTH[i.month - 1]),
    worstWindow: findWorstWindow(baseline),
    mainCause: impacts.find((x) => x.lostKWh >= 0.05) ?? null,
    impacts,
  };

  const actions: ActionItem[] = [];
  const push = (a: Omit<ActionItem, 'deltaKWh' | 'deltaPct'>) => {
    const deltaKWh = round2(a.afterKWh - a.beforeKWh);
    const deltaPct = a.beforeKWh > 0 ? Math.round((deltaKWh / a.beforeKWh) * 1000) / 10 : 0;
    if (deltaKWh >= 0.05) actions.push({ ...a, deltaKWh, deltaPct });
  };

  // 1) Inverter: string → optimizer (dalam model ini optimizer = microinverter).
  if (i.arrayConfig.inverterType === 'string' && baseline.energyLostKWh > 0.02) {
    const after = dailyKWh(i, { ...i.arrayConfig, inverterType: 'optimizer' }).totalEnergyKWh;
    push({
      id: 'inverter',
      title: 'Pasang optimizer per panel',
      detail: 'Panel yang terbayang tidak lagi menurunkan panel lain dalam rangkaian seri.',
      basis: 'bulan',
      beforeKWh: base,
      afterKWh: after,
      applyLabel: 'Coba optimizer',
      apply: { kind: 'array', patch: { inverterType: 'optimizer' } },
      note: 'Menambah biaya perangkat per panel. Microinverter memberi hasil yang sama dalam model ini.',
    });
  }

  // 2) Rintangan terbesar.
  const top = impacts.find((x) => x.id !== '__front_row__');
  if (top && top.lostKWh >= 0.05) {
    push({
      id: `obstacle_${top.id}`,
      title: `Kurangi bayangan dari ${top.name}`,
      detail:
        'Pangkas atau pindahkan rintangan, geser panel menjauh, atau pasang panel lebih tinggi. Angka "sesudah" adalah batas atas bila rintangan ini hilang sepenuhnya.',
      basis: 'bulan',
      beforeKWh: base,
      afterKWh: base + top.lostKWh,
      applyLabel: 'Coba tanpa rintangan ini',
      apply: { kind: 'disableObstacle', id: top.id },
    });
  }

  // 3) Jarak antarbaris di bawah minimum.
  if (i.arrayConfig.frontRowEnabled) {
    const tableLength = i.arrayConfig.moduleCountY * i.arrayConfig.moduleLength;
    const minPitch = calculateInterRowPitch(tableLength, i.arrayConfig.tilt, 25).minRowPitch;
    if (i.arrayConfig.rowSpacing < minPitch - 0.01) {
      const after = dailyKWh(i, { ...i.arrayConfig, rowSpacing: minPitch }).totalEnergyKWh;
      push({
        id: 'pitch',
        title: `Perlebar jarak antarbaris ke ${minPitch.toFixed(2)} m`,
        detail: `Saat ini ${i.arrayConfig.rowSpacing.toFixed(2)} m, lebih rapat dari batas minimum untuk matahari ≥ 25°.`,
        basis: 'bulan',
        beforeKWh: base,
        afterKWh: after,
        applyLabel: 'Terapkan jarak minimum',
        apply: { kind: 'array', patch: { rowSpacing: minPitch } },
        note: `Butuh lahan tambahan ±${(minPitch - i.arrayConfig.rowSpacing).toFixed(2)} m per baris.`,
      });
    }
  }

  // 4) Orientasi (kemiringan & arah hadap) — dinilai rata-rata setahun karena sudut terbaik berbeda tiap bulan.
  const rec = getRecommendedTilt(i.location.latitude);
  const tiltOff = Math.abs(i.arrayConfig.tilt - rec.practicalRecommended) >= 3;
  const azOff = i.arrayConfig.azimuth !== rec.recommendedAzimuth;
  if (tiltOff || azOff) {
    const target: Partial<PVArrayConfig> = {
      ...(tiltOff ? { tilt: rec.practicalRecommended } : {}),
      ...(azOff ? { azimuth: rec.recommendedAzimuth } : {}),
    };
    const before = annualDailyAverage(i);
    const after = annualDailyAverage(i, { ...i.arrayConfig, ...target });
    const parts = [
      tiltOff ? `kemiringan ${i.arrayConfig.tilt}° → ${rec.practicalRecommended}°` : '',
      azOff ? `arah hadap → ${rec.recommendedAzimuth === 0 ? 'Utara' : 'Selatan'}` : '',
    ].filter(Boolean);
    push({
      id: 'orientation',
      title: `Ubah ${parts.join(' dan ')}`,
      detail: 'Dihitung sebagai rata-rata harian sepanjang tahun karena sudut terbaik berbeda di setiap bulan.',
      basis: 'tahun',
      beforeKWh: round2(before),
      afterKWh: round2(after),
      applyLabel: 'Terapkan orientasi',
      apply: { kind: 'array', patch: target },
    });
  }

  actions.sort((a, b) => b.deltaKWh - a.deltaKWh);
  return { summary, actions };
}

/** Teks ringkasan satu kalimat, mis. "Bayangan mengurangi produksi harian sebesar 2,08 kWh atau 12,4%." */
export function shadingSentence(s: ShadingSummary): string {
  if (s.lostKWh < 0.01) return 'Tidak ada bayangan yang mengurangi produksi harian pada kondisi ini.';
  return `Bayangan mengurangi produksi harian sebesar ${fmt(s.lostKWh)} kWh atau ${fmt(s.lossPct, 1)}%.`;
}

/** Format angka gaya Indonesia (koma desimal). */
export function fmt(x: number, digits = 2): string {
  return x.toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
