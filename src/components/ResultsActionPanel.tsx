import React, { useEffect, useMemo, useState } from 'react';
import { PVArrayConfig, ObstacleConfig, DailySimulationResult } from '../types/solar';
import { MONTH_NAMES_ID, getRecommendedTilt } from '../utils/solarMath';
import { calculateInterRowPitch, simulateFullDay, simulateYear } from '../utils/shadingMath';
import {
  Insights,
  ActionItem,
  ActionPatch,
  SimInputs,
  shadingSentence,
  fmt,
  DAYS_IN_MONTH,
} from '../utils/insights';
import { TermHelp, compassName } from './TermHelp';
import {
  ClipboardList,
  TrendingUp,
  FlaskConical,
  Info,
  GitCompare,
  RotateCcw,
  Bookmark,
  X,
  Clock,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Utilitas                                                            */
/* ------------------------------------------------------------------ */

/** Menunda nilai sampai pengguna berhenti mengubahnya, agar simulasi pembanding tidak membuat slider tersendat. */
export function useDebounced<T>(value: T, delay = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return v;
}

export interface ReferenceSnapshot {
  label: string;
  arrayConfig: PVArrayConfig;
  obstacles: ObstacleConfig[];
}

const signed = (x: number, d = 2) => `${x >= 0 ? '+' : '−'}${fmt(Math.abs(x), d)}`;

const INVERTER_LABEL: Record<PVArrayConfig['inverterType'], string> = {
  string: 'String inverter',
  optimizer: 'Optimizer per panel',
  microinverter: 'Microinverter',
};

/* ------------------------------------------------------------------ */
/* Batang sebelum / sesudah                                            */
/* ------------------------------------------------------------------ */

export const BeforeAfterBars: React.FC<{
  before: number;
  after: number;
  unit?: string;
  beforeLabel?: string;
  afterLabel?: string;
  digits?: number;
}> = ({ before, after, unit = 'kWh/hari', beforeLabel = 'Sebelum', afterLabel = 'Sesudah', digits = 2 }) => {
  const max = Math.max(before, after, 0.001);
  const delta = after - before;
  const pct = before > 0 ? (delta / before) * 100 : 0;
  const up = delta >= 0;
  return (
    <div className="space-y-1">
      {[
        { label: beforeLabel, val: before, cls: 'bg-slate-400' },
        { label: afterLabel, val: after, cls: up ? 'bg-emerald-500' : 'bg-rose-500' },
      ].map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-[11px]">
          <span className="w-14 shrink-0 text-slate-500">{r.label}</span>
          <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${r.cls}`} style={{ width: `${(r.val / max) * 100}%` }} />
          </div>
          <span className="w-24 shrink-0 text-right font-mono text-slate-800 tabular-nums">
            {fmt(r.val, digits)} <span className="text-slate-500">{unit.split('/')[0]}</span>
          </span>
        </div>
      ))}
      <p className={`text-[11px] font-semibold ${Math.abs(delta) < 0.005 ? 'text-slate-500' : up ? 'text-emerald-700' : 'text-rose-700'}`}>
        {Math.abs(delta) < 0.005
          ? 'Tidak ada perubahan produksi.'
          : `${up ? 'Naik' : 'Turun'} ${fmt(Math.abs(delta), digits)} ${unit} (${up ? '+' : '−'}${fmt(Math.abs(pct), 1)}%)`}
      </p>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Ringkasan                                                           */
/* ------------------------------------------------------------------ */

export const ShadingSummaryCard: React.FC<{ insights: Insights; month: number; compact?: boolean }> = ({
  insights,
  month,
  compact,
}) => {
  const s = insights.summary;
  const tone = s.lossPct < 3 ? 'emerald' : s.lossPct <= 10 ? 'amber' : 'rose';
  const toneCls = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    rose: 'bg-rose-50 border-rose-200 text-rose-900',
  }[tone];
  return (
    <div className={`p-3.5 rounded-xl border ${toneCls}`}>
      <p className={`${compact ? 'text-[13px]' : 'text-sm'} font-semibold leading-snug`}>{shadingSentence(s)}</p>
      <p className="text-[11px] mt-1 leading-relaxed opacity-90">
        Tanpa bayangan: <b className="font-mono">{fmt(s.unshadedKWh)} kWh</b> → dengan bayangan:{' '}
        <b className="font-mono">{fmt(s.actualKWh)} kWh</b> per hari (bulan {MONTH_NAMES_ID[month - 1]}).
        {s.lostKWh >= 0.01 && (
          <>
            {' '}Setara ±<b className="font-mono">{fmt(s.lostPerMonthKWh, 1)} kWh</b> per bulan.
          </>
        )}
      </p>
      {(s.worstWindow || s.mainCause) && (
        <ul className="mt-2 space-y-1 text-[11px]">
          {s.worstWindow && (
            <li className="flex items-start gap-1.5">
              <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Kerugian terbesar terjadi sekitar pukul <b>{s.worstWindow}</b>.
              </span>
            </li>
          )}
          {s.mainCause && (
            <li className="flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Penyebab utama: <b>{s.mainCause.name}</b> (±{fmt(s.mainCause.lostKWh)} kWh/hari)
                {s.impacts.length > 1 && !compact && (
                  <span className="opacity-80">
                    {'; '}
                    {s.impacts
                      .slice(1)
                      .filter((x) => x.lostKWh >= 0.01)
                      .map((x) => `${x.name} ±${fmt(x.lostKWh)} kWh`)
                      .join('; ')}
                  </span>
                )}
                .
              </span>
            </li>
          )}
        </ul>
      )}
      {!compact && s.impacts.length > 1 && (
        <p className="text-[10px] mt-1.5 opacity-75">
          Kontribusi tiap rintangan dihitung dengan menghilangkannya satu per satu, sehingga jumlahnya bisa berbeda dari
          total karena bayangan dapat saling tumpang tindih.
        </p>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Arahan tindakan                                                     */
/* ------------------------------------------------------------------ */

export const ActionList: React.FC<{
  actions: ActionItem[];
  onApply: (a: ActionItem) => void;
  limit?: number;
  lossPct: number;
}> = ({ actions, onApply, limit, lossPct }) => {
  const shown = limit ? actions.slice(0, limit) : actions;
  if (shown.length === 0) {
    return (
      <p className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] leading-relaxed">
        {lossPct < 0.5
          ? 'Tidak ada tindakan yang diperlukan: panel bebas bayangan dan orientasinya sudah sesuai saran untuk lokasi ini.'
          : 'Tidak ditemukan perubahan sederhana yang menaikkan produksi lebih dari 0,05 kWh/hari. Coba bandingkan perubahan lain secara manual di bawah.'}
      </p>
    );
  }
  return (
    <ol className="space-y-2.5">
      {shown.map((a, i) => (
        <li key={a.id} className="p-3 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="font-semibold text-slate-900 text-xs">{a.title}</span>
                  <span className="text-[11px] font-semibold text-emerald-700 whitespace-nowrap">
                    +{fmt(a.deltaKWh)} kWh/hari (+{fmt(a.deltaPct, 1)}%)
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug mt-0.5">{a.detail}</p>
              </div>
              <BeforeAfterBars before={a.beforeKWh} after={a.afterKWh} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] text-slate-500">
                  {a.basis === 'tahun' ? 'Dasar: rata-rata harian setahun' : 'Dasar: hari representatif bulan terpilih'}
                  {a.note ? ` · ${a.note}` : ''}
                </span>
                <button
                  onClick={() => onApply(a)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold"
                >
                  {a.applyLabel}
                </button>
              </div>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
};

/* ------------------------------------------------------------------ */
/* Perbandingan sebelum / sesudah terhadap acuan                       */
/* ------------------------------------------------------------------ */

function describeDiffs(a: ReferenceSnapshot, cur: { arrayConfig: PVArrayConfig; obstacles: ObstacleConfig[] }): string[] {
  const r = a.arrayConfig;
  const c = cur.arrayConfig;
  const out: string[] = [];
  if (r.tilt !== c.tilt) out.push(`Kemiringan ${r.tilt}° → ${c.tilt}°`);
  if (r.azimuth !== c.azimuth) out.push(`Arah hadap ${compassName(r.azimuth)} → ${compassName(c.azimuth)}`);
  if (r.inverterType !== c.inverterType) out.push(`${INVERTER_LABEL[r.inverterType]} → ${INVERTER_LABEL[c.inverterType]}`);
  if (!!r.frontRowEnabled !== !!c.frontRowEnabled)
    out.push(c.frontRowEnabled ? 'Baris panel di depan ditambahkan' : 'Baris panel di depan dihapus');
  else if (c.frontRowEnabled && Math.abs(r.rowSpacing - c.rowSpacing) > 0.001)
    out.push(`Jarak antarbaris ${r.rowSpacing.toFixed(2)} m → ${c.rowSpacing.toFixed(2)} m`);
  if (Math.abs(r.mountHeight - c.mountHeight) > 0.001)
    out.push(`Tinggi pemasangan ${r.mountHeight.toFixed(1)} m → ${c.mountHeight.toFixed(1)} m`);
  const rn = r.moduleCountX * r.moduleCountY;
  const cn = c.moduleCountX * c.moduleCountY;
  if (rn !== cn || r.moduleWattage !== c.moduleWattage)
    out.push(`Panel ${rn} × ${r.moduleWattage} Wp → ${cn} × ${c.moduleWattage} Wp`);
  if (JSON.stringify(a.obstacles) !== JSON.stringify(cur.obstacles)) {
    const ra = a.obstacles.filter((o) => o.enabled).length;
    const ca = cur.obstacles.filter((o) => o.enabled).length;
    out.push(ra !== ca ? `Rintangan aktif ${ra} → ${ca}` : 'Posisi/ukuran rintangan diubah');
  }
  return out;
}

export const ReferenceCompare: React.FC<{
  inputs: SimInputs;
  current: DailySimulationResult;
  reference: ReferenceSnapshot | null;
  onSetReference: () => void;
  onRestore: () => void;
  onClear: () => void;
}> = ({ inputs, current, reference, onSetReference, onRestore, onClear }) => {
  const refDaily = useMemo(
    () =>
      reference
        ? simulateFullDay(inputs.location, inputs.month, reference.arrayConfig, reference.obstacles, inputs.sky)
        : null,
    [reference, inputs.location, inputs.month, inputs.sky]
  );

  if (!reference || !refDaily) {
    return (
      <div className="p-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-[11px] text-slate-600 space-y-2">
        <p>
          Simpan kondisi sekarang sebagai <b>acuan</b>, lalu ubah kemiringan, jarak baris, inverter, atau rintangan di panel
          kanan. Hasil sebelum dan sesudah perubahan akan tampil di sini.
        </p>
        <button
          onClick={onSetReference}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold"
        >
          <Bookmark className="w-3.5 h-3.5" /> Simpan sebagai acuan
        </button>
      </div>
    );
  }

  const diffs = describeDiffs(reference, inputs);
  return (
    <div className="p-3 rounded-xl border border-sky-200 bg-sky-50/60 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-[10px] uppercase tracking-wide font-semibold text-sky-700">Sebelum vs sesudah</span>
          <p className="text-xs font-semibold text-slate-900">Acuan: {reference.label}</p>
        </div>
        <button onClick={onClear} aria-label="Hapus acuan" className="p-1 text-slate-400 hover:text-slate-700">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {diffs.length === 0 ? (
        <p className="text-[11px] text-slate-600">Belum ada perubahan dari acuan. Ubah pengaturan di panel kanan untuk membandingkan.</p>
      ) : (
        <>
          <ul className="text-[11px] text-slate-700 list-disc pl-4 space-y-0.5">
            {diffs.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <BeforeAfterBars before={refDaily.totalEnergyKWh} after={current.totalEnergyKWh} />
          <p className="text-[11px] text-slate-600">
            Rugi bayangan {fmt(refDaily.overallShadingLossPercent, 1)}% → <b>{fmt(current.overallShadingLossPercent, 1)}%</b>{' '}
            · selisih {signed((current.totalEnergyKWh - refDaily.totalEnergyKWh) * DAYS_IN_MONTH[inputs.month - 1], 1)} kWh
            per bulan {MONTH_NAMES_ID[inputs.month - 1]}.
          </p>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {diffs.length > 0 && (
          <button
            onClick={onRestore}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-[11px]"
          >
            <RotateCcw className="w-3 h-3" /> Kembalikan ke acuan
          </button>
        )}
        <button
          onClick={onSetReference}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-[11px]"
        >
          <Bookmark className="w-3 h-3" /> Jadikan kondisi sekarang acuan baru
        </button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Pembanding "bagaimana jika"                                         */
/* ------------------------------------------------------------------ */

type WhatIfTab = 'tilt' | 'pitch' | 'inverter';

export const WhatIfComparator: React.FC<{
  inputs: SimInputs;
  baseline: DailySimulationResult;
  onApplyPatch: (patch: Partial<PVArrayConfig>, label: string) => void;
}> = ({ inputs, baseline, onApplyPatch }) => {
  const [tab, setTab] = useState<WhatIfTab>('tilt');
  const cfg = inputs.arrayConfig;
  const tableLength = cfg.moduleCountY * cfg.moduleLength;
  const minPitch = calculateInterRowPitch(tableLength, cfg.tilt, 25).minRowPitch;
  const minPhysical = Math.ceil((tableLength * Math.cos((cfg.tilt * Math.PI) / 180) + 0.1) * 20) / 20;

  const options = useMemo(() => {
    if (tab === 'tilt') {
      return [0, 5, 10, 15, 20, 25, 30].map((t) => ({ key: `${t}`, label: `${t}°`, patch: { tilt: t } as Partial<PVArrayConfig>, current: cfg.tilt === t }));
    }
    if (tab === 'inverter') {
      return (['string', 'optimizer', 'microinverter'] as const).map((t) => ({
        key: t,
        label: INVERTER_LABEL[t],
        patch: { inverterType: t } as Partial<PVArrayConfig>,
        current: cfg.inverterType === t,
      }));
    }
    const r = (v: number) => Math.round(v * 20) / 20;
    const vals = Array.from(new Set([minPhysical, minPitch, r(minPitch + 0.5), r(minPitch + 1)]))
      .filter((v, i, arr) => arr.findIndex((x) => Math.abs(x - v) < 0.03) === i)
      .sort((a, b) => a - b);
    return vals.map((v) => ({
      key: v.toFixed(2),
      label: `${v.toFixed(2)} m${v === minPitch ? ' (minimum)' : v === minPhysical ? ' (paling rapat)' : ''}`,
      patch: { rowSpacing: v } as Partial<PVArrayConfig>,
      current: Math.abs(cfg.rowSpacing - v) < 0.01,
    }));
  }, [tab, cfg.tilt, cfg.inverterType, cfg.rowSpacing, minPitch, minPhysical]);

  const defaultKey = useMemo(() => {
    const firstOther = options.find((o) => !o.current);
    if (tab === 'tilt') {
      // Bawaan: sudut yang disarankan untuk lokasi ini (atau terdekat dengannya bila sudah dipakai).
      const recT = getRecommendedTilt(inputs.location.latitude).practicalRecommended;
      const best = options
        .filter((o) => !o.current)
        .sort((a, b) => Math.abs(Number(a.key) - recT) - Math.abs(Number(b.key) - recT))[0];
      return (best ?? firstOther)?.key;
    }
    if (tab === 'inverter') return options.find((o) => o.key === 'optimizer' && !o.current)?.key ?? firstOther?.key;
    return options.find((o) => o.label.includes('minimum') && !o.current)?.key ?? firstOther?.key;
  }, [options, tab, inputs.location.latitude]);

  const [picked, setPicked] = useState<string | undefined>(undefined);
  useEffect(() => setPicked(undefined), [tab]);
  const selected = options.find((o) => o.key === (picked ?? defaultKey)) ?? options[0];

  const target = useMemo(() => ({ ...cfg, ...selected.patch }), [cfg, selected]);
  const pair = useMemo(() => ({ inputs, target }), [inputs, target]);
  const dInputs = useDebounced(pair);

  const result = useMemo(() => {
    const { inputs: i, target: t } = dInputs;
    const afterDay = simulateFullDay(i.location, i.month, t, i.obstacles, i.sky);
    const beforeYear = simulateYear(i.location, i.arrayConfig, i.obstacles, i.sky);
    const afterYear = simulateYear(i.location, t, i.obstacles, i.sky);
    return { afterDay, beforeYear, afterYear };
  }, [dInputs]);
  const stale = dInputs !== pair;

  const pitchUnavailable = tab === 'pitch' && !cfg.frontRowEnabled;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg text-[11px] font-medium" role="tablist">
        {(
          [
            ['tilt', 'Kemiringan'],
            ['pitch', 'Jarak baris'],
            ['inverter', 'Inverter'],
          ] as [WhatIfTab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`py-1.5 rounded-md ${tab === id ? 'bg-white shadow-xs text-amber-700 font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {pitchUnavailable ? (
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-2">
          <p>
            Jarak baris hanya berpengaruh bila ada baris panel di depan. Aktifkan baris depan untuk menguji bayangan
            antarbaris.
          </p>
          <button
            onClick={() =>
              onApplyPatch({ frontRowEnabled: true, rowSpacing: Math.max(cfg.rowSpacing, minPhysical) }, 'Sebelum baris depan ditambahkan')
            }
            className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold"
          >
            Tambahkan baris panel di depan
          </button>
        </div>
      ) : (
        <>
          <div>
            <span className="text-[11px] text-slate-600 block mb-1">
              Sekarang:{' '}
              <b>
                {tab === 'tilt'
                  ? `${cfg.tilt}°`
                  : tab === 'inverter'
                  ? INVERTER_LABEL[cfg.inverterType]
                  : `${cfg.rowSpacing.toFixed(2)} m`}
              </b>
              . Bandingkan dengan:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {options.map((o) => (
                <button
                  key={o.key}
                  disabled={o.current}
                  onClick={() => setPicked(o.key)}
                  aria-pressed={o.key === selected.key}
                  className={`px-2 py-1 rounded text-[11px] border transition-colors ${
                    o.current
                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-default'
                      : o.key === selected.key
                      ? 'bg-amber-500 border-amber-500 text-white font-semibold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {o.label}
                  {o.current && ' (sekarang)'}
                </button>
              ))}
            </div>
          </div>

          {selected.current ? (
            <p className="text-[11px] text-slate-500">Pilih nilai lain untuk dibandingkan.</p>
          ) : (
            <div className={`space-y-3 transition-opacity ${stale ? 'opacity-50' : ''}`} aria-busy={stale}>
              <div>
                <span className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Per hari · bulan {MONTH_NAMES_ID[inputs.month - 1]}
                </span>
                <BeforeAfterBars before={baseline.totalEnergyKWh} after={result.afterDay.totalEnergyKWh} />
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Rugi bayangan {fmt(baseline.overallShadingLossPercent, 1)}% → {fmt(result.afterDay.overallShadingLossPercent, 1)}%
                </p>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-700 block mb-1">Per tahun</span>
                <BeforeAfterBars
                  before={result.beforeYear.annualKWh}
                  after={result.afterYear.annualKWh}
                  unit="kWh/tahun"
                  digits={0}
                />
              </div>
              {tab === 'tilt' && (
                <p className="text-[10px] text-slate-500 leading-snug">
                  Sudut terbaik bisa berbeda antara satu bulan dan angka setahun. Untuk keputusan desain, utamakan angka
                  tahunan. Kemiringan &lt; 10° juga menambah rugi kotoran dalam model ini.
                </p>
              )}
              {tab === 'inverter' && (
                <p className="text-[10px] text-slate-500 leading-snug">
                  Dalam model ini optimizer dan microinverter dihitung sama (MPPT per panel). Perbedaan biaya dan efisiensi
                  perangkat tidak diperhitungkan.
                </p>
              )}
              {tab === 'pitch' && (
                <p className="text-[10px] text-slate-500 leading-snug">
                  Jarak lebih lebar mengurangi bayangan antarbaris, tetapi butuh lahan lebih luas.
                </p>
              )}
              <button
                onClick={() => onApplyPatch(selected.patch, describePatch(tab, cfg))}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold"
              >
                Terapkan {selected.label.replace(' (minimum)', '').replace(' (paling rapat)', '')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

function describePatch(tab: WhatIfTab, cfg: PVArrayConfig): string {
  if (tab === 'tilt') return `Kemiringan ${cfg.tilt}°`;
  if (tab === 'inverter') return INVERTER_LABEL[cfg.inverterType];
  return `Jarak antarbaris ${cfg.rowSpacing.toFixed(2)} m`;
}

/* ------------------------------------------------------------------ */
/* Catatan estimasi                                                    */
/* ------------------------------------------------------------------ */

export const EstimateNote: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
      <p className="flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
        <span>
          <b className="text-slate-800">Hasil ini merupakan estimasi</b> berdasarkan asumsi simulasi, bukan jaminan produksi
          di lapangan. Gunakan untuk membandingkan pilihan desain, lalu verifikasi dengan pengukuran di lokasi atau perangkat
          lunak desain PLTS.
        </span>
      </p>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-1 ml-5 inline-flex items-center gap-1 text-sky-700 hover:text-sky-900 font-medium"
      >
        {open ? 'Sembunyikan asumsi' : 'Lihat asumsi simulasi'}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className={`mt-1.5 ml-5 list-disc pl-4 space-y-0.5 ${compact ? 'text-[10px]' : ''}`}>
          <li>Setiap bulan diwakili satu hari (tanggal 15), dihitung tiap 30 menit dari pukul 05:00 sampai 19:00.</li>
          <li>
            Cuaca memakai rata-rata iklim (indeks kecerahan K<sub>T</sub>), bukan data cuaca harian yang nyata. Hari mendung
            atau sangat cerah bisa jauh berbeda.
          </li>
          <li>Suhu udara dianggap pola tropis tipikal 26–32 °C; koefisien suhu panel −0,35%/°C, NOCT 45 °C.</li>
          <li>
            Rugi tetap: kotoran 2–10% (tergantung kemiringan), kabel & lain-lain 3%, efisiensi inverter 96%. Tidak termasuk
            degradasi tahunan, pemadaman, atau pembatasan daya inverter.
          </li>
          <li>
            Bentuk pohon, gedung, dan tembok disederhanakan; bayangan dihitung pada titik-titik sampel di permukaan panel.
          </li>
          <li>
            Efek string inverter memakai faktor penalti sederhana; optimizer dan microinverter dimodelkan sama.
          </li>
        </ul>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Panel gabungan                                                      */
/* ------------------------------------------------------------------ */

interface ResultsActionPanelProps {
  inputs: SimInputs;
  baseline: DailySimulationResult;
  insights: Insights;
  insightsStale: boolean;
  reference: ReferenceSnapshot | null;
  onApplyAction: (a: ActionItem) => void;
  onApplyPatch: (patch: Partial<PVArrayConfig>, label: string) => void;
  onSetReference: () => void;
  onRestoreReference: () => void;
  onClearReference: () => void;
}

export const ResultsActionPanel = React.forwardRef<HTMLDivElement, ResultsActionPanelProps & { highlight?: boolean }>(
  (
    {
      inputs,
      baseline,
      insights,
      insightsStale,
      reference,
      onApplyAction,
      onApplyPatch,
      onSetReference,
      onRestoreReference,
      onClearReference,
      highlight,
    },
    ref
  ) => (
    <section
      ref={ref}
      aria-labelledby="hasil-arahan-title"
      className={`scroll-mt-28 bg-white border border-slate-200 rounded-xl shadow-sm p-4 lg:p-5 space-y-4 transition-shadow duration-500 ${
        highlight ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-100' : ''
      }`}
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="hasil-arahan-title" className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-amber-500" />
            Hasil & arahan tindakan
          </h2>
          <p className="text-[11px] text-slate-500">
            {inputs.location.name} · bulan {MONTH_NAMES_ID[inputs.month - 1]} ·{' '}
            {inputs.sky.mode === 'climate' ? `cuaca rata-rata (KT ${inputs.sky.kt.toFixed(2)})` : 'langit cerah'}
          </p>
        </div>
        <TermHelp k="shadingLoss" label="Apa itu rugi bayangan?" />
      </div>

      <div className={`transition-opacity ${insightsStale ? 'opacity-60' : ''}`} aria-busy={insightsStale}>
        <ShadingSummaryCard insights={insights} month={inputs.month} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`space-y-2 transition-opacity ${insightsStale ? 'opacity-60' : ''}`}>
          <h3 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            Arahan tindakan (urut dari dampak terbesar)
          </h3>
          <ActionList actions={insights.actions} onApply={onApplyAction} lossPct={insights.summary.lossPct} />
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
            <GitCompare className="w-3.5 h-3.5 text-sky-600" />
            Bandingkan perubahan
          </h3>
          <ReferenceCompare
            inputs={inputs}
            current={baseline}
            reference={reference}
            onSetReference={onSetReference}
            onRestore={onRestoreReference}
            onClear={onClearReference}
          />
          <div className="p-3 rounded-xl border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5 mb-2">
              <FlaskConical className="w-3.5 h-3.5 text-slate-500" />
              Bagaimana jika…
            </span>
            <WhatIfComparator inputs={inputs} baseline={baseline} onApplyPatch={onApplyPatch} />
          </div>
        </div>
      </div>

      <EstimateNote />
    </section>
  )
);
ResultsActionPanel.displayName = 'ResultsActionPanel';

export type { ActionPatch };
