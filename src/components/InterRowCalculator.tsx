import React, { useState } from 'react';
import { calculateInterRowPitch } from '../utils/shadingMath';
import { PVArrayConfig } from '../types/solar';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface InterRowCalculatorProps {
  arrayConfig: PVArrayConfig;
  onApplyRowSpacing: (spacing: number) => void;
}

export const InterRowCalculator: React.FC<InterRowCalculatorProps> = ({
  arrayConfig,
  onApplyRowSpacing,
}) => {
  // L = length of the whole table along the slope (modules per row-depth × module length)
  const [moduleLength, setModuleLength] = useState<number>(
    Math.round(arrayConfig.moduleCountY * arrayConfig.moduleLength * 100) / 100 || 2.27
  );
  const [tilt, setTilt] = useState<number>(arrayConfig.tilt ?? 15);
  const [criticalSunAlt, setCriticalSunAlt] = useState<number>(25); // degrees
  const [pitchState, setActualPitch] = useState<number>(arrayConfig.rowSpacing || 3.0); // meters
  // Rows cannot overlap: pitch must exceed the horizontal projection of the table
  const minPhysicalPitch = Math.ceil((moduleLength * Math.cos((tilt * Math.PI) / 180) + 0.05) * 20) / 20;
  const actualPitch = Math.max(pitchState, minPhysicalPitch);

  const result = calculateInterRowPitch(moduleLength, tilt, criticalSunAlt);
  const isShading = actualPitch < result.minRowPitch;

  // SVG parameters for 2D schematic
  const svgWidth = 620;
  const svgHeight = 220;
  // pixels per meter — shrink automatically so long tables / wide pitches stay inside the drawing
  const drawLengthM =
    Math.max(actualPitch, 0) +
    moduleLength * Math.cos((tilt * Math.PI) / 180) +
    Math.max(0, result.shadowLength - Math.max(0, actualPitch - moduleLength * Math.cos((tilt * Math.PI) / 180))) +
    0.5;
  const scale = Math.min(50, 520 / Math.max(1, drawLengthM), 140 / Math.max(0.3, moduleLength * Math.sin((tilt * Math.PI) / 180)));
  const groundY = 170;
  const row1StartX = 70;

  // Row 1 geometry
  const betaRad = (tilt * Math.PI) / 180;
  const row1EndX = row1StartX + moduleLength * Math.cos(betaRad) * scale;
  const row1TopY = groundY - moduleLength * Math.sin(betaRad) * scale;

  // Row 2 geometry
  const row2StartX = row1StartX + actualPitch * scale;
  const row2EndX = row2StartX + moduleLength * Math.cos(betaRad) * scale;
  const row2TopY = groundY - moduleLength * Math.sin(betaRad) * scale;

  // Shadow end on ground
  const alphaRad = (criticalSunAlt * Math.PI) / 180;
  const shadowLengthMeters = result.shadowLength;
  const shadowEndX = row1EndX + shadowLengthMeters * scale;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5 shadow-sm">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-base font-bold text-slate-900">
          Kalkulator Jarak Antar Baris (Inter-Row Pitch & Self-Shading)
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Cegah bayangan baris depan (self-shading) pada pemasangan multi-baris di atap datar komersial atau PLTS Ground-Mount.
        </p>
      </div>

      {/* Interactive 2D Cross-Section SVG Diagram - Clean White Canvas */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 relative">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold text-slate-800">
            Penampang Samping 2D (Cross-Section View)
          </span>
          <div className="flex items-center gap-2">
            {isShading ? (
              <span className="text-rose-700 font-semibold flex items-center gap-1 bg-rose-50 px-2.5 py-0.5 rounded border border-rose-200">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                Terjadi Bayangan Baris Belakang!
              </span>
            ) : (
              <span className="text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Aman Bebas Bayangan Baris Depan
              </span>
            )}
          </div>
        </div>

        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-44 select-none bg-white rounded-lg border border-slate-200">
          {/* Ground line */}
          <line x1={20} y1={groundY} x2={svgWidth - 20} y2={groundY} stroke="#94a3b8" strokeWidth={2} />

          {/* Shadow polygon on ground */}
          <polygon
            points={`${row1EndX},${groundY} ${shadowEndX},${groundY} ${row1EndX},${row1TopY}`}
            fill="rgba(244, 63, 94, 0.22)"
          />

          {/* Sun Ray Line from top left towards shadow edge */}
          <line
            x1={row1EndX - 100}
            y1={row1TopY - 100 * Math.tan(alphaRad)}
            x2={shadowEndX + 30}
            y2={groundY + 30 * Math.tan(alphaRad)}
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />

          {/* Row 1 (Front Row) */}
          <line
            x1={row1StartX}
            y1={groundY}
            x2={row1EndX}
            y2={row1TopY}
            stroke="#0284c7"
            strokeWidth={7}
            strokeLinecap="round"
          />
          {/* Row 1 Support strut */}
          <line x1={row1EndX} y1={row1TopY} x2={row1EndX} y2={groundY} stroke="#64748b" strokeWidth={2} />
          <text x={row1StartX} y={groundY + 16} className="fill-slate-600 text-[10px] font-mono">
            Baris 1 (Depan)
          </text>

          {/* Row 2 (Back Row) */}
          <line
            x1={row2StartX}
            y1={groundY}
            x2={row2EndX}
            y2={row2TopY}
            stroke={isShading ? '#dc2626' : '#0284c7'}
            strokeWidth={7}
            strokeLinecap="round"
          />
          {/* Row 2 Support strut */}
          <line x1={row2EndX} y1={row2TopY} x2={row2EndX} y2={groundY} stroke="#64748b" strokeWidth={2} />
          <text x={row2StartX} y={groundY + 16} className="fill-slate-600 text-[10px] font-mono">
            Baris 2 (Belakang)
          </text>

          {/* Pitch dimension arrow between row 1 front edge and row 2 front edge */}
          <g>
            <line x1={row1StartX} y1={groundY + 28} x2={row2StartX} y2={groundY + 28} stroke="#d97706" strokeWidth={1.5} />
            <circle cx={row1StartX} cy={groundY + 28} r={2.5} fill="#d97706" />
            <circle cx={row2StartX} cy={groundY + 28} r={2.5} fill="#d97706" />
            <text
              x={(row1StartX + row2StartX) / 2}
              y={groundY + 42}
              textAnchor="middle"
              className="fill-amber-700 font-mono text-[11px] font-bold"
            >
              Jarak Pitch: {actualPitch.toFixed(2)} m
            </text>
          </g>

          {/* Height Dimension H */}
          <g>
            <line x1={row1EndX + 8} y1={groundY} x2={row1EndX + 8} y2={row1TopY} stroke="#94a3b8" strokeWidth={1} strokeDasharray="2 2" />
            <text x={row1EndX + 12} y={(groundY + row1TopY) / 2 + 4} className="fill-slate-500 font-mono text-[9px]">
              H={result.verticalHeight.toFixed(2)}m
            </text>
          </g>

          {/* Tilt angle arc */}
          <path
            d={`M ${row1StartX + 25} ${groundY} A 25 25 0 0 0 ${row1StartX + 25 * Math.cos(betaRad)} ${groundY - 25 * Math.sin(betaRad)}`}
            fill="none"
            stroke="#0284c7"
            strokeWidth={1.5}
          />
          <text x={row1StartX + 32} y={groundY - 8} className="fill-sky-700 font-mono text-[10px] font-semibold">
            {tilt}°
          </text>
        </svg>
      </div>

      {/* Control Sliders for Pitch Tuning */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Jarak Pitch Aktual */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-800">
              Jarak Pitch yang Direncanakan (d):
            </span>
            <span className={`font-mono text-base font-bold ${isShading ? 'text-rose-600' : 'text-emerald-600'}`}>
              {actualPitch.toFixed(2)} meter
            </span>
          </div>
          <input
            type="range"
            min={minPhysicalPitch}
            max="15.0"
            step="0.05"
            value={actualPitch}
            onChange={(e) => setActualPitch(parseFloat(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>Minimum Rekomendasi: <b className="text-amber-700 font-mono font-semibold">{result.minRowPitch.toFixed(2)} m</b></span>
            <button
              onClick={() => {
                setActualPitch(result.minRowPitch);
                onApplyRowSpacing(result.minRowPitch);
              }}
              className="text-amber-600 font-semibold hover:underline"
            >
              Gunakan Nilai Minimum
            </button>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => onApplyRowSpacing(actualPitch)}
              className="px-2.5 py-1 rounded-lg bg-amber-500 text-white font-semibold text-[11px] hover:bg-amber-600"
            >
              Terapkan Pitch {actualPitch.toFixed(2)} m ke Simulasi 3D
            </button>
          </div>
        </div>

        {/* Sudut Kemiringan Modul */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-800">Sudut Kemiringan (β):</span>
            <span className="font-mono text-base font-bold text-amber-700">{tilt}°</span>
          </div>
          <input
            type="range"
            min="0"
            max="45"
            step="1"
            value={tilt}
            onChange={(e) => setTilt(parseInt(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />
          <div className="text-[11px] text-slate-500">
            Makin curam kemiringan, bayangan baris depan makin panjang.
          </div>
        </div>

        {/* Sudut Ketinggian Kritis Matahari */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-800">
              Batas Elevasi Matahari Kritis (α):
            </span>
            <span className="font-mono text-base font-bold text-slate-800">{criticalSunAlt}°</span>
          </div>
          <input
            type="range"
            min="15"
            max="45"
            step="1"
            value={criticalSunAlt}
            onChange={(e) => setCriticalSunAlt(parseInt(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />
          <div className="text-[11px] text-slate-500">
            Standar industri: 20°–25° (kondisi matahari sekitar jam 09:00 / 15:00).
          </div>
        </div>

        {/* Dimensi Panjang Modul */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-slate-800">Panjang Meja Searah Kemiringan (L):</span>
            <span className="font-mono text-base font-bold text-slate-800">{moduleLength.toFixed(2)} m</span>
          </div>
          <input
            type="range"
            min="1.0"
            max="10"
            step="0.05"
            value={moduleLength}
            onChange={(e) => setModuleLength(parseFloat(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />
          <div className="text-[11px] text-slate-500">
            L = jumlah modul searah kemiringan × panjang modul. Satu modul 550 Wp ≈ 2,27 m (potret) atau ≈ 1,13 m (lanskap).
            Nilai awal diambil dari konfigurasi array ({arrayConfig.moduleCountY} × {arrayConfig.moduleLength} m).
          </div>
        </div>
      </div>

      {/* Results Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
          <span className="text-[11px] text-slate-500 block mb-0.5">Tinggi Tepi Atas (H)</span>
          <span className="font-mono text-lg font-bold text-slate-800">{result.verticalHeight} m</span>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
          <span className="text-[11px] text-slate-500 block mb-0.5">Panjang Bayangan (S)</span>
          <span className="font-mono text-lg font-bold text-amber-600">{result.shadowLength} m</span>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
          <span className="text-[11px] text-slate-500 block mb-0.5">Jarak Pitch Minimum</span>
          <span className="font-mono text-lg font-bold text-emerald-600">{result.minRowPitch} m</span>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
          <span className="text-[11px] text-slate-500 block mb-0.5">Jarak Bebas (Walkway)</span>
          <span className="font-mono text-lg font-bold text-sky-600">{result.freeSpacing} m</span>
        </div>
      </div>
    </div>
  );
};
