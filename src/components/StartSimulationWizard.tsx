import React, { useEffect, useRef, useState } from 'react';
import {
  LocationConfig,
  PVArrayConfig,
  ObstacleConfig,
  ObstacleType,
  DailySimulationResult,
} from '../types/solar';
import { CITIES_INDONESIA, MONTH_NAMES_ID, getRecommendedTilt } from '../utils/solarMath';
import { TermHelp, compassName } from './TermHelp';
import { ShadingSummaryCard, ActionList, EstimateNote } from './ResultsActionPanel';
import { Insights, ActionItem, fmt } from '../utils/insights';
import {
  chipClass,
  TILT_PRESETS,
  FACING_PRESETS,
  HEIGHT_PRESETS,
  OBSTACLE_TYPE_LABEL,
  makeObstacle,
} from './ControlsPanel';
import {
  X,
  MapPin,
  PanelTop,
  Trees,
  BarChart3,
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Sun,
  Lightbulb,
  FileText,
  Box,
} from 'lucide-react';

type WizardStep = 0 | 1 | 2 | 3;

const STEPS = [
  { title: 'Lokasi', icon: MapPin, lead: 'Di mana panel surya akan dipasang?' },
  { title: 'Panel', icon: PanelTop, lead: 'Bagaimana panel dipasang?' },
  { title: 'Rintangan', icon: Trees, lead: 'Adakah benda tinggi di sekitar panel?' },
  { title: 'Hasil', icon: BarChart3, lead: 'Berapa listrik yang dihasilkan?' },
];

interface StartSimulationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenReport: () => void;
  location: LocationConfig;
  setLocation: (loc: LocationConfig) => void;
  month: number;
  setMonth: (m: number) => void;
  arrayConfig: PVArrayConfig;
  setArrayConfig: React.Dispatch<React.SetStateAction<PVArrayConfig>>;
  obstacles: ObstacleConfig[];
  setObstacles: React.Dispatch<React.SetStateAction<ObstacleConfig[]>>;
  dailyResult: DailySimulationResult;
  insights: Insights;
  insightsStale: boolean;
  onApplyAction: (a: ActionItem) => void;
}

/**
 * Alur "Mulai simulasi" untuk pengguna baru:
 * lokasi → konfigurasi panel → rintangan → hasil.
 * Semua perubahan langsung diterapkan ke simulasi utama, sehingga
 * setelah wizard ditutup tampilan 3D sudah sesuai pilihan pengguna.
 */
