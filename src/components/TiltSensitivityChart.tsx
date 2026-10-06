import React, { useState, useMemo } from 'react';
import { LocationConfig, PVArrayConfig, SkyConfig } from '../types/solar';
import { getRecommendedTilt, DAYS_IN_MONTH } from '../utils/solarMath';
import { unshadedDailyKWhPerKWp } from '../utils/pvModel';
import { Compass, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

interface TiltSensitivityChartProps {
  location: LocationConfig;
  arrayConfig: PVArrayConfig;
  sky: SkyConfig;
  onApplyTilt: (tilt: number, azimuth: number) => void;
}

export const TiltSensitivityChart: React.FC<TiltSensitivityChartProps> = ({
  location,
  arrayConfig,
  sky,
  onApplyTilt,
}) => {
  const [selectedAzimuth, setSelectedAzimuth] = useState<number>(arrayConfig.azimuth);

  const rec = useMemo(() => getRecommendedTilt(location.latitude), [location.latitude]);

  // Compute annual energy yield estimates for tilts 0° to 60° (step 5°)
  const tiltData = useMemo(() => {
    const results: {
      tilt: number;
      annualYieldKWhPerKWp: number;
      relativePercent: number;
      soilingRisk: 'Tinggi (Air Tergenang)' | 'Rendah (Self-Cleaning)' | 'Sangat Baik';
    }[] = [];

    let maxYield = 0;

    // Same model as the main simulation (sky model, temperature, tilt-dependent soiling,
    // wiring & inverter losses), 12 representative mid-month days.
    for (let t = 0; t <= 60; t += 5) {
      let annualKWh = 0;
      for (let m = 1; m <= 12; m++) {
        annualKWh += unshadedDailyKWhPerKWp(location.latitude, m, t, selectedAzimuth, sky) * DAYS_IN_MONTH[m - 1];
      }

      maxYield = Math.max(maxYield, annualKWh);

      let soilingRisk: 'Tinggi (Air Tergenang)' | 'Rendah (Self-Cleaning)' | 'Sangat Baik' = 'Rendah (Self-Cleaning)';
      if (t < 8) soilingRisk = 'Tinggi (Air Tergenang)';
      else if (t >= 15) soilingRisk = 'Sangat Baik';

      results.push({
        tilt: t,
        annualYieldKWhPerKWp: Math.round(annualKWh),
        relativePercent: 0,
        soilingRisk,
      });
    }

    // Set relative %
    return results.map((r) => ({
      ...r,
      relativePercent: Math.round((r.annualYieldKWhPerKWp / maxYield) * 100),
    }));
  }, [location.latitude, selectedAzimuth, sky]);

  // Optimum presisi (langkah 1°) dengan model yang sama, agar kartu & grafik konsisten
  const fineOptimum = useMemo(() => {
    let best = { tilt: 0, kwh: -1 };
    for (let t = 0; t <= 45; t += 1) {
      let annualKWh = 0;
      for (let m = 1; m <= 12; m++) {
        annualKWh += unshadedDailyKWhPerKWp(location.latitude, m, t, selectedAzimuth, sky) * DAYS_IN_MONTH[m - 1];
      }
      if (annualKWh > best.kwh) best = { tilt: t, kwh: annualKWh };
    }
    return best;
  }, [location.latitude, selectedAzimuth, sky]);

  // Find optimal tilt in current simulation
  const optimalItem = [...tiltData].sort((a, b) => b.annualYieldKWhPerKWp - a.annualYieldKWhPerKWp)[0];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Analisis Pengaruh Sudut Kemiringan (Slope / Tilt Angle β)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Optimasi sudut kemiringan PLTS untuk wilayah lintang {location.latitude.toFixed(2)}° ({location.name}).
          </p>
        </div>

        {/* Azimuth Selector for Comparison */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-600 flex items-center gap-1 font-medium">
            <Compass className="w-3.5 h-3.5 text-amber-500" /> Orientasi Hadap:
          </span>
          <div className="flex flex-wrap items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
            {[
              { label: 'Utara (0°)', az: 0 },
              { label: 'Timur (90°)', az: 90 },
              { label: 'Selatan (180°)', az: 180 },
              { label: 'Barat (270°)', az: 270 },
            ].map((d) => (
              <button
                key={d.az}
                onClick={() => setSelectedAzimuth(d.az)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  selectedAzimuth === d.az
                    ? 'bg-amber-500 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Engineering Recommendation Box */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 block mb-1 font-medium">Optimum Hasil Simulasi</span>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {fineOptimum.tilt}°
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Dihitung per 1° untuk arah hadap terpilih (sudah termasuk rugi debu). Aturan praktis ≈ lintang:{' '}
            <b className="font-mono">{rec.mathematicalOptimal}°</b>.
          </p>
        </div>

        <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-300">
          <span className="text-xs text-amber-800 font-semibold block mb-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
            Rekomendasi Praktis Tropis
          </span>
          <div className="text-2xl font-bold font-mono text-amber-700">
            {rec.practicalRecommended}° – 15°
          </div>
          <p className="text-[11px] text-amber-800 mt-1">
            Kemiringan minimum 10°–15° menjamin air hujan membersihkan debu/lumut secara mandiri.
          </p>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 block mb-1 font-medium">Pengaruh Arah Hadap</span>
          <div className="text-base font-bold text-slate-900">
            {location.latitude < 0 ? 'Hadap Utara (0°)' : 'Hadap Selatan (180°)'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Untuk memaksimalkan tangkapan radiasi saat matahari berada di belahan bumi berlawanan.
          </p>
        </div>
      </div>

      {/* Visual Bar Chart: Tilt vs Energy Yield */}
      <div>
        <div className="flex flex-wrap gap-1 justify-between items-center mb-2 text-xs">
          <span className="font-semibold text-slate-800">
            Grafik Sensitivitas Produksi Energi Tahunan vs Sudut Kemiringan
          </span>
          <span className="text-slate-500 text-[11px] font-mono">
            Estimasi kWh per kWp per Tahun · {sky.mode === 'climate' ? `iklim rata-rata (KT ${sky.kt.toFixed(2)})` : 'langit cerah'}
          </span>
        </div>

        <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
          {tiltData.map((item) => {
            const isOptimal = item.tilt === optimalItem?.tilt;
            const isCurrent = item.tilt === arrayConfig.tilt;

            return (
              <div key={item.tilt} className="flex items-center gap-3 text-xs">
                {/* Tilt Label */}
                <div className="w-9 sm:w-14 font-mono font-semibold text-slate-800 text-right">
                  {item.tilt}°
                </div>

                {/* Bar */}
                <div className="flex-1 bg-slate-200 rounded-full h-5 overflow-hidden relative">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isOptimal
                        ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                        : isCurrent
                        ? 'bg-gradient-to-r from-sky-600 to-sky-400'
                        : 'bg-slate-400 hover:bg-slate-500'
                    }`}
                    style={{ width: `${item.relativePercent}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-between px-3 text-[11px] font-mono text-slate-900 font-semibold drop-shadow-2xs">
                    <span>{item.annualYieldKWhPerKWp} kWh/kWp/thn</span>
                    <span>{item.relativePercent}%</span>
                  </div>
                </div>

                {/* Risk / Status Badge */}
                <div className="hidden sm:block w-40 text-right text-[11px]">
                  {item.tilt < 10 ? (
                    <span className="text-rose-600 font-medium">⚠️ Risiko Genangan Air</span>
                  ) : isOptimal ? (
                    <span className="text-amber-700 font-semibold">★ Puncak Energi</span>
                  ) : (
                    <span className="text-emerald-700 font-medium">✓ Self-Cleaning</span>
                  )}
                </div>

                {/* Apply Button */}
                <button
                  onClick={() => onApplyTilt(item.tilt, selectedAzimuth)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors shadow-2xs ${
                    isCurrent
                      ? 'bg-sky-100 text-sky-800 border border-sky-300 font-semibold'
                      : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-700'
                  }`}
                >
                  {isCurrent ? 'Aktif' : 'Terapkan'}
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500 mt-2">
          Grafik ditampilkan per 5°, sehingga ★ Puncak Energi menandai kelipatan 5° terdekat. Optimum presisi hasil
          perhitungan per 1° adalah <b className="font-mono text-slate-700">{fineOptimum.tilt}°</b>; selisih produksi antar
          sudut di sekitar puncak biasanya &lt; 1%.
        </p>
      </div>

      {/* Explanation of Why Tilt Angle Matters */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-700 leading-relaxed">
        <h4 className="font-semibold text-slate-900 flex items-center gap-1.5">
          <Info className="w-4 h-4 text-sky-600" />
          Mengapa Sudut Kemiringan (Slope) Sangat Berpengaruh pada PLTS?
        </h4>
        <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
          <li>
            <b className="text-slate-900">Kehilangan Cosinus (Cosine Loss):</b> Radiasi matahari maksimum jatuh saat sudut datang cahaya matahari tegak lurus (90°) dengan permukaan panel surya. Kemiringan yang tidak tepat menyebabkan sebagian radiasi terpantul atau terdistribusi di area yang lebih luas.
          </li>
          <li>
            <b className="text-slate-900">Efek Debu & Hujan (Self-Cleaning Effect):</b> Di negara tropis seperti Indonesia, memasang modul dengan sudut flat 0° adalah kesalahan fatal karena air hujan akan menggenang di tepian frame aluminium, meninggalkan kerak debu, lumut, dan noda polusi (soiling loss 5–15%). Kemiringan minimal 10° memungkinkan gravitasi mengalirkan air dan membersihkan kaca secara alami.
          </li>
          <li>
            <b className="text-slate-900">Beban Angin (Wind Load):</b> Semakin curam sudut kemiringan (&gt;30°), semakin tinggi gaya dorong angin pada struktur atap/mounting yang memerlukan rangka lebih mahal dan pondasi yang lebih kuat.
          </li>
        </ul>
      </div>
    </div>
  );
};
