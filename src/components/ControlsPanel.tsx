import React, { useState } from 'react';
import {
  LocationConfig,
  PVArrayConfig,
  ObstacleConfig,
  ObstacleType,
  SkyConfig,
  PanelColorMode,
} from '../types/solar';
import {
  CITIES_INDONESIA,
  MONTH_NAMES_ID,
  getRecommendedTilt,
  getDayOfYear,
  climateDailyGHI,
} from '../utils/solarMath';
import { calculateInterRowPitch } from '../utils/shadingMath';
import { PANEL_COLOR_OPTIONS } from './Solar3DViewport';
import { TermHelp, AdvancedSection, compassName } from './TermHelp';
import {
  Sun,
  Compass,
  Trees,
  MapPin,
  Calendar,
  Plus,
  Trash2,
  ArrowUp,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Palette,
  PanelTop,
  Zap,
  Lightbulb,
  BarChart3,
} from 'lucide-react';

export type ControlsStep = 'lokasi' | 'panel' | 'rintangan';

interface ControlsPanelProps {
  location: LocationConfig;
  setLocation: (loc: LocationConfig) => void;
  month: number;
  setMonth: (m: number) => void;
  hour: number;
  setHour: (h: number) => void;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
  arrayConfig: PVArrayConfig;
  setArrayConfig: React.Dispatch<React.SetStateAction<PVArrayConfig>>;
  obstacles: ObstacleConfig[];
  setObstacles: React.Dispatch<React.SetStateAction<ObstacleConfig[]>>;
  sky: SkyConfig;
  setSky: (s: SkyConfig) => void;
  panelColorMode?: PanelColorMode;
  setPanelColorMode?: (mode: PanelColorMode) => void;
  /** Dipanggil oleh tombol "Lihat hasil" di langkah terakhir. */
  onShowResults?: () => void;
}

const STEPS: { id: ControlsStep; no: number; label: string; icon: React.ReactNode }[] = [
  { id: 'lokasi', no: 1, label: 'Lokasi', icon: <MapPin className="w-3.5 h-3.5" /> },
  { id: 'panel', no: 2, label: 'Panel', icon: <PanelTop className="w-3.5 h-3.5" /> },
  { id: 'rintangan', no: 3, label: 'Rintangan', icon: <Trees className="w-3.5 h-3.5" /> },
];

/** Kelas tombol pilihan (chip) yang konsisten. */
export const chipClass = (active: boolean, extra = '') =>
  `px-2 py-1 rounded text-[11px] transition-colors ${
    active ? 'bg-amber-500 text-white font-semibold' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
  } ${extra}`;

export const TILT_PRESETS = [
  { val: 0, label: '0° Datar' },
  { val: 10, label: '10° Landai' },
  { val: 15, label: '15° Atap umum' },
  { val: 30, label: '30° Curam' },
];

export const FACING_PRESETS = [
  { val: 0, label: 'Utara' },
  { val: 90, label: 'Timur' },
  { val: 180, label: 'Selatan' },
  { val: 270, label: 'Barat' },
];

export const HEIGHT_PRESETS = [
  { label: 'Di tanah (0,8 m)', val: 0.8 },
  { label: 'Atap datar (1,5 m)', val: 1.5 },
  { label: 'Kanopi/carport (3 m)', val: 3.0 },
  { label: 'Atap lantai 1 (6 m)', val: 6.0 },
  { label: 'Atap gedung (12 m)', val: 12.0 },
];

export const OBSTACLE_TYPE_LABEL: Record<ObstacleType, string> = {
  tree: 'pohon',
  building: 'gedung',
  wall: 'tembok',
  pole: 'tiang',
  front_row: 'baris depan',
};

