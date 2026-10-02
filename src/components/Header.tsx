import React from 'react';
import { Sun, Download, RotateCcw } from 'lucide-react';

interface HeaderProps {
  activeTab: 'simulasi' | 'analisis_slope' | 'jarak_baris' | 'bypass_diode';
  setActiveTab: (tab: 'simulasi' | 'analisis_slope' | 'jarak_baris' | 'bypass_diode') => void;
  onOpenReport: () => void;
  onReset: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenReport,
  onReset,
}) => {
  return (
    <header className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-slate-200 shadow-xs">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-300 flex items-center justify-center text-amber-600 shadow-xs">
          <Sun className="w-4 h-4 text-amber-500" />
        </div>
        <div>
          <a href="/" className="text-base font-bold tracking-tight text-slate-900 hover:text-amber-600 transition-colors block">
            Simulasi PLTS: Slope & Bayangan
          </a>
          <span className="text-[10px] text-slate-500 font-medium block -mt-0.5">
            Analisis Sudut Kemiringan, Ketinggian & Efek Bayangan
          </span>
        </div>
      </div>

      {/* Zone 2: Clean text navigation tabs */}
      <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-slate-600">
        <button
          onClick={() => setActiveTab('simulasi')}
          className={`transition-colors whitespace-nowrap ${
            activeTab === 'simulasi' ? 'text-amber-600 font-semibold border-b-2 border-amber-500 pb-1 -mb-1' : 'hover:text-slate-900'
          }`}
        >
          Simulasi 3D & Waktu Nyata
        </button>
        <button
          onClick={() => setActiveTab('analisis_slope')}
          className={`transition-colors whitespace-nowrap ${
            activeTab === 'analisis_slope' ? 'text-amber-600 font-semibold border-b-2 border-amber-500 pb-1 -mb-1' : 'hover:text-slate-900'
          }`}
        >
          Analisis Sudut Slope (Tilt)
        </button>
        <button
          onClick={() => setActiveTab('jarak_baris')}
          className={`transition-colors whitespace-nowrap ${
            activeTab === 'jarak_baris' ? 'text-amber-600 font-semibold border-b-2 border-amber-500 pb-1 -mb-1' : 'hover:text-slate-900'
          }`}
        >
          Kalkulator Jarak Antar Baris
        </button>
        <button
          onClick={() => setActiveTab('bypass_diode')}
          className={`transition-colors whitespace-nowrap ${
            activeTab === 'bypass_diode' ? 'text-amber-600 font-semibold border-b-2 border-amber-500 pb-1 -mb-1' : 'hover:text-slate-900'
          }`}
        >
          Bypass Diode & Mismatch
        </button>
      </nav>

      {/* Zone 3: 1-2 primary actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onReset}
          title="Reset ke Nilai Standar"
          className="p-2 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={onOpenReport}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors whitespace-nowrap shadow-xs"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Laporan Teknis</span>
        </button>
      </div>
    </header>
  );
};
