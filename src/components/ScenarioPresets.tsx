import React from 'react';
import { LocationConfig, PVArrayConfig, ObstacleConfig } from '../types/solar';
import { CITIES_INDONESIA } from '../utils/solarMath';
import { Home, Trees, Building2, SunMedium } from 'lucide-react';

interface ScenarioPresetsProps {
  onSelectScenario: (
    loc: LocationConfig,
    array: PVArrayConfig,
    obstacles: ObstacleConfig[],
    month: number,
    hour: number
  ) => void;
}

export const ScenarioPresets: React.FC<ScenarioPresetsProps> = ({ onSelectScenario }) => {
  const loadScenario1 = () => {
    // Rumah Tinggal: Pohon Pagi
    const loc = CITIES_INDONESIA.find((c) => c.name.includes('Jakarta')) || CITIES_INDONESIA[0];
    const array: PVArrayConfig = {
      moduleCountX: 4,
      moduleCountY: 2,
      moduleWattage: 550,
      moduleLength: 2.27,
      moduleWidth: 1.13,
      tilt: 15,
      azimuth: 0, // Facing North
      mountHeight: 3.5, // Rooftop lt 1
      mountType: 'rooftop_sloped',
      inverterType: 'string',
      rowSpacing: 2.5,
      frontRowEnabled: false,
    };
    const obstacles: ObstacleConfig[] = [
      {
        id: 'tree_morning',
        type: 'tree',
        name: 'Pohon Mangga Tetangga',
        enabled: true,
        distance: 5.5,
        azimuth: 85, // East morning
        height: 6.5,
        width: 4.5,
        baseElevation: 0,
      },
    ];
    onSelectScenario(loc, array, obstacles, 7, 8.5); // July, 8:30 AM
  };

  const loadScenario2 = () => {
    // Ground Mount: Self-Shading Baris Depan (baris identik di depan, pitch terlalu rapat)
    const loc = CITIES_INDONESIA.find((c) => c.name.includes('Surabaya')) || CITIES_INDONESIA[1];
    const array: PVArrayConfig = {
      moduleCountX: 8,
      moduleCountY: 1,
      moduleWattage: 550,
      moduleLength: 2.27,
      moduleWidth: 1.13,
      tilt: 20,
      azimuth: 0,
      mountHeight: 0.8,
      mountType: 'ground',
      inverterType: 'string',
      rowSpacing: 2.4, // minimum aman ±3.8 m pada tilt 20° (α = 25°)
      frontRowEnabled: true,
    };
    onSelectScenario(loc, array, [], 7, 7.0); // July, 07:00 WIB (self-shading pagi)
  };
  const loadScenario3 = () => {
    // Gedung / Ruko: Parapet Atap Sore
    const loc = CITIES_INDONESIA.find((c) => c.name.includes('Bandung')) || CITIES_INDONESIA[2];
    const array: PVArrayConfig = {
      moduleCountX: 4,
      moduleCountY: 2,
      moduleWattage: 550,
      moduleLength: 2.27,
      moduleWidth: 1.13,
      tilt: 5,
      azimuth: 0,
      mountHeight: 7.0, // Roof floor elevation
      mountType: 'rooftop_flat',
      inverterType: 'optimizer',
      rowSpacing: 2.0,
      frontRowEnabled: false,
    };
    const obstacles: ObstacleConfig[] = [
      {
        id: 'parapet_wall',
        type: 'wall',
        name: 'Dinding Parapet Atap Barat',
        enabled: true,
        distance: 3.5,
        azimuth: 270, // West
        height: 1.8,
        width: 10.0,
        depth: 0.3,
        baseElevation: 6.5,
      },
    ];
    onSelectScenario(loc, array, obstacles, 9, 16.0); // Sept, 16:00
  };

  const loadScenario4 = () => {
    // Murni Kemiringan (Slope Test) di Khatulistiwa
    const loc = CITIES_INDONESIA.find((c) => c.name.includes('Pontianak')) || CITIES_INDONESIA[6];
    const array: PVArrayConfig = {
      moduleCountX: 4,
      moduleCountY: 2,
      moduleWattage: 550,
      moduleLength: 2.27,
      moduleWidth: 1.13,
      tilt: 10,
      azimuth: 0,
      mountHeight: 1.0,
      mountType: 'rooftop_flat',
      inverterType: 'string',
      rowSpacing: 2.5,
      frontRowEnabled: false,
    };
    onSelectScenario(loc, array, [], 6, 12.0); // June noon
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 shadow-sm">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-800">Skenario Lapangan Siap Pakai:</span>
        <span className="text-[11px] text-slate-500">Pilih skenario untuk simulasi cepat</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <button
          onClick={loadScenario1}
          className="p-2.5 bg-slate-50 hover:bg-amber-50/60 border border-slate-200 hover:border-amber-400 rounded-lg text-left transition-all group shadow-2xs"
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 group-hover:text-amber-700">
            <Home className="w-3.5 h-3.5 text-amber-500" />
            <span>Rumah + Pohon Pagi</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
            Jakarta (Tilt 15°, Mount 3.5m). Pohon 6.5m di timur membayangi modul pagi jam 08:30.
          </p>
        </button>

        <button
          onClick={loadScenario2}
          className="p-2.5 bg-slate-50 hover:bg-amber-50/60 border border-slate-200 hover:border-amber-400 rounded-lg text-left transition-all group shadow-2xs"
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 group-hover:text-amber-700">
            <Trees className="w-3.5 h-3.5 text-sky-500" />
            <span>Ground-Mount Self Shade</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
            Surabaya, Juli (Tilt 20°, Mount 0.8m). Pitch 2.4 m terlalu rapat (minimum ±3.8 m), baris belakang terbayang baris depan.
          </p>
        </button>

        <button
          onClick={loadScenario3}
          className="p-2.5 bg-slate-50 hover:bg-amber-50/60 border border-slate-200 hover:border-amber-400 rounded-lg text-left transition-all group shadow-2xs"
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 group-hover:text-amber-700">
            <Building2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Ruko + Dinding Parapet</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
            Bandung (Mount 7.0m). Dinding parapet elevasi 6.5m membayangi atap di sore hari.
          </p>
        </button>

        <button
          onClick={loadScenario4}
          className="p-2.5 bg-slate-50 hover:bg-amber-50/60 border border-slate-200 hover:border-amber-400 rounded-lg text-left transition-all group shadow-2xs"
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 group-hover:text-amber-700">
            <SunMedium className="w-3.5 h-3.5 text-purple-500" />
            <span>Uji Murni Slope (0°-30°)</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
            Pontianak (Lintang 0°). Bandingkan performa kemiringan 0° vs 10° vs 30° tanpa rintangan.
          </p>
        </button>
      </div>
    </div>
  );
};