export const StartSimulationWizard: React.FC<StartSimulationWizardProps> = ({
  isOpen,
  onClose,
  onOpenReport,
  location,
  setLocation,
  month,
  setMonth,
  arrayConfig,
  setArrayConfig,
  obstacles,
  setObstacles,
  dailyResult,
  insights,
  insightsStale,
  onApplyAction,
}) => {
  const [step, setStep] = useState<WizardStep>(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const rec = getRecommendedTilt(location.latitude);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Hanya berjalan saat panduan dibuka/ditutup, bukan setiap kali pengaturan berubah.
  useEffect(() => {
    if (!isOpen) return;
    setStep(0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!isOpen) return null;

  const updateObstacle = (id: string, updates: Partial<ObstacleConfig>) =>
    setObstacles((prev) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)));
  const addObstacle = (type: ObstacleType) => setObstacles((prev) => [...prev, makeObstacle(type)]);
  const removeObstacle = (id: string) => setObstacles((prev) => prev.filter((o) => o.id !== id));
  const disableAllObstacles = () => setObstacles((prev) => prev.map((o) => ({ ...o, enabled: false })));

  const activeObstacles = obstacles.filter((o) => o.enabled);
  const totalPanels = arrayConfig.moduleCountX * arrayConfig.moduleCountY;
  const totalKWp = (totalPanels * arrayConfig.moduleWattage) / 1000;
  const loss = dailyResult.overallShadingLossPercent;
  const lossLevel = loss < 3 ? 'kecil' : loss <= 10 ? 'sedang' : 'besar';
  const lossColor =
    loss < 3 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : loss <= 10 ? 'text-amber-800 bg-amber-50 border-amber-200' : 'text-rose-700 bg-rose-50 border-rose-200';

  const StepIcon = STEPS[step].icon;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-title"
        className="bg-white w-full sm:max-w-xl max-h-[92vh] sm:max-h-[88vh] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col outline-none text-xs text-slate-800"
      >
        {/* Kepala */}
        <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide">
                Mulai simulasi · langkah {step + 1} dari 4
              </p>
              <h2 id="wizard-title" className="text-base font-bold text-slate-900 flex items-center gap-2 mt-0.5">
                <StepIcon className="w-4 h-4 text-amber-500" />
                {STEPS[step].lead}
              </h2>
            </div>
            <button
              onClick={onClose}
              aria-label="Tutup panduan"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Penanda langkah */}
          <ol className="grid grid-cols-4 gap-1.5 mt-3" aria-label="Langkah">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <button
                  onClick={() => setStep(i as WizardStep)}
                  aria-current={i === step ? 'step' : undefined}
                  className="w-full text-left group"
                >
                  <span
                    className={`block h-1.5 rounded-full ${
                      i < step ? 'bg-emerald-500' : i === step ? 'bg-amber-500' : 'bg-slate-200 group-hover:bg-slate-300'
                    }`}
                  />
                  <span
                    className={`block mt-1 text-[10px] sm:text-[11px] ${
                      i === step ? 'text-slate-900 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    {i + 1}. {s.title}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        {/* Isi */}
        <div className="px-4 sm:px-5 py-4 overflow-y-auto flex-1 space-y-4">
          {step === 0 && (
            <>
              <div>
                <label htmlFor="wz-city" className="block font-semibold mb-1.5">Kota terdekat</label>
                <select
                  id="wz-city"
                  value={location.name}
                  onChange={(e) => {
                    const c = CITIES_INDONESIA.find((x) => x.name === e.target.value);
                    if (c) setLocation(c);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 focus:bg-white"
                >
                  {!CITIES_INDONESIA.some((c) => c.name === location.name) && (
                    <option value={location.name}>{location.name} (lokasi kustom)</option>
                  )}
                  {CITIES_INDONESIA.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Lokasi menentukan seberapa tinggi matahari melintas dan ke arah mana panel sebaiknya menghadap.
                </p>
              </div>

              <div>
                <span className="block font-semibold mb-1.5">Bulan yang ingin dilihat</span>
                <div className="grid grid-cols-6 gap-1.5">
                  {MONTH_NAMES_ID.map((m, i) => (
                    <button
                      key={m}
                      onClick={() => setMonth(i + 1)}
                      aria-pressed={month === i + 1}
                      className={chipClass(month === i + 1, 'py-1.5')}
                    >
                      {m.slice(0, 3)}
                    </button>
                  ))}
                </div>
                <TermHelp k="month" label="Mengapa bulan berpengaruh?" className="mt-1.5" />
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed flex gap-2">
                <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Saran untuk {location.name}: panel <b>menghadap {rec.recommendedAzimuth === 0 ? 'Utara' : 'Selatan'}</b>{' '}
                  dengan <b>kemiringan sekitar {rec.practicalRecommended}°</b>.
                </span>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Kemiringan panel</span>
                  <span className="font-mono text-base font-bold text-amber-600">{arrayConfig.tilt}°</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {TILT_PRESETS.map((p) => (
                    <button
                      key={p.val}
                      onClick={() => setArrayConfig((c) => ({ ...c, tilt: p.val }))}
                      className={chipClass(arrayConfig.tilt === p.val, 'py-1.5')}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="1"
                  value={arrayConfig.tilt}
                  onChange={(e) => setArrayConfig((c) => ({ ...c, tilt: parseInt(e.target.value) }))}
                  aria-label="Kemiringan panel"
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <TermHelp k="tilt" />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Arah hadap panel</span>
                  <span className="font-mono font-bold text-amber-600">{compassName(arrayConfig.azimuth)}</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {FACING_PRESETS.map((p) => (
                    <button
                      key={p.val}
                      onClick={() => setArrayConfig((c) => ({ ...c, azimuth: p.val }))}
                      aria-pressed={arrayConfig.azimuth === p.val}
                      className={chipClass(arrayConfig.azimuth === p.val, 'py-2')}
                    >
                      {p.label}
                      {p.val === rec.recommendedAzimuth && <span className="block text-[9px] opacity-80">disarankan</span>}
                    </button>
                  ))}
                </div>
                <TermHelp k="azimuth" />
              </div>

              <div className="space-y-2">
                <span className="font-semibold block">Jumlah panel</span>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-slate-600 block mb-1">Panel per baris</span>
                    <select
                      value={arrayConfig.moduleCountX}
                      onChange={(e) => setArrayConfig((c) => ({ ...c, moduleCountX: parseInt(e.target.value) }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2"
                    >
                      {[2, 4, 6, 8].map((n) => (
                        <option key={n} value={n}>{n} panel</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-slate-600 block mb-1">Jumlah baris</span>
                    <select
                      value={arrayConfig.moduleCountY}
                      onChange={(e) => setArrayConfig((c) => ({ ...c, moduleCountY: parseInt(e.target.value) }))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2"
                    >
                      {[1, 2, 3, 4].map((n) => (
                        <option key={n} value={n}>{n} baris</option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="text-[11px] text-slate-700">
                  {totalPanels} panel × {arrayConfig.moduleWattage} Wp = <b className="font-mono">{totalKWp.toFixed(2)} kWp</b>
                </p>
              </div>

              <div className="space-y-2">
                <span className="font-semibold block">Dipasang di mana?</span>
                <div className="flex flex-wrap gap-1.5">
                  {HEIGHT_PRESETS.map((h) => (
                    <button
                      key={h.label}
                      onClick={() => setArrayConfig((c) => ({ ...c, mountHeight: h.val }))}
                      className={chipClass(Math.abs(arrayConfig.mountHeight - h.val) < 0.2, 'py-1.5')}
                    >
                      {h.label}
                    </button>
                  ))}
                </div>
                <TermHelp k="mountHeight" />
              </div>

              <p className="text-[11px] text-slate-500">
                Jenis inverter, daya per panel, dan baris panel di depan bisa diatur nanti di <b>Pengaturan lanjutan</b>.
              </p>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <button
                  onClick={disableAllObstacles}
                  className={chipClass(activeObstacles.length === 0, 'py-2')}
                >
                  Tidak ada
                </button>
                {(['tree', 'building', 'wall'] as ObstacleType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => addObstacle(t)}
                    className="py-2 rounded text-[11px] bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3 h-3 text-amber-500" />
                    {t === 'tree' ? 'Pohon' : t === 'building' ? 'Gedung' : 'Tembok'}
                  </button>
                ))}
              </div>

              {obstacles.length === 0 && (
                <p className="p-3 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  Belum ada rintangan. Panel dianggap bebas bayangan.
                </p>
              )}

              <div className="space-y-2.5">
                {obstacles.map((o) => (
                  <div
                    key={o.id}
                    className={`p-3 rounded-xl border ${o.enabled ? 'bg-slate-50 border-slate-300' : 'bg-white border-slate-200 opacity-60'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 font-semibold cursor-pointer min-w-0">
                        <input
                          type="checkbox"
                          checked={o.enabled}
                          onChange={() => updateObstacle(o.id, { enabled: !o.enabled })}
                          className="accent-amber-500"
                        />
                        <span className="truncate">{o.name}</span>
                        <span className="text-[10px] text-slate-500 font-normal shrink-0">({OBSTACLE_TYPE_LABEL[o.type]})</span>
                      </label>
                      <button
                        onClick={() => removeObstacle(o.id)}
                        aria-label={`Hapus ${o.name}`}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {o.enabled && (
                      <div className="mt-2 pt-2 border-t border-slate-200 space-y-2 text-[11px]">
                        <div>
                          <span className="text-slate-600 block mb-1">Letaknya di sisi mana dari panel?</span>
                          <div className="grid grid-cols-4 gap-1">
                            {FACING_PRESETS.map((p) => (
                              <button
                                key={p.val}
                                onClick={() => updateObstacle(o.id, { azimuth: p.val })}
                                className={chipClass(compassName(o.azimuth) === p.label, 'py-1')}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                          <TermHelp k="obstacleAzimuth" label="Apa pengaruh arahnya?" className="mt-1" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="block">
                            <span className="flex justify-between text-slate-600 mb-0.5">
                              Jarak <b className="font-mono text-slate-800">{o.distance} m</b>
                            </span>
                            <input
                              type="range"
                              min="1.5"
                              max="30"
                              step="0.5"
                              value={o.distance}
                              onChange={(e) => updateObstacle(o.id, { distance: parseFloat(e.target.value) })}
                              className="w-full accent-amber-500"
                            />
                          </label>
                          <label className="block">
                            <span className="flex justify-between text-slate-600 mb-0.5">
                              Tinggi <b className="font-mono text-slate-800">{o.height} m</b>
                            </span>
                            <input
                              type="range"
                              min="0.5"
                              max="25"
                              step="0.5"
                              value={o.height}
                              onChange={(e) => updateObstacle(o.id, { height: parseFloat(e.target.value) })}
                              className="w-full accent-amber-500"
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl border border-slate-200 bg-white">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Sun className="w-3.5 h-3.5 text-amber-500" /> Listrik per hari
                  </span>
                  <span className="block text-xl font-bold font-mono text-slate-900 mt-0.5">
                    {fmt(dailyResult.totalEnergyKWh, 1)} <span className="text-xs font-medium text-slate-500">kWh</span>
                  </span>
                  <span className="text-[10px] text-slate-500">rata-rata bulan {MONTH_NAMES_ID[month - 1]}</span>
                </div>
                <div className={`p-3 rounded-xl border ${lossColor}`}>
                  <span className="text-[11px] flex items-center gap-1">Hilang karena bayangan</span>
                  <span className="block text-xl font-bold font-mono mt-0.5">{fmt(loss, 1)}%</span>
                  <span className="text-[10px]">
                    {fmt(dailyResult.energyLostKWh)} kWh/hari · tergolong {lossLevel}
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 bg-white">
                  <span className="text-[11px] text-slate-500">Kapasitas PLTS</span>
                  <span className="block text-base font-bold font-mono text-slate-900 mt-0.5">{totalKWp.toFixed(2)} kWp</span>
                  <span className="text-[10px] text-slate-500">{totalPanels} panel</span>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 bg-white">
                  <span className="text-[11px] text-slate-500">Per 1 kWp</span>
                  <span className="block text-base font-bold font-mono text-slate-900 mt-0.5">
                    {dailyResult.specificYieldKWhPerKWp.toFixed(2)} <span className="text-xs font-medium">kWh/kWp</span>
                  </span>
                  <span className="text-[10px] text-slate-500">PR {(dailyResult.performanceRatio * 100).toFixed(0)}%</span>
                </div>
              </div>

              <p className="text-[12px] leading-relaxed text-slate-700">
                Dengan {totalPanels} panel menghadap {compassName(arrayConfig.azimuth)} dan miring {arrayConfig.tilt}°
                di {location.name}, PLTS ini menghasilkan sekitar <b>{fmt(dailyResult.totalEnergyKWh, 1)} kWh per hari</b>{' '}
                pada bulan {MONTH_NAMES_ID[month - 1]}.
              </p>

              <div className={`transition-opacity ${insightsStale ? 'opacity-60' : ''}`} aria-busy={insightsStale}>
                <ShadingSummaryCard insights={insights} month={month} compact />
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <TermHelp k="shadingLoss" label="Apa itu rugi bayangan?" />
                <TermHelp k="specificYield" label="Apa itu kWh/kWp?" />
                <TermHelp k="pr" label="Apa itu PR?" />
              </div>

              <div className={`space-y-2 transition-opacity ${insightsStale ? 'opacity-60' : ''}`}>
                <span className="font-semibold flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" /> Arahan tindakan
                </span>
                <ActionList
                  actions={insights.actions}
                  onApply={onApplyAction}
                  limit={3}
                  lossPct={insights.summary.lossPct}
                />
                {insights.actions.length > 0 && (
                  <p className="text-[10px] text-slate-500">
                    Setelah menekan tombol, kondisi sebelumnya disimpan sebagai acuan. Perbandingan sebelum/sesudah dan
                    pembanding kemiringan, jarak baris, serta inverter ada di bagian <b>Hasil & arahan tindakan</b> di bawah
                    tampilan 3D.
                  </p>
                )}
              </div>

              <EstimateNote compact />

              <p className="text-[11px] text-slate-500">
                Tutup panduan untuk melihat bayangan bergerak di tampilan 3D. Semua pilihan tadi bisa diubah lagi di panel
                kanan, dan parameter teknis ada di <b>Pengaturan lanjutan</b>.
              </p>
            </>
          )}
        </div>

        {/* Kaki */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          {step > 0 ? (
            <button
              onClick={() => setStep((s) => (s - 1) as WizardStep)}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-slate-600 hover:bg-white border border-transparent hover:border-slate-200"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Kembali
            </button>
          ) : (
            <button onClick={onClose} className="px-3 py-2 rounded-lg text-slate-500 hover:text-slate-800">
              Lewati panduan
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as WizardStep)}
              className="flex items-center gap-1 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold"
            >
              Lanjut: {STEPS[step + 1].title} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onClose();
                  onOpenReport();
                }}
                className="flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              >
                <FileText className="w-3.5 h-3.5" /> Laporan
              </button>
              <button
                onClick={onClose}
                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold"
              >
                <Box className="w-3.5 h-3.5" /> Lihat simulasi 3D
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