export function makeObstacle(type: ObstacleType): ObstacleConfig {
  return {
    id: `obs_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    type,
    name:
      type === 'tree'
        ? 'Pohon Baru'
        : type === 'building'
        ? 'Gedung Tetangga'
        : type === 'wall'
        ? 'Tembok Parapet'
        : type === 'pole'
        ? 'Tiang Listrik'
        : 'Baris Depan',
    enabled: true,
    distance: 6,
    azimuth: 90, // Timur (bayangan pagi)
    height: 6,
    width: type === 'tree' ? 4 : type === 'wall' ? 8 : 4,
    depth: type === 'building' ? 5 : 0.3,
    baseElevation: 0,
  };
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  location,
  setLocation,
  month,
  setMonth,
  arrayConfig,
  setArrayConfig,
  obstacles,
  setObstacles,
  sky,
  setSky,
  panelColorMode = 'high_contrast',
  setPanelColorMode,
  onShowResults,
}) => {
  const [step, setStep] = useState<ControlsStep>('lokasi');
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const recTilt = getRecommendedTilt(location.latitude);
  const doy = getDayOfYear(month, 15);
  const monthGHI = climateDailyGHI(location.latitude, doy, sky.kt);
  const tableLength = arrayConfig.moduleCountY * arrayConfig.moduleLength;
  const minPitchInfo = calculateInterRowPitch(tableLength, arrayConfig.tilt, 25);
  const minPhysicalPitch = Math.ceil((tableLength * Math.cos((arrayConfig.tilt * Math.PI) / 180) + 0.1) * 20) / 20;
  const totalKWp = (arrayConfig.moduleCountX * arrayConfig.moduleCountY * arrayConfig.moduleWattage) / 1000;

  const handleCityChange = (cityName: string) => {
    const found = CITIES_INDONESIA.find((c) => c.name === cityName);
    if (found) setLocation(found);
  };

  const toggleObstacle = (id: string) =>
    setObstacles((prev) => prev.map((o) => (o.id === id ? { ...o, enabled: !o.enabled } : o)));

  const updateObstacle = (id: string, updates: Partial<ObstacleConfig>) =>
    setObstacles((prev) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)));

  const addObstacle = (type: ObstacleType) => setObstacles((prev) => [...prev, makeObstacle(type)]);

  const removeObstacle = (id: string) => setObstacles((prev) => prev.filter((o) => o.id !== id));

  const facingName = compassName(arrayConfig.azimuth);

  return (
    <div className="bg-white border border-slate-200 rounded-xl flex flex-col h-full overflow-hidden shadow-sm">
      {/* Langkah 1-2-3 */}
      <div className="p-1.5 bg-slate-50 border-b border-slate-200">
        <ol className="grid grid-cols-3 gap-1 text-xs font-medium" aria-label="Langkah pengaturan">
          {STEPS.map((s, i) => {
            const active = s.id === step;
            const done = i < stepIndex;
            return (
              <li key={s.id}>
                <button
                  onClick={() => setStep(s.id)}
                  aria-current={active ? 'step' : undefined}
                  className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors justify-center ${
                    active
                      ? 'bg-white text-amber-700 font-semibold shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center shrink-0 ${
                      active ? 'bg-amber-500 text-white' : done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {s.no}
                  </span>
                  <span>
                    {s.label}
                    {s.id === 'rintangan' && (
                      <span className="text-slate-400 font-normal"> ({obstacles.filter((o) => o.enabled).length})</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Isi */}
      <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
        {/* LANGKAH 1: LOKASI */}
        {step === 'lokasi' && (
          <div className="space-y-4">
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Pilih lokasi dan bulan. Keduanya menentukan jalur matahari di langit sehingga arah dan panjang bayangan ikut
              berubah.
            </p>

            <div>
              <label htmlFor="cp-city" className="block text-slate-800 font-semibold mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-500" />
                Kota
              </label>
              <select
                id="cp-city"
                value={location.name}
                onChange={(e) => handleCityChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white"
              >
                {!CITIES_INDONESIA.some((c) => c.name === location.name) && (
                  <option value={location.name}>{location.name} (lokasi kustom)</option>
                )}
                {CITIES_INDONESIA.map((city) => (
                  <option key={city.name} value={city.name}>
                    {city.name}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1 font-mono">
                {Math.abs(location.latitude).toFixed(2)}° {location.latitude < 0 ? 'LS' : 'LU'} ·{' '}
                {location.longitude.toFixed(2)}° BT
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block text-slate-800 font-semibold mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-500" />
                  Bulan
                </span>
                <span className="font-mono text-amber-600 font-bold">{MONTH_NAMES_ID[month - 1]}</span>
              </label>
              <input
                type="range"
                min="1"
                max="12"
                step="1"
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                aria-label="Bulan"
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5 font-mono">
                <span>Jan</span>
                <span>Jun</span>
                <span>Des</span>
              </div>
              <TermHelp k="month" label="Mengapa bulan berpengaruh?" className="mt-1.5" />
            </div>

            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed flex gap-2">
              <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Untuk lokasi ini, panel sebaiknya <b>menghadap {recTilt.recommendedAzimuth === 0 ? 'Utara' : 'Selatan'}</b>{' '}
                dengan <b>kemiringan sekitar {recTilt.practicalRecommended}°</b>. Atur di langkah 2.
              </span>
            </div>

            <p className="text-[11px] text-slate-500 px-1">
              Jam simulasi dan tombol <b>Putar Matahari</b> ada tepat di bawah tampilan 3D.
            </p>

            <AdvancedSection summary="Garis lintang kustom, model cuaca & indeks kecerahan langit">
              {/* Lintang kustom */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-700 font-semibold">Garis lintang kustom</span>
                  <span className="font-mono text-slate-900 font-semibold">
                    {location.latitude > 0
                      ? `+${location.latitude.toFixed(1)}° (Utara)`
                      : `${location.latitude.toFixed(1)}° (Selatan)`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-15"
                  max="15"
                  step="0.5"
                  value={location.latitude}
                  onChange={(e) =>
                    setLocation({
                      ...location,
                      name: `Kustom (${parseFloat(e.target.value)}°)`,
                      latitude: parseFloat(e.target.value),
                    })
                  }
                  aria-label="Garis lintang"
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-0.5 font-mono">
                  <span>15° LS</span>
                  <span>0° Khatulistiwa</span>
                  <span>15° LU</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  Menggeser ini hanya mengubah lintang dan menjadikan lokasi <b>Kustom</b>; bujur & zona waktu tetap dari
                  kota terakhir.
                </p>
                <TermHelp k="latitude" className="mt-1" />
              </div>

              {/* Model cuaca */}
              <div>
                <span className="font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  Model cuaca
                </span>
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  <button
                    onClick={() => setSky({ ...sky, mode: 'climate' })}
                    className={chipClass(sky.mode === 'climate', 'py-1.5')}
                  >
                    Rata-rata iklim
                  </button>
                  <button
                    onClick={() => setSky({ ...sky, mode: 'clearsky' })}
                    className={chipClass(sky.mode === 'clearsky', 'py-1.5')}
                  >
                    Langit cerah (batas atas)
                  </button>
                </div>
                <TermHelp k="skyMode" />
                {sky.mode === 'climate' && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">
                        Indeks kecerahan langit (K<sub>T</sub>)
                      </span>
                      <span className="font-mono font-bold text-amber-600">{sky.kt.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.3"
                      max="0.75"
                      step="0.01"
                      value={sky.kt}
                      onChange={(e) => setSky({ ...sky, kt: parseFloat(e.target.value) })}
                      aria-label="Indeks kecerahan langit"
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-0.5 font-mono">
                      <span>0.30 Mendung</span>
                      <span>0.50 Tipikal</span>
                      <span>0.75 Cerah</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">
                      Radiasi horizontal rata-rata bulan ini:{' '}
                      <b className="font-mono text-slate-800">{monthGHI.toFixed(2)} kWh/m²/hari</b>.
                    </p>
                    <TermHelp k="kt" className="mt-1" />
                  </div>
                )}
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 text-[11px] leading-relaxed">
                <span className="font-semibold block text-slate-800 mb-0.5">Catatan teknis wilayah tropis</span>
                {recTilt.explanation}
              </div>
            </AdvancedSection>
          </div>
        )}

        {/* LANGKAH 2: KONFIGURASI PANEL */}
        {step === 'panel' && (
          <div className="space-y-4">
            {/* Kemiringan panel */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-800">Kemiringan panel</span>
                <span className="font-mono text-base font-bold text-amber-600 tabular-nums">{arrayConfig.tilt}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                step="1"
                value={arrayConfig.tilt}
                onChange={(e) => setArrayConfig({ ...arrayConfig, tilt: parseInt(e.target.value) })}
                aria-label="Kemiringan panel"
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex flex-wrap gap-1.5">
                {TILT_PRESETS.map((p) => (
                  <button
                    key={p.val}
                    onClick={() => setArrayConfig({ ...arrayConfig, tilt: p.val })}
                    className={chipClass(arrayConfig.tilt === p.val)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {arrayConfig.tilt < 10 && (
                <p className="text-[11px] text-amber-800 bg-amber-100/70 p-2 rounded border border-amber-300">
                  ⚠️ Panel yang terlalu landai (&lt; 10°) mudah tergenang air dan berdebu, sehingga produksi bisa turun
                  5–12% dan perlu lebih sering dibersihkan.
                </p>
              )}
              <TermHelp k="tilt" />
            </div>

            {/* Arah hadap panel */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-amber-500" />
                  Arah hadap panel
                </span>
                <span className="font-mono text-sm font-bold text-amber-600 tabular-nums">
                  {facingName} ({arrayConfig.azimuth}°)
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1 text-center">
                {FACING_PRESETS.map((p) => (
                  <button
                    key={p.val}
                    onClick={() => setArrayConfig({ ...arrayConfig, azimuth: p.val })}
                    className={chipClass(arrayConfig.azimuth === p.val, 'py-1')}
                  >
                    {p.label}
                    {p.val === recTilt.recommendedAzimuth && <span className="block text-[9px] opacity-80">disarankan</span>}
                  </button>
                ))}
              </div>
              <input
                type="range"
                min="0"
                max="360"
                step="5"
                value={arrayConfig.azimuth}
                onChange={(e) => setArrayConfig({ ...arrayConfig, azimuth: parseInt(e.target.value) })}
                aria-label="Arah hadap panel dalam derajat"
                className="w-full accent-amber-500 cursor-pointer"
              />
              <TermHelp k="azimuth" />
            </div>

            {/* Jumlah & daya panel */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="font-semibold text-slate-800 block">Jumlah & daya panel</span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cp-cols" className="text-slate-600 block mb-1">Panel per baris</label>
                  <select
                    id="cp-cols"
                    value={arrayConfig.moduleCountX}
                    onChange={(e) => setArrayConfig({ ...arrayConfig, moduleCountX: parseInt(e.target.value) })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
                  >
                    {[2, 4, 6, 8].map((n) => (
                      <option key={n} value={n}>{n} panel</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="cp-rows" className="text-slate-600 block mb-1">Jumlah baris</label>
                  <select
                    id="cp-rows"
                    value={arrayConfig.moduleCountY}
                    onChange={(e) => setArrayConfig({ ...arrayConfig, moduleCountY: parseInt(e.target.value) })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>{n} baris</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="cp-wp" className="text-slate-600 block mb-1">Daya per panel</label>
                <select
                  id="cp-wp"
                  value={arrayConfig.moduleWattage}
                  onChange={(e) => setArrayConfig({ ...arrayConfig, moduleWattage: parseInt(e.target.value) })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
                >
                  <option value={450}>450 Wp (monokristal)</option>
                  <option value={550}>550 Wp (umum dipakai)</option>
                  <option value={650}>650 Wp (daya tinggi)</option>
                </select>
              </div>
              <p className="text-[11px] text-slate-700">
                {arrayConfig.moduleCountX * arrayConfig.moduleCountY} panel · kapasitas{' '}
                <b className="font-mono">{totalKWp.toFixed(2)} kWp</b>
              </p>
              <TermHelp k="wp" label="Apa itu Wp dan kWp?" />
            </div>

            {/* Tinggi pemasangan */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <ArrowUp className="w-3.5 h-3.5 text-amber-500" />
                  Tinggi pemasangan panel
                </span>
                <span className="font-mono text-base font-bold text-amber-600 tabular-nums">
                  {arrayConfig.mountHeight.toFixed(1)} <span className="text-xs text-slate-500 font-normal">m</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {HEIGHT_PRESETS.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => setArrayConfig({ ...arrayConfig, mountHeight: item.val })}
                    className={chipClass(Math.abs(arrayConfig.mountHeight - item.val) < 0.2)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <input
                type="range"
                min="0.2"
                max="20"
                step="0.1"
                value={arrayConfig.mountHeight}
                onChange={(e) => setArrayConfig({ ...arrayConfig, mountHeight: parseFloat(e.target.value) })}
                aria-label="Tinggi pemasangan panel"
                className="w-full accent-amber-500 cursor-pointer"
              />
              <TermHelp k="mountHeight" />
            </div>

            <AdvancedSection summary="Jenis inverter, baris panel di depan (jarak antarbaris), warna panel 3D">
              {/* Inverter */}
              <div>
                <span className="font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  Jenis inverter
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed mb-2">
                  Menentukan seberapa besar satu panel yang terbayang ikut menurunkan panel lainnya.
                </p>
                <div className="space-y-2">
                  {[
                    {
                      id: 'string' as const,
                      title: 'String inverter (seri)',
                      tag: 'Biaya terendah',
                      tagCls: 'text-amber-700 bg-amber-100',
                      activeCls: 'bg-amber-50/80 border-amber-400',
                      desc: 'Panel dirangkai seri. Jika satu panel terbayang, arus seluruh rangkaian ikut turun kecuali bypass diode bekerja (rugi mismatch 20–50%).',
                    },
                    {
                      id: 'optimizer' as const,
                      title: 'String inverter + optimizer',
                      tag: 'Disarankan',
                      tagCls: 'text-sky-700 bg-sky-100',
                      activeCls: 'bg-sky-50/80 border-sky-400',
                      desc: 'Setiap panel punya pengatur DC sendiri (MPPT tingkat modul). Panel yang terbayang tidak menurunkan panel lain.',
                    },
                    {
                      id: 'microinverter' as const,
                      title: 'Microinverter (per panel)',
                      tag: 'Performa maksimal',
                      tagCls: 'text-emerald-700 bg-emerald-100',
                      activeCls: 'bg-emerald-50/80 border-emerald-400',
                      desc: 'Setiap panel diubah ke AC langsung di bawahnya. Kinerja tiap panel sepenuhnya mandiri.',
                    },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setArrayConfig({ ...arrayConfig, inverterType: opt.id })}
                      aria-pressed={arrayConfig.inverterType === opt.id}
                      className={`w-full text-left block p-2.5 rounded-xl border transition-colors ${
                        arrayConfig.inverterType === opt.id
                          ? `${opt.activeCls} text-slate-900 shadow-xs`
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="font-semibold text-xs text-slate-900">{opt.title}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${opt.tagCls}`}>{opt.tag}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-snug">{opt.desc}</p>
                    </button>
                  ))}
                </div>
                <TermHelp k="inverter" className="mt-1.5" />
              </div>

              {/* Baris depan */}
              <div>
                <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!arrayConfig.frontRowEnabled}
                    onChange={(e) =>
                      setArrayConfig({
                        ...arrayConfig,
                        frontRowEnabled: e.target.checked,
                        rowSpacing: Math.max(arrayConfig.rowSpacing, minPhysicalPitch),
                      })
                    }
                    className="accent-amber-500"
                  />
                  Tambahkan baris panel di depan
                </label>
                <p className="text-[11px] text-slate-500 mt-1">
                  Menguji bayangan antarbaris (self-shading) dengan menambah baris identik di depan array.
                </p>
                {arrayConfig.frontRowEnabled && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">Jarak antarbaris (pitch, d)</span>
                      <span className="font-mono font-bold text-amber-600">{arrayConfig.rowSpacing.toFixed(2)} m</span>
                    </div>
                    <input
                      type="range"
                      min={minPhysicalPitch}
                      max={Math.max(12, minPitchInfo.minRowPitch + 3)}
                      step="0.05"
                      value={arrayConfig.rowSpacing}
                      onChange={(e) => setArrayConfig({ ...arrayConfig, rowSpacing: parseFloat(e.target.value) })}
                      aria-label="Jarak antarbaris"
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <div className="flex items-center justify-between text-[11px] mt-1">
                      <span className="text-slate-600">
                        Minimum (matahari ≥ 25°): <b className="font-mono">{minPitchInfo.minRowPitch.toFixed(2)} m</b>
                      </span>
                      <button
                        onClick={() => setArrayConfig({ ...arrayConfig, rowSpacing: minPitchInfo.minRowPitch })}
                        className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                      >
                        Gunakan minimum
                      </button>
                    </div>
                    <p
                      className={`text-[11px] mt-1.5 ${
                        arrayConfig.rowSpacing < minPitchInfo.minRowPitch ? 'text-rose-600' : 'text-emerald-700'
                      }`}
                    >
                      {arrayConfig.rowSpacing < minPitchInfo.minRowPitch
                        ? 'Lebih rapat dari minimum, baris belakang akan terbayang pada pagi/sore hari.'
                        : 'Jarak memenuhi batas minimum untuk ketinggian matahari ≥ 25°.'}{' '}
                      Panjang meja searah kemiringan: {tableLength.toFixed(2)} m.
                    </p>
                  </div>
                )}
                <TermHelp k="pitch" className="mt-1.5" />
              </div>

              {/* Warna panel */}
              <div className="space-y-2">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-amber-500" />
                  Warna panel di tampilan 3D
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {PANEL_COLOR_OPTIONS.map((opt) => {
                    const isSelected = panelColorMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setPanelColorMode?.(opt.id)}
                        aria-pressed={isSelected}
                        className={`p-2 rounded-lg text-left text-xs transition-all border flex flex-col gap-1 ${
                          isSelected
                            ? 'bg-amber-500 text-white border-amber-600 shadow-xs font-medium'
                            : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`w-3.5 h-3.5 rounded-full border shrink-0 ${opt.swatchClass} ${opt.borderClass}`}
                          />
                          <span className="font-semibold truncate">{opt.shortLabel}</span>
                        </span>
                        <span
                          className={`text-[10px] leading-tight line-clamp-2 ${isSelected ? 'text-amber-50' : 'text-slate-500'}`}
                        >
                          {opt.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500">
                  <b>Perak</b> membuat siluet bayangan paling tajam; <b>Biru Langit</b> lebih mirip panel asli.
                </p>
              </div>
            </AdvancedSection>
          </div>
        )}

        {/* LANGKAH 3: RINTANGAN */}
        {step === 'rintangan' && (
          <div className="space-y-4">
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Tambahkan benda di sekitar panel yang bisa menimbulkan bayangan, lalu atur jaraknya, di sisi mana letaknya,
              dan seberapa tinggi.
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-slate-800 mr-auto">Tambah:</span>
              {(['tree', 'building', 'wall'] as ObstacleType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => addObstacle(t)}
                  className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded flex items-center gap-1 text-[11px]"
                >
                  <Plus className="w-3 h-3 text-amber-500" />
                  {t === 'tree' ? 'Pohon' : t === 'building' ? 'Gedung' : 'Tembok'}
                </button>
              ))}
            </div>

            {obstacles.length === 0 ? (
              <div className="p-4 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                Belum ada rintangan, sehingga panel 100% bebas bayangan.
              </div>
            ) : (
              obstacles.map((obs) => {
                const baseElev = obs.baseElevation || 0;
                const totalObsPeak = baseElev + obs.height;
                const isObstacleLower = totalObsPeak <= arrayConfig.mountHeight;

                return (
                  <div
                    key={obs.id}
                    className={`p-3 rounded-xl border transition-colors ${
                      obs.enabled ? 'bg-slate-50/70 border-slate-300 shadow-xs' : 'bg-slate-100/40 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-2 cursor-pointer min-w-0">
                        <input
                          type="checkbox"
                          checked={obs.enabled}
                          onChange={() => toggleObstacle(obs.id)}
                          className="rounded accent-amber-500"
                        />
                        <span className="font-semibold text-slate-800 truncate">{obs.name}</span>
                        <span className="text-[10px] text-slate-500 shrink-0">({OBSTACLE_TYPE_LABEL[obs.type]})</span>
                      </label>
                      <button
                        onClick={() => removeObstacle(obs.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                        title="Hapus rintangan"
                        aria-label={`Hapus ${obs.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {obs.enabled && (
                      <div className="space-y-2.5 pt-1.5 border-t border-slate-200 text-[11px]">
                        {/* Jarak */}
                        <div>
                          <div className="flex justify-between text-slate-600 mb-0.5">
                            <span>{obs.type === 'building' ? 'Jarak panel ke dinding gedung' : 'Jarak dari panel'}</span>
                            <span className="font-mono text-slate-800 font-semibold">{obs.distance} m</span>
                          </div>
                          <input
                            type="range"
                            min="1.5"
                            max="30"
                            step="0.5"
                            value={obs.distance}
                            onChange={(e) => updateObstacle(obs.id, { distance: parseFloat(e.target.value) })}
                            aria-label={`Jarak ${obs.name}`}
                            className="w-full accent-amber-500 cursor-pointer"
                          />
                        </div>

                        {/* Arah letak */}
                        <div>
                          <div className="flex justify-between text-slate-600 mb-0.5">
                            <span>Arah letak rintangan</span>
                            <span className="font-mono text-slate-800 font-semibold">
                              {compassName(obs.azimuth)} ({obs.azimuth}°)
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-1 mb-1">
                            {FACING_PRESETS.map((p) => (
                              <button
                                key={p.val}
                                onClick={() => updateObstacle(obs.id, { azimuth: p.val })}
                                className={chipClass(obs.azimuth === p.val, 'py-0.5 text-[10px]')}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="355"
                            step="5"
                            value={obs.azimuth}
                            onChange={(e) => updateObstacle(obs.id, { azimuth: parseInt(e.target.value) })}
                            aria-label={`Arah letak ${obs.name}`}
                            className="w-full accent-amber-500 cursor-pointer"
                          />
                          <TermHelp k="obstacleAzimuth" className="mt-0.5" />
                        </div>

                        {/* Tinggi */}
                        <div>
                          <div className="flex justify-between text-slate-600 mb-0.5">
                            <span>Tinggi rintangan</span>
                            <span className="font-mono text-amber-600 font-bold">{obs.height} m</span>
                          </div>
                          <input
                            type="range"
                            min="0.5"
                            max="25"
                            step="0.5"
                            value={obs.height}
                            onChange={(e) => updateObstacle(obs.id, { height: parseFloat(e.target.value) })}
                            aria-label={`Tinggi ${obs.name}`}
                            className="w-full accent-amber-500 cursor-pointer"
                          />
                        </div>

                        {/* Status ketinggian relatif */}
                        <div
                          className={`p-2 rounded-lg text-[10px] flex items-start gap-1.5 ${
                            isObstacleLower
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {isObstacleLower ? (
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <span className="font-semibold block">
                              Puncak rintangan {totalObsPeak.toFixed(1)} m · panel {arrayConfig.mountHeight.toFixed(1)} m
                            </span>
                            {isObstacleLower ? (
                              <span>Panel lebih tinggi dari puncak rintangan sehingga terhindar dari bayangannya.</span>
                            ) : (
                              <span>
                                Rintangan {(totalObsPeak - arrayConfig.mountHeight).toFixed(1)} m lebih tinggi dari panel dan
                                bisa menimbulkan bayangan.
                              </span>
                            )}
                          </div>
                        </div>

                        <AdvancedSection
                          summary={
                            obs.type === 'building'
                              ? 'Tinggi dasar, lebar & panjang gedung'
                              : 'Tinggi dasar & lebar rintangan'
                          }
                        >
                          {/* Elevasi dasar */}
                          <div>
                            <div className="flex justify-between text-slate-600 mb-0.5">
                              <span>Tinggi dasar rintangan</span>
                              <span className="font-mono text-sky-600 font-bold">{baseElev} m</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="20"
                              step="0.5"
                              value={baseElev}
                              onChange={(e) => updateObstacle(obs.id, { baseElevation: parseFloat(e.target.value) })}
                              aria-label={`Tinggi dasar ${obs.name}`}
                              className="w-full accent-sky-500 cursor-pointer"
                            />
                            <TermHelp k="baseElevation" className="mt-0.5" />
                          </div>

                          {obs.type === 'building' ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-700">Ukuran gedung</span>
                                <span className="font-mono text-[10px] text-slate-500">
                                  {obs.width} × {obs.depth || 5} × {obs.height} m
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {[
                                  { label: 'Rumah 1 lt', w: 8, d: 10, h: 4.5 },
                                  { label: 'Ruko 2 lt', w: 4.5, d: 15, h: 8 },
                                  { label: 'Ruko 3 lt', w: 5, d: 15, h: 11.5 },
                                  { label: 'Kantor 4 lt', w: 16, d: 12, h: 15 },
                                ].map((pr) => {
                                  const active = obs.width === pr.w && (obs.depth || 5) === pr.d && obs.height === pr.h;
                                  return (
                                    <button
                                      key={pr.label}
                                      onClick={() => updateObstacle(obs.id, { width: pr.w, depth: pr.d, height: pr.h })}
                                      className={chipClass(active, 'py-0.5 text-[10px]')}
                                      title={`${pr.w} m × ${pr.d} m, tinggi ${pr.h} m`}
                                    >
                                      {pr.label}
                                    </button>
                                  );
                                })}
                              </div>
                              <div>
                                <div className="flex justify-between text-slate-600 mb-0.5">
                                  <span>Lebar (sisi yang menghadap panel)</span>
                                  <span className="font-mono text-slate-800 font-semibold">{obs.width} m</span>
                                </div>
                                <input
                                  type="range"
                                  min="2"
                                  max="30"
                                  step="0.5"
                                  value={obs.width}
                                  onChange={(e) => updateObstacle(obs.id, { width: parseFloat(e.target.value) })}
                                  aria-label={`Lebar ${obs.name}`}
                                  className="w-full accent-amber-500 cursor-pointer"
                                />
                              </div>
                              <div>
                                <div className="flex justify-between text-slate-600 mb-0.5">
                                  <span>Panjang (menjauhi panel)</span>
                                  <span className="font-mono text-slate-800 font-semibold">{obs.depth || 5} m</span>
                                </div>
                                <input
                                  type="range"
                                  min="2"
                                  max="30"
                                  step="0.5"
                                  value={obs.depth || 5}
                                  onChange={(e) => updateObstacle(obs.id, { depth: parseFloat(e.target.value) })}
                                  aria-label={`Panjang ${obs.name}`}
                                  className="w-full accent-amber-500 cursor-pointer"
                                />
                              </div>
                              <p className="text-[10px] text-slate-500 leading-snug">
                                Lebar menentukan seberapa lebar bayangan menyapu panel; panjang berpengaruh saat matahari
                                rendah dari samping gedung.
                              </p>
                            </div>
                          ) : (
                            <div>
                              <div className="flex justify-between text-slate-600 mb-0.5">
                                <span>Lebar rintangan</span>
                                <span className="font-mono text-slate-800 font-semibold">{obs.width} m</span>
                              </div>
                              <input
                                type="range"
                                min="0.5"
                                max="20"
                                step="0.5"
                                value={obs.width}
                                onChange={(e) => updateObstacle(obs.id, { width: parseFloat(e.target.value) })}
                                aria-label={`Lebar ${obs.name}`}
                                className="w-full accent-amber-500 cursor-pointer"
                              />
                            </div>
                          )}
                        </AdvancedSection>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Navigasi langkah */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-slate-200 bg-slate-50 text-xs">
        {stepIndex > 0 ? (
          <button
            onClick={() => setStep(STEPS[stepIndex - 1].id)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {STEPS[stepIndex - 1].label}
          </button>
        ) : (
          <span />
        )}
        {stepIndex < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(STEPS[stepIndex + 1].id)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold"
          >
            Lanjut: {STEPS[stepIndex + 1].label}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={onShowResults}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Lihat hasil
          </button>
        )}
      </div>
    </div>
  );
};
