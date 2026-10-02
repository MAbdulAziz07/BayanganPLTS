import React from 'react';
import {
  LocationConfig,
  PVArrayConfig,
  ObstacleConfig,
  DailySimulationResult,
  SkyConfig,
} from '../types/solar';
import { MONTH_NAMES_ID, getRecommendedTilt } from '../utils/solarMath';

export interface AnnualSummary {
  annualKWh: number;
  annualUnshadedKWh: number;
  annualLostKWh: number;
  annualLossPercent: number;
  monthlyKWh: number[];
}
import { X, Printer, FileText, CheckCircle2, ShieldCheck } from 'lucide-react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: LocationConfig;
  arrayConfig: PVArrayConfig;
  obstacles: ObstacleConfig[];
  month: number;
  dailyResult: DailySimulationResult;
  annualResult: AnnualSummary | null;
  sky: SkyConfig;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  location,
  arrayConfig,
  obstacles,
  month,
  dailyResult,
  annualResult,
  sky,
}) => {
  if (!isOpen) return null;

  const totalKWp = (arrayConfig.moduleCountX * arrayConfig.moduleCountY * arrayConfig.moduleWattage) / 1000;
  const recTilt = getRecommendedTilt(location.latitude);

  // Financial calculations (Tarif Listrik PLN Golongan R-1/B-1: ~Rp 1.444,70 / kWh)
  const tarifPLN = 1445; // Rp / kWh
  // Annual figures come from 12 simulated mid-month days (× days per month), not one day × 365
  const kerugianHarianRp = Math.round(dailyResult.energyLostKWh * tarifPLN);
  const potensiProduksiTahunanKWh = annualResult ? annualResult.annualKWh : Math.round(dailyResult.totalEnergyKWh * 365);
  const kerugianTahunanRp = Math.round((annualResult ? annualResult.annualLostKWh : dailyResult.energyLostKWh * 365) * tarifPLN);
  const skyLabel = sky.mode === 'climate' ? `Iklim rata-rata (K_T = ${sky.kt.toFixed(2)})` : 'Langit cerah (batas atas teoretis)';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900">
              Laporan Analisis Teknis: Pengaruh Slope & Bayangan PLTS
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg text-xs transition-colors shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / Simpan PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Content */}
        <div className="p-6 space-y-6 text-slate-800 text-xs bg-white print:p-0">
          {/* Document Title Header */}
          <div className="border-b border-slate-200 pb-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[11px] font-mono text-amber-700 font-semibold uppercase tracking-wider">
                  Engineering Assessment Report
                </span>
                <h1 className="text-xl font-bold text-slate-900 mt-1">
                  Studi Kelayakan Sudut Kemiringan & Shading Array PLTS
                </h1>
                <p className="text-slate-500 text-xs mt-0.5">
                  Lokasi Pengamatan: {location.name} ({location.latitude.toFixed(2)}° Lintang, {location.longitude.toFixed(2)}° Bujur)
                </p>
              </div>
              <div className="text-right text-[11px] text-slate-500 font-mono">
                <div>Periode: Bulan {MONTH_NAMES_ID[month - 1]}</div>
                <div>Model langit: {skyLabel}</div>
                <div>Status: Selesai Disimulasikan</div>
              </div>
            </div>
          </div>

          {/* Section 1: Parameter Desain Sistem */}
          <div>
            <h3 className="text-sm font-bold text-amber-800 mb-2">
              1. Parameter Desain Sistem PLTS & Dudukan
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <span className="text-[11px] text-slate-500 block">Kapasitas Total</span>
                <span className="font-mono text-sm font-bold text-slate-900">
                  {totalKWp.toFixed(2)} kWp
                </span>
                <span className="text-[10px] text-slate-500 block">
                  ({arrayConfig.moduleCountX * arrayConfig.moduleCountY} Modul × {arrayConfig.moduleWattage}Wp)
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Sudut Kemiringan (Tilt)</span>
                <span className="font-mono text-sm font-bold text-slate-900">
                  {arrayConfig.tilt}°
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {arrayConfig.tilt < 10 ? '⚠️ Terlalu datar (<10°)' : '✓ Memenuhi standar tropis'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Ketinggian Dudukan PLTS</span>
                <span className="font-mono text-sm font-bold text-amber-700">
                  {arrayConfig.mountHeight.toFixed(1)} meter
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Elevasi dari tanah / atap
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Orientasi & Topologi</span>
                <span className="font-mono text-sm font-bold text-slate-900 capitalize">
                  {arrayConfig.azimuth}° | {arrayConfig.inverterType}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Ringkasan Kinerja & Dampak Bayangan */}
          <div>
            <h3 className="text-sm font-bold text-amber-800 mb-2">
              2. Ringkasan Kinerja & Dampak Shading
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <span className="text-[11px] text-slate-500 block">Produksi Harian Aktual</span>
                <span className="font-mono text-base font-bold text-sky-700">
                  {dailyResult.totalEnergyKWh} kWh/hari
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Potensi Tanpa Bayangan</span>
                <span className="font-mono text-base font-bold text-slate-900">
                  {dailyResult.unshadedEnergyKWh} kWh/hari
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Rugi Energi (Loss)</span>
                <span className={`font-mono text-base font-bold ${dailyResult.overallShadingLossPercent > 5 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {dailyResult.overallShadingLossPercent}% ({dailyResult.energyLostKWh} kWh)
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Performance Ratio (PR, IEC 61724)</span>
                <span className="font-mono text-base font-bold text-indigo-700">
                  {(dailyResult.performanceRatio * 100).toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-500 block">Tanpa bayangan: {(dailyResult.unshadedPerformanceRatio * 100).toFixed(1)}%</span>
              </div>
            </div>
            {annualResult && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 mt-2">
                <div>
                  <span className="text-[11px] text-slate-500 block">Produksi Tahunan</span>
                  <span className="font-mono text-base font-bold text-sky-700">{annualResult.annualKWh.toLocaleString('id-ID')} kWh</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Yield Spesifik Tahunan</span>
                  <span className="font-mono text-base font-bold text-slate-900">{totalKWp > 0 ? Math.round(annualResult.annualKWh / totalKWp).toLocaleString('id-ID') : 0} kWh/kWp</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Potensi Tahunan Tanpa Bayangan</span>
                  <span className="font-mono text-base font-bold text-slate-900">{annualResult.annualUnshadedKWh.toLocaleString('id-ID')} kWh</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Rugi Bayangan Tahunan</span>
                  <span className={`font-mono text-base font-bold ${annualResult.annualLossPercent > 5 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {annualResult.annualLossPercent}% ({annualResult.annualLostKWh.toLocaleString('id-ID')} kWh)
                  </span>
                </div>
              </div>
            )}
            <p className="text-[10px] text-slate-500 mt-1.5">
              Angka tahunan = jumlah 12 hari representatif (tanggal 15 tiap bulan) × jumlah hari per bulan. PR = (E<sub>AC</sub> / P<sub>0</sub>) ÷ (H<sub>POA</sub> / 1 kW/m²).
            </p>
          </div>

          {/* Section 3: Estimasi Finansial */}
          <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200">
            <h4 className="font-semibold text-slate-900 mb-1">
              Estimasi Finansial Penghematan Listrik (PLN Golongan B-1 / R-1)
            </h4>
            <p className="text-[10px] text-slate-600">Asumsi tarif Rp {tarifPLN.toLocaleString('id-ID')}/kWh — sesuaikan dengan tarif PLN yang berlaku.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2 text-[11px]">
              <div>
                <span className="text-slate-600 block">Potensi Penghematan Tahunan:</span>
                <b className="font-mono text-emerald-700 text-sm">
                  Rp {(potensiProduksiTahunanKWh * tarifPLN).toLocaleString('id-ID')} / tahun
                </b>
              </div>
              <div>
                <span className="text-slate-600 block">Kerugian Finansial Akibat Bayangan:</span>
                <b className="font-mono text-rose-600 text-sm">
                  Rp {kerugianTahunanRp.toLocaleString('id-ID')} / tahun
                </b>
              </div>
              <div>
                <span className="text-slate-600 block">Kerugian Finansial Harian:</span>
                <b className="font-mono text-slate-900 text-sm">
                  Rp {kerugianHarianRp.toLocaleString('id-ID')} / hari
                </b>
              </div>
            </div>
          </div>

          {/* Section 4: Rekomendasi Teknis Rekayasa */}
          <div>
            <h3 className="text-sm font-bold text-amber-800 mb-2">
              3. Rekomendasi Solusi & Rekayasa Teknis
            </h3>
            <div className="space-y-2 text-[11px] text-slate-700">
              {/* Tilt Recommendation */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <b className="text-slate-900 block mb-0.5">
                    Optimasi Sudut Kemiringan (Slope):
                  </b>
                  <p className="text-slate-600 leading-relaxed">
                    {arrayConfig.tilt < 10 ? (
                      <span className="text-amber-800">
                        Disarankan menaikkan sudut kemiringan dari {arrayConfig.tilt}° menjadi minimal 10°–15°. Sudut flat &lt;10° di iklim tropis berisiko tinggi terhadap akumulasi debu, kerak air hujan, dan pertumbuhan jamur/lumut yang dapat memicu degradasi dini modul.
                      </span>
                    ) : (
                      `Sudut kemiringan saat ini (${arrayConfig.tilt}°) sudah memenuhi standar self-cleaning air hujan dan efisiensi tangkapan radiasi tahunan untuk wilayah lintang ${location.latitude.toFixed(1)}°.`
                    )}
                  </p>
                </div>
              </div>

              {/* Shading Mitigation */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
                <div>
                  <b className="text-slate-900 block mb-0.5">
                    Mitigasi Kerugian Pembayangan (Shading Mitigation):
                  </b>
                  <p className="text-slate-600 leading-relaxed">
                    {dailyResult.overallShadingLossPercent > 5 ? (
                      arrayConfig.inverterType === 'string' ? (
                        <span>
                          Sistem saat ini menggunakan <b>String Inverter konvensional</b> dengan kerugian bayangan sebesar <b>{dailyResult.overallShadingLossPercent}%</b>. Sangat direkomendasikan mengupgrade ke <b>DC Power Optimizer</b> (seperti SolarEdge/Huawei) atau <b>Microinverter</b> (Enphase/Hoymiles) pada modul yang terdampak bayangan. Hal ini dapat memulihkan hingga 70-85% energi yang hilang.
                        </span>
                      ) : (
                        <span>
                          Sistem sudah dilengkapi dengan <b>{arrayConfig.inverterType === 'optimizer' ? 'DC Optimizer' : 'Microinverter'}</b>, membatasi dampak bayangan hanya pada modul terkait tanpa merugikan modul lain di string yang sama.
                        </span>
                      )
                    ) : (
                      'Tingkat pembayangan sangat rendah (<5%), konfigurasi tata letak array dan ketinggian dudukan sudah baik.'
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between print:hidden">
          <span className="text-[11px] text-slate-500 font-mono">
            Dokumen Teknis Hasil Simulasi Interaktif PLTS
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-medium transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
