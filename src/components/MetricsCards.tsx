import React from 'react';
import { IrradianceData, DailySimulationResult, PVArrayConfig } from '../types/solar';
import { Sun, Zap, TrendingDown, BatteryCharging, Gauge } from 'lucide-react';

interface MetricsCardsProps {
  irradiance: IrradianceData;
  currentACPowerKW: number;
  currentUnshadedPowerKW: number;
  currentLossPercent: number;
  dailyResult: DailySimulationResult;
  arrayConfig: PVArrayConfig;
  /** Fraksi luas permukaan array yang tertutup bayangan (0–1) */
  shadedFraction?: number;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({
  irradiance,
  currentACPowerKW,
  currentUnshadedPowerKW,
  currentLossPercent,
  dailyResult,
  arrayConfig,
  shadedFraction = 0,
}) => {
  const totalCapacityKWp = (arrayConfig.moduleCountX * arrayConfig.moduleCountY * arrayConfig.moduleWattage) / 1000;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {/* 1. Radiasi Bidang Modul (POA Irradiance) */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span className="font-medium">Radiasi Bidang (POA)</span>
          <Sun className="w-4 h-4 text-amber-500" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
            {irradiance.poaTotalUnshaded}
          </span>
          <span className="text-xs text-slate-500 font-medium">W/m²</span>
        </div>
        <div className="mt-1 text-[11px] text-slate-500 font-mono">
          <span>Beam: {irradiance.poaBeam}</span>
          <span className="mx-1 text-slate-300">·</span>
          <span>Diff: {irradiance.poaDiffuse}</span>
        </div>
      </div>

      {/* 2. Daya Output Sesaat (AC Power) */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span className="font-medium">Daya Output Sesaat</span>
          <Zap className="w-4 h-4 text-sky-500" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
            {currentACPowerKW.toFixed(2)}
          </span>
          <span className="text-xs text-slate-500 font-medium">kW AC</span>
        </div>
        <div className="mt-1 text-[11px] text-slate-500 font-mono">
          <span>Kapasitas: {totalCapacityKWp.toFixed(2)} kWp</span>
          <span className="mx-1 text-slate-300">·</span>
          <span>Ideal: {currentUnshadedPowerKW.toFixed(2)} kW</span>
        </div>
      </div>

      {/* 3. Rugi Akibat Bayangan (Shading Loss) */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span className="font-medium">Rugi Bayangan Sesaat</span>
          <TrendingDown className={`w-4 h-4 ${currentLossPercent > 5 ? 'text-rose-500' : currentLossPercent > 0.05 ? 'text-amber-500' : 'text-emerald-500'}`} />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className={`text-xl font-bold font-mono tabular-nums ${currentLossPercent > 5 ? 'text-rose-600' : currentLossPercent > 0.05 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {currentLossPercent.toFixed(1)}%
          </span>
          <span className="text-xs text-slate-500 font-medium">dari daya ideal</span>
        </div>
        {shadedFraction > 0.01 && currentLossPercent > 0.05 && (
          <p
            className="mt-1 text-[11px] text-slate-600 leading-snug"
            title="Modul dirangkai seri: sel yang terbayang membatasi arus seluruh rangkaian, sehingga rugi daya bisa lebih besar daripada luas bayangan."
          >
            Luas terbayang {(shadedFraction * 100).toFixed(0)}% → rugi daya {currentLossPercent.toFixed(0)}%
            {currentLossPercent > shadedFraction * 100 + 1 ? ' (efek mismatch seri)' : ''}
          </p>
        )}
        <div className="mt-1 text-[11px] text-slate-500 font-mono">
          <span>Rugi Harian: {dailyResult.overallShadingLossPercent.toFixed(1)}%</span>
          <span className="mx-1 text-slate-300">·</span>
          <span>{dailyResult.energyLostKWh.toFixed(2)} kWh</span>
        </div>
      </div>

      {/* 4. Estimasi Energi Harian (Daily Yield) */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span className="font-medium">Produksi Harian</span>
          <BatteryCharging className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
            {dailyResult.totalEnergyKWh.toFixed(1)}
          </span>
          <span className="text-xs text-slate-500 font-medium">kWh/hari</span>
        </div>
        <div className="mt-1 text-[11px] text-slate-500 font-mono">
          <span>Tanpa Shade: {dailyResult.unshadedEnergyKWh.toFixed(1)} kWh</span>
          <span className="mx-1 text-slate-300">·</span>
          <span>{dailyResult.specificYieldKWhPerKWp.toFixed(2)} kWh/kWp</span>
        </div>
      </div>

      {/* 5. Performance Ratio (PR) */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 col-span-2 lg:col-span-1 shadow-sm">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span className="font-medium">Performance Ratio (PR)</span>
          <Gauge className="w-4 h-4 text-indigo-500" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
            {(dailyResult.performanceRatio * 100).toFixed(1)}%
          </span>
        </div>
        <div className="mt-1 text-[11px] text-slate-500" title="PR (IEC 61724) = (E_AC / P0) ÷ (H_POA / 1 kW/m²). Sudah mencakup rugi suhu, debu, kabel, inverter, dan bayangan.">
          <b className={`font-semibold ${dailyResult.performanceRatio >= 0.8 ? 'text-emerald-600' : dailyResult.performanceRatio >= 0.7 ? 'text-amber-600' : 'text-rose-600'}`}>
            {dailyResult.performanceRatio >= 0.8 ? 'Baik' : dailyResult.performanceRatio >= 0.7 ? 'Cukup' : 'Rendah'}
          </b>
          <span className="mx-1">·</span>
          <span>Tanpa bayangan: {(dailyResult.unshadedPerformanceRatio * 100).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
};
