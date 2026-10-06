import React from 'react';
import { Sun, Download, RotateCcw } from 'lucide-react';

type TabId = 'simulasi' | 'analisis_slope' | 'jarak_baris' | 'bypass_diode';

interface HeaderProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  onOpenReport: () => void;
  onReset: () => void;
}

const TABS: { id: TabId; label: string; short: string }[] = [
  { id: 'simulasi', label: 'Simulasi 3D & Waktu Nyata', short: 'Simulasi 3D' },
  { id: 'analisis_slope', label: 'Analisis Sudut Slope (Tilt)', short: 'Analisis Slope' },
  { id: 'jarak_baris', label: 'Kalkulator Jarak Antar Baris', short: 'Jarak Baris' },
  { id: 'bypass_diode', label: 'Bypass Diode & Mismatch', short: 'Bypass Diode' },
];

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenReport,
  onReset,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
      <div className="flex items-center justify-between gap-3 px-4 md:px-6 py-3">
        {/* Wordmark */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 shrink-0 rounded-lg bg-amber-50 border border-amber-300 flex items-center justify-center text-amber-600 shadow-xs">
            <Sun className="w-4 h-4 text-amber-500" />
          </div>
          <div className="min-w-0">
            <a href="/" className="text-sm md:text-base font-bold tracking-tight text-slate-900 hover:text-amber-600 transition-colors block truncate">
              Simulasi PLTS: Slope & Bayangan
            </a>
            <span className="hidden sm:block text-[11px] text-slate-500 font-medium -mt-0.5">
              Analisis Sudut Kemiringan, Ketinggian & Efek Bayangan
            </span>
          </div>
        </div>

        {/* Desktop navigation */}
        <nav className="hidden lg:flex items-center gap-7 text-xs font-medium text-slate-600" aria-label="Menu utama">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              aria-current={activeTab === t.id ? 'page' : undefined}
              className={`transition-colors whitespace-nowrap ${
                activeTab === t.id ? 'text-amber-600 font-semibold border-b-2 border-amber-500 pb-1 -mb-1' : 'hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onReset}
            title="Reset ke Nilai Standar"
            aria-label="Reset ke nilai standar"
            className="p-2 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenReport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors whitespace-nowrap shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Laporan<span className="hidden sm:inline"> Teknis</span></span>
          </button>
        </div>
      </div>

      {/* Mobile / tablet navigation (scrollable tab bar) */}
      <nav
        className="lg:hidden flex gap-1.5 overflow-x-auto px-3 pb-2.5 -mt-0.5 [scrollbar-width:none]"
        aria-label="Menu utama"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            aria-current={activeTab === t.id ? 'page' : undefined}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap ${
              activeTab === t.id
                ? 'bg-amber-500 border-amber-500 text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <span className="sm:hidden">{t.short}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </nav>
    </header>
  );
};
