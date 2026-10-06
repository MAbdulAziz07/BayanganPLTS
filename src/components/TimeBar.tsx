import React from 'react';
import { Play, Pause, Sun } from 'lucide-react';
import { formatClock, solarNoonClock, timeZoneLabel, getDayOfYear } from '../utils/solarMath';
import { LocationConfig } from '../types/solar';

interface TimeBarProps {
  hour: number;
  setHour: (h: number) => void;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
  location: LocationConfig;
  month: number;
  /** Versi ringkas (tanpa paragraf keterangan) untuk mode layar penuh */
  compact?: boolean;
}

/**
 * Kontrol waktu utama, diletakkan tepat di bawah tampilan 3D supaya
 * peserta bisa menggeser jam sambil melihat bayangan bergerak.
 */
export const TimeBar: React.FC<TimeBarProps> = ({ hour, setHour, isPlaying, setIsPlaying, location, month, compact = false }) => {
  const tz = timeZoneLabel(location.timezoneOffset);
  const noon = solarNoonClock(location.longitude, location.timezoneOffset, getDayOfYear(month, 15));

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors shadow-xs shrink-0 ${
            isPlaying
              ? 'bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100'
              : 'bg-amber-500 text-white hover:bg-amber-600'
          }`}
          aria-label={isPlaying ? 'Jeda animasi matahari' : 'Putar lintasan matahari'}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          <span>{isPlaying ? 'Jeda' : 'Putar Matahari'}</span>
        </button>

        <div className="flex items-baseline gap-1.5 shrink-0">
          <Sun className="w-4 h-4 text-amber-500 self-center" />
          <span className="text-xs text-slate-600 font-medium">Waktu Simulasi</span>
          <span className="font-mono text-lg font-bold text-amber-600 tabular-nums">
            {formatClock(hour)} {tz}
          </span>
        </div>

        <div className="flex items-center gap-1 ml-auto flex-wrap">
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
              {String(h).padStart(2, '0')}:00
            </button>
          ))}
        </div>
      </div>

      <input
        type="range"
        min="5"
        max="19"
        step="0.1"
        value={hour}
        onChange={(e) => setHour(parseFloat(e.target.value))}
        aria-label="Jam simulasi"
        className="w-full accent-amber-500 cursor-pointer mt-3"
      />
      <div className="flex justify-between text-[11px] text-slate-500 font-mono">
        <span>05:00</span>
        <span>12:00</span>
        <span>19:00</span>
      </div>
      <p className={`text-[11px] text-slate-500 mt-1.5 leading-relaxed ${compact ? 'hidden' : ''}`}>
        Waktu lokal ({tz}). Matahari tertinggi (tengah hari surya) pada{' '}
        <b className="font-mono text-slate-700">{formatClock(noon)} {tz}</b> — bergeser karena bujur lokasi (
        {location.longitude.toFixed(1)}° BT) dan <i>equation of time</i>.
      </p>
    </div>
  );
};
