import React, { useState } from 'react';
import { Zap } from 'lucide-react';

export const BypassDiodeExplanation: React.FC = () => {
  // State of shading for each of the 3 sub-strings in a standard PV module
  const [subShaded, setSubShaded] = useState<[boolean, boolean, boolean]>([false, true, false]);
  const [inverterType, setInverterType] = useState<'string' | 'optimizer' | 'microinverter'>('string');

  const unshadedVoc = 48.0; // V
  const unshadedVmp = 40.0; // V
  const unshadedImp = 13.5; // A

  const activeSubCount = subShaded.filter((s) => !s).length;

  // With bypass diodes: each bypassed substring loses ~1/3 of the module's voltage
  const actualVmp = (activeSubCount / 3) * unshadedVmp;
  // Module current: if all 3 bypassed, only diffuse residual ~1.2A
  const actualImp = activeSubCount > 0 ? unshadedImp : 1.2;
  const actualModulePower = Math.round(actualVmp * actualImp);
  const idealModulePower = Math.round(unshadedVmp * unshadedImp); // 540W

  // String of 8 modules impact:
  // Assume 7 other modules in series are 100% in full sun (540W each)
  const otherModulesPower = 7 * idealModulePower;
  let totalStringPower = 0;
  let stringLossPercent = 0;

  if (inverterType === 'string') {
    // Traditional string: if bypass diode conducts, string voltage drops by the bypassed voltage,
    // maintaining full string current (unshadedImp).
    // Total string voltage = 7 * 40V + actualVmp.
    const totalV = 7 * unshadedVmp + actualVmp;
    totalStringPower = Math.round(totalV * unshadedImp);
    // If MPPT gets confused by multiple local peaks (common in cheaper inverters), mismatch loss rises
    stringLossPercent = Math.round(((8 * idealModulePower - totalStringPower) / (8 * idealModulePower)) * 100);
  } else if (inverterType === 'optimizer') {
    // Optimizer: module DC/DC converts power directly, no string current bottleneck
    totalStringPower = Math.round(otherModulesPower + actualModulePower * 0.98);
    stringLossPercent = Math.round(((8 * idealModulePower - totalStringPower) / (8 * idealModulePower)) * 100);
  } else {
    // Microinverter: completely independent AC output
    totalStringPower = otherModulesPower + actualModulePower;
    stringLossPercent = Math.round(((8 * idealModulePower - totalStringPower) / (8 * idealModulePower)) * 100);
  }

  const toggleSub = (index: 0 | 1 | 2) => {
    const updated: [boolean, boolean, boolean] = [...subShaded];
    updated[index] = !updated[index];
    setSubShaded(updated);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-6 shadow-sm">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-base font-bold text-slate-900">
          Simulasi Fisika: Bypass Diode & Mismatch Akibat Bayangan
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Pelajari bagaimana bayangan parsial pada 1 sel modul surya memicu bypass diode dan memengaruhi seluruh rangkaian string.
        </p>
      </div>

      {/* Interactive Circuit Schematic of a Solar PV Module */}
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-xs">
          <span className="font-semibold text-slate-800">
            Skema Internal Modul Surya (3 Sub-String & 3 Bypass Diode)
          </span>
          <span className="text-slate-500 text-[11px]">
            Klik pada sub-modul A, B, atau C untuk memberi bayangan (daun / kotoran burung / bayangan tiang).
          </span>
        </div>

        {/* 3 Substrings Interactive Diagram */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(['A', 'B', 'C'] as const).map((label, idx) => {
            const isShaded = subShaded[idx];
            const diodeConducting = isShaded;

            return (
              <div
                key={label}
                onClick={() => toggleSub(idx as 0 | 1 | 2)}
                className={`p-4 rounded-xl border cursor-pointer transition-all duration-300 relative ${
                  isShaded
                    ? 'bg-rose-50/80 border-rose-300 shadow-sm'
                    : 'bg-white border-slate-300 hover:border-amber-400 hover:shadow-xs'
                }`}
              >
                {/* Status Header */}
                <div className="flex items-center justify-between mb-3 text-xs">
                  <span className="font-bold text-slate-800">
                    Sub-String {label} (20-24 Sel Seri)
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                      isShaded
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {isShaded ? 'Terkena Bayangan' : 'Sinar Penuh'}
                  </span>
                </div>

                {/* Visual Cells Grid Simulation */}
                <div className="grid grid-cols-4 gap-1 p-2 bg-slate-100 rounded-lg mb-3 border border-slate-200">
                  {Array.from({ length: 12 }).map((_, cIdx) => (
                    <div
                      key={cIdx}
                      className={`h-7 rounded transition-colors ${
                        isShaded
                          ? 'bg-slate-400 border border-slate-500/50'
                          : 'bg-sky-600 border border-sky-400 shadow-2xs'
                      }`}
                    />
                  ))}
                </div>

                {/* Bypass Diode Visual Circuit */}
                <div
                  className={`p-2.5 rounded-lg border text-xs space-y-1 ${
                    diodeConducting
                      ? 'bg-amber-100/70 border-amber-300 text-amber-900'
                      : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="font-semibold">Bypass Diode D{idx + 1}:</span>
                    <span className={diodeConducting ? 'text-amber-800 font-bold' : 'text-slate-500'}>
                      {diodeConducting ? '● ON (Forward Bias)' : '○ OFF (Reverse Bias)'}
                    </span>
                  </div>
                  <p className="text-[10px] leading-tight">
                    {diodeConducting
                      ? 'Arus dialihkan melewati diode untuk mencegah panas terbakar (hot-spot).'
                      : 'Sel sehat menghasilkan tegangan normal (~13.3V).'
                    }
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Electrical Output of Single Module */}
        <div className="mt-4 p-3 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs shadow-2xs">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-slate-800 font-semibold">Output Modul Terbayang Ini:</span>
          </div>
          <div className="flex items-center gap-6 font-mono text-sm tabular-nums">
            <div>
              <span className="text-slate-500 text-xs mr-1.5">Tegangan (Vmp):</span>
              <b className={activeSubCount < 3 ? 'text-rose-600' : 'text-slate-900'}>
                {actualVmp.toFixed(1)} V
              </b>
              <span className="text-slate-500 text-xs ml-1">/ {unshadedVmp}V</span>
            </div>
            <div>
              <span className="text-slate-500 text-xs mr-1.5">Arus (Imp):</span>
              <b className="text-slate-900">{actualImp.toFixed(1)} A</b>
            </div>
            <div>
              <span className="text-slate-500 text-xs mr-1.5">Daya:</span>
              <b className={activeSubCount < 3 ? 'text-amber-700' : 'text-emerald-700'}>
                {actualModulePower} W
              </b>
              <span className="text-slate-500 text-xs ml-1 font-sans">({Math.round((actualModulePower / idealModulePower) * 100)}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Impact on Entire String (8 Modules in Series) */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-semibold text-slate-800">
            Dampak pada Rangkaian String (1 String = 8 Modul × 540W = 4.32 kWp)
          </span>

          {/* Inverter Type Switch */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-2xs">
            <button
              onClick={() => setInverterType('string')}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                inverterType === 'string'
                  ? 'bg-amber-500 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              String Inverter Standar
            </button>
            <button
              onClick={() => setInverterType('optimizer')}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                inverterType === 'optimizer'
                  ? 'bg-amber-500 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              DC Optimizer
            </button>
            <button
              onClick={() => setInverterType('microinverter')}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                inverterType === 'microinverter'
                  ? 'bg-amber-500 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Microinverter
            </button>
          </div>
        </div>

        {/* Comparison Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
            <span className="text-[11px] text-slate-500 block mb-0.5 font-medium">Daya String Ideal</span>
            <span className="font-mono text-base font-bold text-slate-900">4,320 W</span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
            <span className="text-[11px] text-slate-500 block mb-0.5 font-medium">Daya String Aktual</span>
            <span className="font-mono text-base font-bold text-sky-700">{totalStringPower} W</span>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs">
            <span className="text-[11px] text-slate-500 block mb-0.5 font-medium">Penurunan Daya Total</span>
            <span className={`font-mono text-base font-bold ${stringLossPercent > 5 ? 'text-rose-600' : 'text-emerald-600'}`}>
              -{stringLossPercent}% ({4320 - totalStringPower} W)
            </span>
          </div>
        </div>

        {/* Explanation text */}
        <div className="p-3 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-700 leading-relaxed">
          <b className="text-amber-800">Mengapa Bypass Diode Sangat Penting?</b>
          <p className="mt-0.5 text-slate-600">
            Jika 1 sel surya tertutup daun atau bayangan tiang sementara sel lainnya bermandikan cahaya matahari, sel yang terbayang tersebut akan bertindak sebagai <b>beban resistif (resistor)</b> yang memblokir arus. Energi dari sel lain akan terdisipasi sebagai panas di sel tersebut, menimbulkan temperatur ekstrem (&gt;150°C) yang dikenal sebagai <b>Hot-Spot</b> dan dapat membakar lapisan EVA/backsheet. Bypass diode melindungi modul dengan mengalirkan arus memintas sub-string yang terbayang.
          </p>
        </div>
      </div>
    </div>
  );
};
