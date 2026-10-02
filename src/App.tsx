import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LocationConfig,
  PVArrayConfig,
  ObstacleConfig,
} from './types/solar';
import {
  CITIES_INDONESIA,
  calculateSolarPosition,
  calculateIrradiance,
  getDayOfYear,
} from './utils/solarMath';
import {
  calculateArrayShading,
  simulateFullDay,
} from './utils/shadingMath';
import { Header } from './components/Header';
import { MetricsCards } from './components/MetricsCards';
import { Solar3DViewport } from './components/Solar3DViewport';
import { ControlsPanel } from './components/ControlsPanel';
import { HourlyYieldChart } from './components/HourlyYieldChart';
import { TiltSensitivityChart } from './components/TiltSensitivityChart';
import { InterRowCalculator } from './components/InterRowCalculator';
import { BypassDiodeExplanation } from './components/BypassDiodeExplanation';
import { ScenarioPresets } from './components/ScenarioPresets';
import { ReportModal } from './components/ReportModal';

export default function App() {
  // Navigation tab
  const [activeTab, setActiveTab] = useState<'simulasi' | 'analisis_slope' | 'jarak_baris' | 'bypass_diode'>('simulasi');

  // Location and Time
  const [location, setLocation] = useState<LocationConfig>(CITIES_INDONESIA[0]); // Jakarta
  const [month, setMonth] = useState<number>(7); // July (Solstis Utara)
  const [hour, setHour] = useState<number>(9.5); // 09:30 AM
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // PV Array Configuration
  const [arrayConfig, setArrayConfig] = useState<PVArrayConfig>({
    moduleCountX: 4, // 4 columns
    moduleCountY: 2, // 2 rows = 8 modules total
    moduleWattage: 550, // 550 Wp
    moduleLength: 2.27, // 2.27 m
    moduleWidth: 1.13, // 1.13 m
    tilt: 15, // 15° slope
    azimuth: 0, // Facing North (optimal for Indonesia S)
    mountHeight: 1.0,
    mountType: 'rooftop_sloped',
    inverterType: 'string',
    rowSpacing: 2.5,
  });

  // Nearby Obstacles
  const [obstacles, setObstacles] = useState<ObstacleConfig[]>([
    {
      id: 'tree_1',
      type: 'tree',
      name: 'Pohon Mangga (Timur)',
      enabled: true,
      distance: 5.5,
      azimuth: 85, // East morning
      height: 6.5,
      width: 4.5,
      baseElevation: 0,
    },
    {
      id: 'building_1',
      type: 'building',
      name: 'Gedung Tetangga (Barat)',
      enabled: false,
      distance: 9.0,
      azimuth: 260, // West afternoon
      height: 9.0,
      width: 6.0,
      depth: 5.0,
      baseElevation: 0,
    },
  ]);

  // Report Modal
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Day of year
  const dayOfYear = useMemo(() => getDayOfYear(month, 15), [month]);

  // Instantaneous Solar Position
  const solarPos = useMemo(
    () => calculateSolarPosition(location.latitude, dayOfYear, hour),
    [location.latitude, dayOfYear, hour]
  );

  // Instantaneous Irradiance Data
  const irradiance = useMemo(
    () => calculateIrradiance(solarPos, arrayConfig.tilt, arrayConfig.azimuth),
    [solarPos, arrayConfig.tilt, arrayConfig.azimuth]
  );

  // Instantaneous Array Shading & Module States
  const shadingResult = useMemo(
    () => calculateArrayShading(arrayConfig, obstacles, solarPos),
    [arrayConfig, obstacles, solarPos]
  );

  // Instantaneous Power Calculations
  const totalKWp = (arrayConfig.moduleCountX * arrayConfig.moduleCountY * arrayConfig.moduleWattage) / 1000;
  const inverterEfficiency = 0.96;
  const tempDerating = 0.90;

  const currentUnshadedPowerKW = solarPos.isDaylight
    ? totalKWp * (irradiance.poaTotalUnshaded / 1000) * tempDerating * inverterEfficiency
    : 0;

  const currentACPowerKW = solarPos.isDaylight
    ? totalKWp * (irradiance.poaTotalUnshaded / 1000) * tempDerating * shadingResult.mismatchFactor * inverterEfficiency
    : 0;

  const currentLossPercent = currentUnshadedPowerKW > 0.01
    ? Math.max(0, Math.min(100, ((currentUnshadedPowerKW - currentACPowerKW) / currentUnshadedPowerKW) * 100))
    : 0;

  // Full Day Simulation Profile (Cached per config & month)
  const dailyResult = useMemo(
    () => simulateFullDay(location.latitude, month, arrayConfig, obstacles),
    [location.latitude, month, arrayConfig, obstacles]
  );

  // Sun Movement Animation Loop
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = window.setInterval(() => {
        setHour((prev) => {
          const next = prev + 0.15;
          if (next > 18.0) return 6.0; // loop back to 06:00
          return parseFloat(next.toFixed(2));
        });
      }, 120);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying]);

  // Reset to default baseline
  const handleReset = () => {
    setLocation(CITIES_INDONESIA[0]);
    setMonth(7);
    setHour(9.5);
    setIsPlaying(false);
    setArrayConfig({
      moduleCountX: 4,
      moduleCountY: 2,
      moduleWattage: 550,
      moduleLength: 2.27,
      moduleWidth: 1.13,
      tilt: 15,
      azimuth: 0,
      mountHeight: 1.0,
      mountType: 'rooftop_sloped',
      inverterType: 'string',
      rowSpacing: 2.5,
    });
    setObstacles([
      {
        id: 'tree_1',
        type: 'tree',
        name: 'Pohon Mangga (Timur)',
        enabled: true,
        distance: 5.5,
        azimuth: 85,
        height: 6.5,
        width: 4.5,
        baseElevation: 0,
      },
    ]);
  };

  // Scenario Loader
  const handleSelectScenario = (
    loc: LocationConfig,
    array: PVArrayConfig,
    obs: ObstacleConfig[],
    m: number,
    h: number
  ) => {
    setLocation(loc);
    setArrayConfig(array);
    setObstacles(obs);
    setMonth(m);
    setHour(h);
    setIsPlaying(false);
    setActiveTab('simulasi');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900 font-sans">
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenReport={() => setIsReportOpen(true)}
        onReset={handleReset}
      />

      {/* Main Content Area */}
      <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto space-y-4">
        {/* TAB 1: SIMULASI 3D & WAKTU NYATA */}
        {activeTab === 'simulasi' && (
          <div className="space-y-4">
            {/* Quick Scenario Bar */}
            <ScenarioPresets onSelectScenario={handleSelectScenario} />

            {/* Metrics HUD Row */}
            <MetricsCards
              irradiance={irradiance}
              currentACPowerKW={currentACPowerKW}
              currentUnshadedPowerKW={currentUnshadedPowerKW}
              currentLossPercent={currentLossPercent}
              dailyResult={dailyResult}
              arrayConfig={arrayConfig}
            />

            {/* 3D Visualizer & Side Controls Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch min-h-[520px]">
              {/* Left: 3D Stage (7 cols on large desktop) */}
              <div className="lg:col-span-8 flex flex-col gap-4">
                <div className="flex-1 min-h-[440px]">
                  <Solar3DViewport
                    arrayConfig={arrayConfig}
                    obstacles={obstacles}
                    solarPos={solarPos}
                    moduleStates={shadingResult.modules}
                    totalShadedFraction={shadingResult.totalShadedFraction}
                    latitude={location.latitude}
                    dayOfYear={dayOfYear}
                    hour={hour}
                  />
                </div>

                {/* Daily Yield Chart under 3D Viewport */}
                <HourlyYieldChart
                  dailyResult={dailyResult}
                  currentHour={hour}
                  onSelectHour={(h) => setHour(h)}
                />
              </div>

              {/* Right: Comprehensive Controls Deck (4 cols) */}
              <div className="lg:col-span-4 flex flex-col">
                <ControlsPanel
                  location={location}
                  setLocation={setLocation}
                  month={month}
                  setMonth={setMonth}
                  hour={hour}
                  setHour={setHour}
                  isPlaying={isPlaying}
                  setIsPlaying={setIsPlaying}
                  arrayConfig={arrayConfig}
                  setArrayConfig={setArrayConfig}
                  obstacles={obstacles}
                  setObstacles={setObstacles}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ANALISIS SUDUT KEMIRINGAN (SLOPE) */}
        {activeTab === 'analisis_slope' && (
          <TiltSensitivityChart
            location={location}
            arrayConfig={arrayConfig}
            onApplyTilt={(t, az) => {
              setArrayConfig((prev) => ({ ...prev, tilt: t, azimuth: az }));
              setActiveTab('simulasi');
            }}
          />
        )}

        {/* TAB 3: KALKULATOR JARAK ANTAR BARIS */}
        {activeTab === 'jarak_baris' && (
          <InterRowCalculator
            arrayConfig={arrayConfig}
            onApplyRowSpacing={(spacing) => {
              setArrayConfig((prev) => ({ ...prev, rowSpacing: spacing }));
              setActiveTab('simulasi');
            }}
          />
        )}

        {/* TAB 4: BYPASS DIODE & MISMATCH FISIKA */}
        {activeTab === 'bypass_diode' && <BypassDiodeExplanation />}
      </main>

      {/* Technical Report Modal */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        location={location}
        arrayConfig={arrayConfig}
        obstacles={obstacles}
        month={month}
        dailyResult={dailyResult}
      />
    </div>
  );
}
