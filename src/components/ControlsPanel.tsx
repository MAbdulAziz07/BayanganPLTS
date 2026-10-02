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
  solarNoonClock,
  timeZoneLabel,
  formatClock,
} from '../utils/solarMath';
import { calculateInterRowPitch } from '../utils/shadingMath';
import { PANEL_COLOR_OPTIONS } from './Solar3DViewport';
import {
  Sun,
  Compass,
  Layers,
  Trees,
  Zap,
  Play,
  Pause,
  MapPin,
  Calendar,
  Clock,
  Plus,
  Trash2,
  ArrowUp,
  ShieldCheck,
  ShieldAlert,
  Palette,
} from 'lucide-react';

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
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  location,
  setLocation,
  month,
  setMonth,
  hour,
  setHour,
  isPlaying,
  setIsPlaying,
  arrayConfig,
  setArrayConfig,
  obstacles,
  setObstacles,
  sky,
  setSky,
  panelColorMode = 'high_contrast',
  setPanelColorMode,
}) => {
  const [activeSection, setActiveSection] = useState<'time_loc' | 'slope_array' | 'obstacles' | 'electrical'>('time_loc');

  const recTilt = getRecommendedTilt(location.latitude);

  const formatHour = formatClock;
  const tzLabel = timeZoneLabel(location.timezoneOffset);
  const doy = getDayOfYear(month, 15);
  const noonClock = solarNoonClock(location.longitude, location.timezoneOffset, doy);
  const monthGHI = climateDailyGHI(location.latitude, doy, sky.kt);
  const tableLength = arrayConfig.moduleCountY * arrayConfig.moduleLength;
  const minPitchInfo = calculateInterRowPitch(tableLength, arrayConfig.tilt, 25);
  const minPhysicalPitch = Math.ceil((tableLength * Math.cos((arrayConfig.tilt * Math.PI) / 180) + 0.1) * 20) / 20;

  const handleCityChange = (cityName: string) => {
    const found = CITIES_INDONESIA.find((c) => c.name === cityName);
    if (found) {
      setLocation(found);
    }
  };

  const toggleObstacle = (id: string) => {
    setObstacles((prev) =>
      prev.map((o) => (o.id === id ? { ...o, enabled: !o.enabled } : o))
    );
  };

  const updateObstacle = (id: string, updates: Partial<ObstacleConfig>) => {
    setObstacles((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...updates } : o))
    );
  };

  const addObstacle = (type: ObstacleType) => {
    const newId = `obs_${Date.now()}`;
    const defaultObs: ObstacleConfig = {
      id: newId,
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
      azimuth: 90, // East (morning shadow)
      height: 6,
      width: type === 'tree' ? 4 : type === 'wall' ? 8 : 4,
      depth: type === 'building' ? 5 : 0.3,
      baseElevation: 0,
    };
    setObstacles((prev) => [...prev, defaultObs]);
  };

  const removeObstacle = (id: string) => {
    setObstacles((prev) => prev.filter((o) => o.id !== id));
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl flex flex-col h-full overflow-hidden shadow-sm">
      {/* Top Segmented Tabs for Controls - Bright Theme */}
      <div className="flex items-center p-1.5 bg-slate-50 border-b border-slate-200 gap-1 text-xs font-medium overflow-x-auto">
        <button
          onClick={() => setActiveSection('time_loc')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
            activeSection === 'time_loc'
              ? 'bg-white text-amber-600 font-semibold shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-500" />
          <span>Waktu & Lokasi</span>
        </button>
        <button
          onClick={() => setActiveSection('slope_array')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
            activeSection === 'slope_array'
              ? 'bg-white text-amber-600 font-semibold shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-amber-500" />
          <span>Slope & Dudukan PLTS</span>
        </button>
        <button
          onClick={() => setActiveSection('obstacles')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
            activeSection === 'obstacles'
              ? 'bg-white text-amber-600 font-semibold shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Trees className="w-3.5 h-3.5 text-amber-500" />
          <span>Rintangan Bayangan ({obstacles.filter((o) => o.enabled).length})</span>
        </button>
        <button
          onClick={() => setActiveSection('electrical')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
            activeSection === 'electrical'
              ? 'bg-white text-amber-600 font-semibold shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          <span>Inverter & Mitigasi</span>
        </button>
      </div>

      {/* Content Body of Panel */}
      <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
        {/* SECTION 1: WAKTU & LOKASI */}
        {activeSection === 'time_loc' && (
          <div className="space-y-4">
            {/* Lokasi Kota */}
            <div>
              <label className="block text-slate-800 font-semibold mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-500" />
                  Kota / Koordinat Wilayah
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  {location.latitude.toFixed(2)}° Lintang
                </span>
              </label>
              <select
                value={location.name}
                onChange={(e) => handleCityChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white"
              >
                {CITIES_INDONESIA.map((city) => (
                  <option key={city.name} value={city.name}>
                    {city.name} ({city.latitude > 0 ? `${city.latitude}° N` : `${Math.abs(city.latitude)}° S`})
                  </option>
                ))}
              </select>
            </div>

            {/* Slider Lintang Kustom */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center mb-1">
                <span className="text-slate-600 font-medium">Garis Lintang (Latitude):</span>
                <span className="font-mono text-slate-900 font-semibold">
                  {location.latitude > 0 ? `+${location.latitude.toFixed(1)}° (Utara)` : `${location.latitude.toFixed(1)}° (Selatan)`}
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
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5 font-mono">
                <span>15° S (Selatan)</span>
                <span>0° (Khatulistiwa)</span>
                <span>15° N (Utara)</span>
              </div>
            </div>

            {/* Bulan dalam Setahun */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block text-slate-800 font-semibold mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-500" />
                  Bulan Pengamatan
                </span>
                <span className="font-mono text-amber-600 font-bold">
                  {MONTH_NAMES_ID[month - 1]}
                </span>
              </label>
              <input
                type="range"
                min="1"
                max="12"
                step="1"
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5 font-mono">
                <span>Jan (Solstis Des)</span>
                <span>Jun (Solstis Jun)</span>
                <span>Des</span>
              </div>
            </div>

            {/* Kondisi Langit / Model Iklim */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  Kondisi Langit (Model Radiasi)
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                <button
                  onClick={() => setSky({ ...sky, mode: 'climate' })}
                  className={`py-1.5 rounded-lg text-[11px] transition-colors ${
                    sky.mode === 'climate' ? 'bg-amber-500 text-white font-semibold' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Rata-rata Iklim (KT)
                </button>
                <button
                  onClick={() => setSky({ ...sky, mode: 'clearsky' })}
                  className={`py-1.5 rounded-lg text-[11px] transition-colors ${
                    sky.mode === 'clearsky' ? 'bg-amber-500 text-white font-semibold' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Langit Cerah (Batas Atas)
                </button>
              </div>
              {sky.mode === 'climate' ? (
                <>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">Indeks Kecerahan Langit (K<sub>T</sub>):</span>
                    <span className="font-mono font-bold text-amber-600">{sky.kt.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.3"
                    max="0.75"
                    step="0.01"
                    value={sky.kt}
                    onChange={(e) => setSky({ ...sky, kt: parseFloat(e.target.value) })}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-0.5 font-mono">
                    <span>0.30 Mendung</span>
                    <span>0.50 Tipikal</span>
                    <span>0.75 Cerah</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">
                    Radiasi horizontal rata-rata bulan ini: <b className="font-mono text-slate-800">{monthGHI.toFixed(2)} kWh/m²/hari</b>.
                    Sesuaikan K<sub>T</sub> hingga angka ini sama dengan data lokasi Anda (Global Solar Atlas / NASA POWER).
                  </p>
                </>
              ) : (
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Model langit tanpa awan — menghasilkan produksi maksimum teoretis. Gunakan hanya sebagai pembanding.
                </p>
              )}
            </div>

            {/* Jam & Playback Animasi Matahari */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  Waktu Simulasi
                </span>
                <span className="font-mono text-base font-bold text-amber-600 tabular-nums">
                  {formatHour(hour)} {tzLabel}
                </span>
              </div>

              <input
                type="range"
                min="5"
                max="19"
                step="0.1"
                value={hour}
                onChange={(e) => setHour(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />

              <div className="flex items-center justify-between mt-2.5">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs transition-colors shadow-xs ${
                    isPlaying
                      ? 'bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100'
                      : 'bg-amber-500 text-white font-semibold hover:bg-amber-600'
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Jeda Animasi</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>Putar Lintasan Matahari</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1">
                  {[7, 9, 12, 15, 17].map((h) => (
                    <button
                      key={h}
                      onClick={() => setHour(h)}
                      className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                        Math.abs(hour - h) < 0.3
                          ? 'bg-amber-500 text-white font-bold'
                          : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      {h}:00
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Jam dalam waktu lokal ({tzLabel}). Matahari tertinggi (tengah hari surya) pada{' '}
                <b className="font-mono text-slate-700">{formatHour(noonClock)} {tzLabel}</b> — bergeser karena bujur lokasi
                ({location.longitude.toFixed(1)}° BT) dan equation of time.
              </p>
            </div>

            {/* Rekomendasi Sudut Berdasarkan Lokasi */}
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
              <span className="font-semibold block text-amber-800 mb-1">
                Catatan Teknis Wilayah Tropis:
              </span>
              {recTilt.explanation}
            </div>
          </div>
        )}

        {/* SECTION 2: SLOPE, ORIENTASI & DUDUKAN PLTS */}
        {activeSection === 'slope_array' && (
          <div className="space-y-4">
            {/* Sudut Kemiringan / Slope (Tilt) */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  Sudut Kemiringan / Slope (Tilt β)
                </span>
                <span className="font-mono text-base font-bold text-amber-600 tabular-nums">
                  {arrayConfig.tilt}°
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="60"
                step="1"
                value={arrayConfig.tilt}
                onChange={(e) =>
                  setArrayConfig({ ...arrayConfig, tilt: parseInt(e.target.value) })
                }
                className="w-full accent-amber-500 cursor-pointer"
              />

              <div className="flex items-center justify-between text-[11px] pt-1">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setArrayConfig({ ...arrayConfig, tilt: 0 })}
                    className={`px-2 py-1 rounded transition-colors ${
                      arrayConfig.tilt === 0
                        ? 'bg-amber-500 text-white font-semibold'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    0° Flat
                  </button>
                  <button
                    onClick={() => setArrayConfig({ ...arrayConfig, tilt: 10 })}
                    className={`px-2 py-1 rounded transition-colors ${
                      arrayConfig.tilt === 10
                        ? 'bg-amber-500 text-white font-semibold'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    10° Optimal
                  </button>
                  <button
                    onClick={() => setArrayConfig({ ...arrayConfig, tilt: 15 })}
                    className={`px-2 py-1 rounded transition-colors ${
                      arrayConfig.tilt === 15
                        ? 'bg-amber-500 text-white font-semibold'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    15° Atap Standar
                  </button>
                  <button
                    onClick={() => setArrayConfig({ ...arrayConfig, tilt: 30 })}
                    className={`px-2 py-1 rounded transition-colors ${
                      arrayConfig.tilt === 30
                        ? 'bg-amber-500 text-white font-semibold'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    30° Curam
                  </button>
                </div>
              </div>

              {arrayConfig.tilt < 10 && (
                <p className="text-[11px] text-amber-800 bg-amber-100/70 p-2 rounded border border-amber-300">
                  ⚠️ <b>Peringatan Slope Rendah:</b> Kemiringan &lt; 10° rentan akumulasi genangan air dan debu (soiling loss 5-12%), memerlukan pembersihan manual lebih sering.
                </p>
              )}
            </div>

            {/* KETINGGIAN PEMASANGAN PLTS (VARIABLE TAMBAHAN) */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <ArrowUp className="w-3.5 h-3.5 text-amber-500" />
                  Ketinggian Pemasangan PLTS (H-Mount)
                </span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-base font-bold text-amber-600 tabular-nums">
                    {arrayConfig.mountHeight.toFixed(1)}
                  </span>
                  <span className="text-xs text-slate-500">meter</span>
                </div>
              </div>

              <input
                type="range"
                min="0.2"
                max="20"
                step="0.1"
                value={arrayConfig.mountHeight}
                onChange={(e) =>
                  setArrayConfig({ ...arrayConfig, mountHeight: parseFloat(e.target.value) })
                }
                className="w-full accent-amber-500 cursor-pointer"
              />

              {/* Quick Presets Ketinggian Pemasangan */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { label: '0.8m Ground', val: 0.8 },
                  { label: '1.5m Atap Datar', val: 1.5 },
                  { label: '3.0m Kanopi/Carport', val: 3.0 },
                  { label: '6.0m Atap Lt 1', val: 6.0 },
                  { label: '12.0m Gedung', val: 12.0 },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => setArrayConfig({ ...arrayConfig, mountHeight: item.val })}
                    className={`px-2 py-1 rounded text-[11px] transition-colors ${
                      Math.abs(arrayConfig.mountHeight - item.val) < 0.2
                        ? 'bg-amber-500 text-white font-semibold'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <p className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200">
                💡 <b>Pengaruh Ketinggian PLTS:</b> Ketinggian posisi panel menentukan elevasi relatif terhadap pohon atau dinding sekitar. Array yang dipasang tinggi (misal di atap gedung 6–12m) dapat melompati rintangan rendah di bawahnya.
              </p>
            </div>

            {/* Orientasi / Azimuth Hadap */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-amber-500" />
                  Arah Orientasi / Azimuth Hadap (γ)
                </span>
                <span className="font-mono text-base font-bold text-amber-600 tabular-nums">
                  {arrayConfig.azimuth}° (
                  {arrayConfig.azimuth === 0
                    ? 'Utara'
                    : arrayConfig.azimuth === 90
                    ? 'Timur'
                    : arrayConfig.azimuth === 180
                    ? 'Selatan'
                    : arrayConfig.azimuth === 270
                    ? 'Barat'
                    : `${arrayConfig.azimuth}°`}
                  )
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="360"
                step="5"
                value={arrayConfig.azimuth}
                onChange={(e) =>
                  setArrayConfig({ ...arrayConfig, azimuth: parseInt(e.target.value) })
                }
                className="w-full accent-amber-500 cursor-pointer"
              />

              <div className="grid grid-cols-4 gap-1 text-center pt-1">
                <button
                  onClick={() => setArrayConfig({ ...arrayConfig, azimuth: 0 })}
                  className={`py-1 rounded text-[11px] ${
                    arrayConfig.azimuth === 0
                      ? 'bg-amber-500 text-white font-bold'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Utara (0°)
                </button>
                <button
                  onClick={() => setArrayConfig({ ...arrayConfig, azimuth: 90 })}
                  className={`py-1 rounded text-[11px] ${
                    arrayConfig.azimuth === 90
                      ? 'bg-amber-500 text-white font-bold'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Timur (90°)
                </button>
                <button
                  onClick={() => setArrayConfig({ ...arrayConfig, azimuth: 180 })}
                  className={`py-1 rounded text-[11px] ${
                    arrayConfig.azimuth === 180
                      ? 'bg-amber-500 text-white font-bold'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Selatan (180°)
                </button>
                <button
                  onClick={() => setArrayConfig({ ...arrayConfig, azimuth: 270 })}
                  className={`py-1 rounded text-[11px] ${
                    arrayConfig.azimuth === 270
                      ? 'bg-amber-500 text-white font-bold'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Barat (270°)
                </button>
              </div>
            </div>

            {/* Susunan Array Modul */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-600 block mb-1 font-medium">Modul per Baris (Kolom):</label>
                <select
                  value={arrayConfig.moduleCountX}
                  onChange={(e) =>
                    setArrayConfig({ ...arrayConfig, moduleCountX: parseInt(e.target.value) })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
                >
                  <option value={2}>2 Modul</option>
                  <option value={4}>4 Modul</option>
                  <option value={6}>6 Modul</option>
                  <option value={8}>8 Modul</option>
                </select>
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-medium">Jumlah Baris (Row):</label>
                <select
                  value={arrayConfig.moduleCountY}
                  onChange={(e) =>
                    setArrayConfig({ ...arrayConfig, moduleCountY: parseInt(e.target.value) })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
                >
                  <option value={1}>1 Baris</option>
                  <option value={2}>2 Baris</option>
                  <option value={3}>3 Baris</option>
                  <option value={4}>4 Baris</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-slate-600 block mb-1 font-medium">Daya per Modul (Wp):</label>
              <select
                value={arrayConfig.moduleWattage}
                onChange={(e) =>
                  setArrayConfig({ ...arrayConfig, moduleWattage: parseInt(e.target.value) })
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
              >
                <option value={450}>450 Wp (Monocrystalline)</option>
                <option value={550}>550 Wp (Tier-1 Bifacial/Mono)</option>
                <option value={650}>650 Wp (High Power Utility)</option>
              </select>
              <span className="text-[11px] text-slate-500 mt-1 block font-mono">
                Total Kapasitas: {((arrayConfig.moduleCountX * arrayConfig.moduleCountY * arrayConfig.moduleWattage) / 1000).toFixed(2)} kWp
              </span>
            </div>

            {/* WARNA PANEL SURYA (MEMPERMUDAH MELIHAT BAYANGAN) */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs sm:text-sm">
                  <Palette className="w-4 h-4 text-amber-500" />
                  Warna Panel (Visibilitas Bayangan)
                </span>
                <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {PANEL_COLOR_OPTIONS.find((c) => c.id === panelColorMode)?.shortLabel || 'Kontras'}
                </span>
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed">
                Pilih warna modul untuk mempertegas kontras bayangan rintangan (pohon/gedung) pada permukaan sel:
              </p>

              <div className="grid grid-cols-2 gap-2">
                {PANEL_COLOR_OPTIONS.map((opt) => {
                  const isSelected = panelColorMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setPanelColorMode?.(opt.id)}
                      className={`p-2 rounded-lg text-left text-xs transition-all border flex flex-col gap-1 ${
                        isSelected
                          ? 'bg-amber-500 text-white border-amber-600 shadow-xs font-medium'
                          : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 w-full">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-3.5 h-3.5 rounded-full border shadow-2xs shrink-0 ${opt.swatchClass} ${opt.borderClass}`}
                          />
                          <span className="font-semibold truncate">{opt.shortLabel}</span>
                        </div>
                        {isSelected && (
                          <span className="text-[10px] bg-white/25 px-1 py-0.2 rounded font-bold shrink-0">
                            Aktif
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] leading-tight line-clamp-2 ${isSelected ? 'text-amber-50' : 'text-slate-500'}`}>
                        {opt.description}
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200">
                💡 <b>Rekomendasi:</b> Gunakan warna <b>Perak (Kontras Tinggi)</b> atau <b>Kuning Emas</b> agar siluet bayangan pohon, gedung sekitar, atau baris depan terlihat sangat tajam dan tidak tertutup warna biru tua gelap.
              </p>
            </div>

            {/* Baris PLTS di depan (multi-baris / self-shading) */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
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
                Simulasikan Baris PLTS di Depan (Multi-Baris)
              </label>
              <p className="text-[11px] text-slate-500 mt-1">
                Menambahkan baris modul identik di depan array (arah hadap) untuk menguji bayangan antarbaris (self-shading).
              </p>
              {arrayConfig.frontRowEnabled && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">Jarak Pitch Antar Baris (d):</span>
                    <span className="font-mono font-bold text-amber-600">{arrayConfig.rowSpacing.toFixed(2)} m</span>
                  </div>
                  <input
                    type="range"
                    min={minPhysicalPitch}
                    max={Math.max(12, minPitchInfo.minRowPitch + 3)}
                    step="0.05"
                    value={arrayConfig.rowSpacing}
                    onChange={(e) => setArrayConfig({ ...arrayConfig, rowSpacing: parseFloat(e.target.value) })}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[11px] mt-1">
                    <span className="text-slate-600">
                      Minimum (α = 25°): <b className="font-mono">{minPitchInfo.minRowPitch.toFixed(2)} m</b>
                    </span>
                    <button
                      onClick={() => setArrayConfig({ ...arrayConfig, rowSpacing: minPitchInfo.minRowPitch })}
                      className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                    >
                      Gunakan Minimum
                    </button>
                  </div>
                  <p className={`text-[11px] mt-1.5 ${arrayConfig.rowSpacing < minPitchInfo.minRowPitch ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {arrayConfig.rowSpacing < minPitchInfo.minRowPitch
                      ? `Pitch lebih rapat dari minimum — baris belakang akan terbayang pada pagi/sore hari.`
                      : `Pitch memenuhi batas minimum untuk elevasi matahari ≥ 25°.`}{' '}
                    Panjang meja searah kemiringan: {tableLength.toFixed(2)} m.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 3: RINTANGAN & BAYANGAN (DENGAN VARIABLE TINGGI & ELEVASI DASAR) */}
        {activeSection === 'obstacles' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">Daftar Rintangan Sekitar</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => addObstacle('tree')}
                  className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded flex items-center gap-1 text-[11px]"
                >
                  <Plus className="w-3 h-3 text-amber-500" /> Pohon
                </button>
                <button
                  onClick={() => addObstacle('building')}
                  className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded flex items-center gap-1 text-[11px]"
                >
                  <Plus className="w-3 h-3 text-amber-500" /> Gedung
                </button>
                <button
                  onClick={() => addObstacle('wall')}
                  className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded flex items-center gap-1 text-[11px]"
                >
                  <Plus className="w-3 h-3 text-amber-500" /> Parapet
                </button>
              </div>
            </div>

            {obstacles.length === 0 ? (
              <div className="p-4 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                Tidak ada rintangan di sekitar array PLTS (100% bebas bayangan).
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
                      obs.enabled
                        ? 'bg-slate-50/70 border-slate-300 shadow-xs'
                        : 'bg-slate-100/40 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={obs.enabled}
                          onChange={() => toggleObstacle(obs.id)}
                          className="rounded accent-amber-500"
                        />
                        <span className="font-semibold text-slate-800">
                          {obs.name}
                        </span>
                        <span className="text-[10px] text-slate-500 uppercase font-mono">
                          ({obs.type})
                        </span>
                      </div>

                      <button
                        onClick={() => removeObstacle(obs.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                        title="Hapus Rintangan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {obs.enabled && (
                      <div className="space-y-2.5 pt-1.5 border-t border-slate-200 text-[11px]">
                        {/* Jarak */}
                        <div>
                          <div className="flex justify-between text-slate-600 mb-0.5">
                            <span>Jarak Horizontal ke Array:</span>
                            <span className="font-mono text-slate-800 font-semibold">{obs.distance} meter</span>
                          </div>
                          <input
                            type="range"
                            min="1.5"
                            max="30"
                            step="0.5"
                            value={obs.distance}
                            onChange={(e) =>
                              updateObstacle(obs.id, { distance: parseFloat(e.target.value) })
                            }
                            className="w-full accent-amber-500 cursor-pointer"
                          />
                        </div>

                        {/* Posisi Azimuth */}
                        <div>
                          <div className="flex justify-between text-slate-600 mb-0.5">
                            <span>Arah Posisi (Azimuth):</span>
                            <span className="font-mono text-slate-800 font-semibold">
                              {obs.azimuth}° (
                              {obs.azimuth <= 45 || obs.azimuth >= 315
                                ? 'Utara'
                                : obs.azimuth <= 135
                                ? 'Timur (Bayang Pagi)'
                                : obs.azimuth <= 225
                                ? 'Selatan'
                                : 'Barat (Bayang Sore)'}
                              )
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="355"
                            step="5"
                            value={obs.azimuth}
                            onChange={(e) =>
                              updateObstacle(obs.id, { azimuth: parseInt(e.target.value) })
                            }
                            className="w-full accent-amber-500 cursor-pointer"
                          />
                        </div>

                        {/* VARIABLE KETINGGIAN 1: TINGGI OBJEK */}
                        <div className="grid grid-cols-2 gap-2 p-2 bg-white rounded-lg border border-slate-200">
                          <div>
                            <div className="flex justify-between text-slate-700 mb-0.5 font-medium">
                              <span>Tinggi Objek (H):</span>
                              <span className="font-mono text-amber-600 font-bold">{obs.height} m</span>
                            </div>
                            <input
                              type="range"
                              min="0.5"
                              max="25"
                              step="0.5"
                              value={obs.height}
                              onChange={(e) =>
                                updateObstacle(obs.id, { height: parseFloat(e.target.value) })
                              }
                              className="w-full accent-amber-500 cursor-pointer"
                            />
                          </div>

                          {/* VARIABLE KETINGGIAN 2: ELEVASI DASAR RINTANGAN */}
                          <div>
                            <div className="flex justify-between text-slate-700 mb-0.5 font-medium">
                              <span>Elevasi Dasar:</span>
                              <span className="font-mono text-sky-600 font-bold">{baseElev} m</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="20"
                              step="0.5"
                              value={baseElev}
                              onChange={(e) =>
                                updateObstacle(obs.id, { baseElevation: parseFloat(e.target.value) })
                              }
                              className="w-full accent-sky-500 cursor-pointer"
                            />
                          </div>
                        </div>

                        {/* Status Evaluasi Ketinggian Relatif */}
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
                              Puncak Rintangan: {totalObsPeak.toFixed(1)} m dpl | PLTS: {arrayConfig.mountHeight.toFixed(1)} m
                            </span>
                            {isObstacleLower ? (
                              <span>PLTS berada lebih tinggi dari puncak rintangan. Array terlindungi dari bayangan langsung.</span>
                            ) : (
                              <span>
                                Puncak rintangan lebih tinggi +{(totalObsPeak - arrayConfig.mountHeight).toFixed(1)} m dari dudukan PLTS. Berpotensi menimbulkan bayangan jatuh.
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Dimensi Lebar */}
                        <div>
                          <div className="flex justify-between text-slate-600 mb-0.5">
                            <span>Lebar Rintangan:</span>
                            <span className="font-mono text-slate-800 font-semibold">{obs.width} m</span>
                          </div>
                          <input
                            type="range"
                            min="0.5"
                            max="20"
                            step="0.5"
                            value={obs.width}
                            onChange={(e) =>
                              updateObstacle(obs.id, { width: parseFloat(e.target.value) })
                            }
                            className="w-full accent-amber-500 cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* SECTION 4: INVERTER & MITIGASI */}
        {activeSection === 'electrical' && (
          <div className="space-y-4">
            <div>
              <span className="font-semibold text-slate-800 block mb-1">
                Topologi Inverter & Mitigasi Shading
              </span>
              <p className="text-[11px] text-slate-600 leading-relaxed mb-3">
                Efek bayangan pada modul surya tidak linier. Rangkaian seri tradisional (String Inverter) rentan mengalami drop arus drastis saat ada modul terbayang, sedangkan Microinverter dan DC Optimizer mengisolasi modul terdampak.
              </p>

              <div className="space-y-2">
                <label
                  onClick={() => setArrayConfig({ ...arrayConfig, inverterType: 'string' })}
                  className={`block p-3 rounded-xl border cursor-pointer transition-colors ${
                    arrayConfig.inverterType === 'string'
                      ? 'bg-amber-50/80 border-amber-400 text-slate-900 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-slate-900">
                      1. String Inverter Standar (Seri)
                    </span>
                    <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-mono font-medium">Biaya Terendah</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-tight">
                    Modul dirangkai seri dalam 1 string. Jika 1 modul terkena bayangan, arus seluruh string terhambat kecuali bypass diode bekerja (rugi mismatch 20-50%).
                  </p>
                </label>

                <label
                  onClick={() => setArrayConfig({ ...arrayConfig, inverterType: 'optimizer' })}
                  className={`block p-3 rounded-xl border cursor-pointer transition-colors ${
                    arrayConfig.inverterType === 'optimizer'
                      ? 'bg-sky-50/80 border-sky-400 text-slate-900 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-slate-900">
                      2. String Inverter + DC Power Optimizer
                    </span>
                    <span className="text-[10px] text-sky-700 bg-sky-100 px-2 py-0.5 rounded font-mono font-medium">Direkomendasikan</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-tight">
                    Setiap modul dipasang DC-DC optimizer (MPPT tingkat modul). Modul yang terbayang tidak menurunkan daya modul lain yang terkena sinar penuh.
                  </p>
                </label>

                <label
                  onClick={() => setArrayConfig({ ...arrayConfig, inverterType: 'microinverter' })}
                  className={`block p-3 rounded-xl border cursor-pointer transition-colors ${
                    arrayConfig.inverterType === 'microinverter'
                      ? 'bg-emerald-50/80 border-emerald-400 text-slate-900 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-slate-900">
                      3. Microinverter (Per-Modul AC)
                    </span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-mono font-medium">Performa Maksimal</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-tight">
                    Konversi DC ke AC langsung di bawah masing-masing modul. Kinerja modul 100% independen dari modul tetangga, aman terhadap bayangan lokal.
                  </p>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
