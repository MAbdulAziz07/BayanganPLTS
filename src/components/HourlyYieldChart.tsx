import { formatClock } from '../utils/solarMath';
import React from 'react';
import { HourlySimPoint, DailySimulationResult } from '../types/solar';

interface HourlyYieldChartProps {
  dailyResult: DailySimulationResult;
  currentHour: number;
  tzLabel?: string;
  onSelectHour: (hour: number) => void;
  /** Versi ringkas untuk ditempel di atas tampilan 3D (layar penuh) */
  compact?: boolean;
}

export const HourlyYieldChart: React.FC<HourlyYieldChartProps> = ({
  dailyResult,
  currentHour,
  onSelectHour,
  tzLabel = 'WIB',
  compact = false,
}) => {
  const { hourly } = dailyResult;
  if (!hourly || hourly.length === 0) return null;

  // Chart dimensions
  const svgWidth = 640;
  const svgHeight = 220;
  const padLeft = 50;
  const padRight = 55;
  const padTop = 25;
  const padBottom = 35;

  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  // Max values for scaling
  const maxPOA = 1100; // W/m²
  const maxPower = Math.max(0.5, Math.ceil(dailyResult.systemCapacityKWp * 1.1));

  // Compute SVG polyline points for POA (left Y axis) and Power (right Y axis)
  const H_START = 5;
  const H_END = 19;
  const getX = (h: number) => padLeft + ((h - H_START) / (H_END - H_START)) * chartW;
  const getYPOA = (poa: number) => padTop + chartH - (Math.min(maxPOA, poa) / maxPOA) * chartH;
  const getYPower = (kw: number) => padTop + chartH - (Math.min(maxPower, kw) / maxPower) * chartH;

  // Build paths
  const unshadedPOAPoints = hourly.map((pt) => `${getX(pt.hour)},${getYPOA(pt.irradiance.poaTotalUnshaded)}`).join(' ');
  const actualPowerPoints = hourly.map((pt) => `${getX(pt.hour)},${getYPower(pt.acPowerKW)}`).join(' ');
  const unshadedPowerPoints = hourly.map((pt) => `${getX(pt.hour)},${getYPower(pt.unshadedACPowerKW)}`).join(' ');

  // Area under actual power curve
  const firstPt = hourly[0];
  const lastPt = hourly[hourly.length - 1];
  const powerAreaPath = `M ${getX(firstPt.hour)},${getYPower(0)} L ${actualPowerPoints} L ${getX(lastPt.hour)},${getYPower(0)} Z`;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col shadow-sm">
      {/* Header and Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {compact ? 'Kurva Produksi Harian' : 'Kurva Produksi Harian (Hourly Yield Profile)'}
          </h3>
          <p className={`text-[11px] text-slate-500 ${compact ? 'hidden' : ''}`}>
            Klik pada grafik untuk menggeser jam simulasi dan melihat bayangan secara interaktif.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600">
            <span className="w-3 h-0.5 bg-amber-500 inline-block rounded-full" />
            <span>Radiasi Bidang (POA)</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600">
            <span className="w-3 h-0.5 bg-slate-400 border-b border-dashed border-slate-500 inline-block" />
            <span>Daya Ideal Tanpa Bayang</span>
          </div>
          <div className="flex items-center gap-1.5 text-sky-700">
            <span className="w-3 h-1.5 bg-sky-500 inline-block rounded-sm" />
            <span className="font-semibold">Daya Aktual Terbayang</span>
          </div>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className={`w-full h-auto select-none ${compact ? '' : 'min-w-[520px]'}`}
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padTop + chartH * (1 - ratio);
            const poaVal = Math.round(ratio * maxPOA);
            const pwrVal = (ratio * maxPower).toFixed(1);
            return (
              <g key={ratio}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgWidth - padRight}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                />
                {/* Left Y Axis Label (POA W/m²) */}
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-500 text-[11px] font-mono"
                >
                  {poaVal}
                </text>
                {/* Right Y Axis Label (kW) */}
                <text
                  x={svgWidth - padRight + 6}
                  y={y + 3}
                  textAnchor="start"
                  className="fill-sky-700 text-[11px] font-mono font-medium"
                >
                  {pwrVal}kW
                </text>
              </g>
            );
          })}

          {/* Shaded Area Loss between Ideal and Actual */}
          {hourly.map((pt, i) => {
            if (i === 0) return null;
            const prev = hourly[i - 1];
            if (pt.shadingLossPercent <= 1 && prev.shadingLossPercent <= 1) return null;

            const x1 = getX(prev.hour);
            const x2 = getX(pt.hour);
            const yIdeal1 = getYPower(prev.unshadedACPowerKW);
            const yIdeal2 = getYPower(pt.unshadedACPowerKW);
            const yAct1 = getYPower(prev.acPowerKW);
            const yAct2 = getYPower(pt.acPowerKW);

            return (
              <polygon
                key={`shade-loss-${pt.hour}`}
                points={`${x1},${yIdeal1} ${x2},${yIdeal2} ${x2},${yAct2} ${x1},${yAct1}`}
                fill="rgba(239, 68, 68, 0.22)"
              />
            );
          })}

          {/* Area fill for actual power */}
          <path d={powerAreaPath} fill="rgba(14, 165, 233, 0.12)" />

          {/* Line 1: POA Irradiance (Gold line) */}
          <polyline
            points={unshadedPOAPoints}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="1.5"
            strokeOpacity="0.85"
          />

          {/* Line 2: Ideal Unshaded AC Power (Dashed slate) */}
          <polyline
            points={unshadedPowerPoints}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Line 3: Actual AC Power with Shading (Solid Sky Blue) */}
          <polyline
            points={actualPowerPoints}
            fill="none"
            stroke="#0284c7"
            strokeWidth="2.5"
          />

          {/* Current Hour Indicator Vertical Line */}
          {currentHour >= H_START && currentHour <= H_END && (
            <g>
              <line
                x1={getX(currentHour)}
                y1={padTop}
                x2={getX(currentHour)}
                y2={padTop + chartH}
                stroke="#d97706"
                strokeWidth="1.5"
              />
              <circle
                cx={getX(currentHour)}
                cy={getYPower(
                  hourly.find((h) => Math.abs(h.hour - currentHour) < 0.3)?.acPowerKW || 0
                )}
                r="4.5"
                fill="#d97706"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          )}

          {/* X Axis Hours */}
          {[5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((h) => (
            <g key={h}>
              <line
                x1={getX(h)}
                y1={padTop + chartH}
                x2={getX(h)}
                y2={padTop + chartH + 4}
                stroke="#cbd5e1"
              />
              {h % 2 === 1 && (
                <text
                  x={getX(h)}
                  y={padTop + chartH + 18}
                  textAnchor="middle"
                  className="fill-slate-600 text-[12px] font-mono"
                >
                  {String(h).padStart(2, '0')}:00
                </text>
              )}
            </g>
          ))}

          {/* Invisible interactive click rects */}
          {hourly.map((pt) => (
            <rect
              key={`click-${pt.hour}`}
              x={getX(pt.hour) - 10}
              y={padTop}
              width={20}
              height={chartH}
              fill="transparent"
              className="cursor-pointer hover:fill-amber-500/10"
              onClick={() => onSelectHour(pt.hour)}
            >
              <title>{`Pukul ${formatClock(pt.hour)} ${tzLabel}: ${pt.acPowerKW.toFixed(2)} kW (Rugi: ${pt.shadingLossPercent}%)`}</title>
            </rect>
          ))}
        </svg>
      </div>

      {/* Hourly Summary Ticker */}
      <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
        <div>
          <span>Area Merah: </span>
          <span className="text-rose-600 font-medium">
            Energi Hilang Akibat Bayangan ({dailyResult.energyLostKWh.toFixed(2)} kWh)
          </span>
        </div>
        <div className="text-slate-800 font-mono">
          Puncak Daya: <b className="text-sky-700">{dailyResult.peakPowerKW.toFixed(2)} kW</b> pada pukul {formatClock(dailyResult.peakHour)} {tzLabel}
        </div>
      </div>
    </div>
  );
};
