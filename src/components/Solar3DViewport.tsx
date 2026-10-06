import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PVArrayConfig, ObstacleConfig, SolarPosition, PanelColorMode } from '../types/solar';
import { DEG2RAD, calculateSolarPosition } from '../utils/solarMath';
import { frontRowOffset, getTreeGeometry, obstacleCenterDistance } from '../utils/shadingMath';
import { Compass, Eye, Sun, Maximize2, Minimize2, ShieldAlert, Palette, Check, ChevronDown, X, Wind } from 'lucide-react';
import { createRealisticTree, AnimatedTree } from './tree3d';
import { createRealisticBuilding } from './building3d';

export const PANEL_COLOR_OPTIONS: {
  id: PanelColorMode;
  label: string;
  shortLabel: string;
  badge: string;
  description: string;
  swatchClass: string;
  borderClass: string;
  dotColor: string;
}[] = [
  {
    id: 'high_contrast',
    label: 'Perak (Kontras Tinggi)',
    shortLabel: 'Perak',
    badge: 'Bayangan paling jelas',
    description: 'Permukaan perak terang; siluet bayangan pohon & gedung tampak hitam pekat dan tajam',
    swatchClass: 'bg-slate-200',
    borderClass: 'border-slate-400',
    dotColor: '#e2e8f0',
  },
  {
    id: 'sky_blue',
    label: 'Biru Langit',
    shortLabel: 'Biru Langit',
    badge: 'Mirip modul asli',
    description: 'Biru cerah menyerupai modul surya, bayangan tetap mudah terlihat',
    swatchClass: 'bg-blue-400',
    borderClass: 'border-blue-600',
    dotColor: '#60a5fa',
  },
];

// Helper: Creates high-contrast solar cell texture with wafer grid & bypass diode sub-string zones
function createModuleCanvasTexture(colorMode: PanelColorMode): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  let baseFill = '#94a3b8';
  let cellFill = '#f1f5f9';
  let busbarColor = 'rgba(71, 85, 105, 0.45)';
  let cellBorder = '#cbd5e1';
  let dividerColor = 'rgba(51, 65, 85, 0.85)';

  if (colorMode === 'high_contrast') {
    // Silver / Platinum: Extremely bright reflective surface, shadows cast on it are pitch dark & razor-sharp!
    baseFill = '#94a3b8';
    cellFill = '#f1f5f9';
    busbarColor = 'rgba(71, 85, 105, 0.45)';
    cellBorder = '#cbd5e1';
    dividerColor = 'rgba(51, 65, 85, 0.9)';
  } else if (colorMode === 'sky_blue') {
    baseFill = '#1d4ed8';
    cellFill = '#60a5fa';
    busbarColor = 'rgba(255, 255, 255, 0.6)';
    cellBorder = '#93c5fd';
    dividerColor = 'rgba(255, 255, 255, 0.95)';
  }

  // Base wafer background
  ctx.fillStyle = baseFill;
  ctx.fillRect(0, 0, 512, 1024);

  // 6 columns x 10 rows of solar cells with subtle wafer gaps
  const cols = 6;
  const rows = 10;
  const cellW = 512 / cols;
  const cellH = 1024 / rows;
  const gap = 3;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellW;
      const y = r * cellH;

      // Solar cell wafer (slightly rounded corners for modern cell realism)
      ctx.fillStyle = cellFill;
      ctx.beginPath();
      const radius = 4;
      const rx = x + gap;
      const ry = y + gap;
      const rw = cellW - gap * 2;
      const rh = cellH - gap * 2;
      ctx.roundRect(rx, ry, rw, rh, radius);
      ctx.fill();

      // Subtle cell border
      ctx.strokeStyle = cellBorder;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Fine busbars across each cell
      ctx.strokeStyle = busbarColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + cellW * 0.25, ry + 2);
      ctx.lineTo(x + cellW * 0.25, ry + rh - 2);
      ctx.moveTo(x + cellW * 0.5, ry + 2);
      ctx.lineTo(x + cellW * 0.5, ry + rh - 2);
      ctx.moveTo(x + cellW * 0.75, ry + 2);
      ctx.lineTo(x + cellW * 0.75, ry + rh - 2);
      ctx.stroke();
    }
  }

  // 3 distinct Sub-string divider lines (bypass diode string zones)
  ctx.strokeStyle = dividerColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cellW * 2, 0);
  ctx.lineTo(cellW * 2, 1024);
  ctx.moveTo(cellW * 4, 0);
  ctx.lineTo(cellW * 4, 1024);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface Solar3DViewportProps {
  arrayConfig: PVArrayConfig;
  obstacles: ObstacleConfig[];
  solarPos: SolarPosition;
  totalShadedFraction: number;
  latitude: number;
  longitude: number;
  timezoneOffset: number;
  dayOfYear: number;
  hour: number;
  panelColorMode?: PanelColorMode;
  onPanelColorChange?: (mode: PanelColorMode) => void;
  /** Konten yang ditempel di atas tampilan 3D saat mode layar penuh (mis. kurva produksi harian) */
  fullscreenOverlay?: React.ReactNode;
}

type ViewPreset = 'perspective' | 'top' | 'side' | 'sun';
const VIEW_OPTIONS: { id: ViewPreset; label: string; hint: string }[] = [
  { id: 'perspective', label: 'Perspektif 3D', hint: 'Sudut pandang miring standar' },
  { id: 'top', label: 'Atas (Top)', hint: 'Melihat bayangan dari atas' },
  { id: 'side', label: 'Samping (Tilt)', hint: 'Melihat sudut kemiringan modul' },
  { id: 'sun', label: 'Matahari (LOS)', hint: 'Melihat dari arah datang sinar matahari' },
];

export const Solar3DViewport: React.FC<Solar3DViewportProps> = ({
  arrayConfig,
  obstacles,
  solarPos,
  totalShadedFraction,
  latitude,
  longitude,
  timezoneOffset,
  dayOfYear,
  hour,
  panelColorMode,
  onPanelColorChange,
  fullscreenOverlay,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);

  // Sinkronkan state dengan Fullscreen API (termasuk saat keluar lewat tombol Esc)
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await wrapperRef.current?.requestFullscreen();
    } catch {
      /* browser menolak fullscreen — abaikan */
    }
  };

  // Tutup dropdown sudut pandang saat klik di luar
  useEffect(() => {
    if (!isViewMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) setIsViewMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [isViewMenuOpen]);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Dynamic mesh group references
  const arrayGroupRef = useRef<THREE.Group | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const sunMeshRef = useRef<THREE.Mesh | null>(null);
  const sunArcRef = useRef<THREE.Line | null>(null);
  const obstaclesGroupRef = useRef<THREE.Group | null>(null);
  const moduleMeshesRef = useRef<THREE.Mesh[]>([]);
  // Pohon animasi (bergoyang tertiup angin)
  const treesRef = useRef<AnimatedTree[]>([]);
  const windTargetRef = useRef(1);
  const [windOn, setWindOn] = useState(true);

  const [viewPreset, setViewPreset] = useState<ViewPreset>('perspective');
  const [showSunArc, setShowSunArc] = useState(true);
  const [internalPanelColorMode, setInternalPanelColorMode] = useState<PanelColorMode>('sky_blue');
  const activeColorMode = panelColorMode ?? internalPanelColorMode;
  const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
  const colorMenuRef = useRef<HTMLDivElement>(null);

  // Close color dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (colorMenuRef.current && !colorMenuRef.current.contains(e.target as Node)) {
        setIsColorMenuOpen(false);
      }
    };
    if (isColorMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isColorMenuOpen]);

  const handleColorChange = (mode: PanelColorMode) => {
    if (onPanelColorChange) {
      onPanelColorChange(mode);
    } else {
      setInternalPanelColorMode(mode);
    }
  };

  // Initialize Three.js scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0xb9d8f0);
    scene.fog = new THREE.Fog(0xc6dff0, 55, 110);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);
    camera.position.set(10, 8, 12);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.05; // don't go below ground
    controls.minDistance = 3;
    controls.maxDistance = 60;
    controls.target.set(0, 1.2, 0);
    controlsRef.current = controls;

    // Ambient light - balanced for distinct, high-contrast shadows on white ground and panels
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.32);
    scene.add(ambientLight);

    // Hemisphere light for sky/ground contrast
    const hemiLight = new THREE.HemisphereLight(0xd9edff, 0x71835c, 0.65);
    scene.add(hemiLight);

    // Directional Sun Light
    const sunLight = new THREE.DirectionalLight(0xffedcf, 2.5);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 85;
    const d = 16;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0002;
    sunLight.shadow.normalBias = 0.015;
    sunLight.shadow.radius = 4;
    scene.add(sunLight);
    scene.add(sunLight.target);
    sunLightRef.current = sunLight;

    // Sun Visual Mesh
    const sunGeom = new THREE.SphereGeometry(0.42, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffdf91 });
    const sunMesh = new THREE.Mesh(sunGeom, sunMat);
    scene.add(sunMesh);
    sunMeshRef.current = sunMesh;

    // Sun Glow Halo
    const haloGeom = new THREE.SphereGeometry(1.2, 16, 16);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xfef3c7,
      transparent: true,
      opacity: 0.35,
      wireframe: true,
    });
    const haloMesh = new THREE.Mesh(haloGeom, haloMat);
    sunMesh.add(haloMesh);

    // Ground Platform - Clean White/Off-White for maximum shadow clarity
    const groundGeom = new THREE.PlaneGeometry(60, 60, 32, 32);
    const groundCanvas = document.createElement('canvas');
    groundCanvas.width = 512;
    groundCanvas.height = 512;
    const groundContext = groundCanvas.getContext('2d');
    if (groundContext) {
      groundContext.fillStyle = '#9aa77d';
      groundContext.fillRect(0, 0, 512, 512);
      let groundSeed = 813;
      for (let i = 0; i < 6500; i++) {
        groundSeed = (groundSeed * 16807) % 2147483647;
        const x = (groundSeed / 2147483647) * 512;
        groundSeed = (groundSeed * 16807) % 2147483647;
        const y = (groundSeed / 2147483647) * 512;
        const radius = 0.5 + (groundSeed % 15) / 10;
        groundContext.fillStyle = i % 3 === 0 ? 'rgba(62,82,45,0.12)' : 'rgba(225,217,163,0.11)';
        groundContext.beginPath();
        groundContext.arc(x, y, radius, 0, Math.PI * 2);
        groundContext.fill();
      }
    }
    const groundTexture = new THREE.CanvasTexture(groundCanvas);
    groundTexture.colorSpace = THREE.SRGBColorSpace;
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(18, 18);
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTexture,
      color: 0x9aa77d,
      roughness: 0.95,
      metalness: 0,
    });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Faint measurement grid keeps the engineering context while letting the scene read as a site.
    const grid = new THREE.GridHelper(50, 50, 0x71805f, 0x879473);
    grid.material.transparent = true;
    grid.material.opacity = 0.12;
    grid.position.y = 0.008;
    scene.add(grid);

    // Compass ring on ground
    const compassGroup = createCompassRing();
    scene.add(compassGroup);

    // Groups
    const arrayGroup = new THREE.Group();
    scene.add(arrayGroup);
    arrayGroupRef.current = arrayGroup;

    const obstaclesGroup = new THREE.Group();
    scene.add(obstaclesGroup);
    obstaclesGroupRef.current = obstaclesGroup;

    // Animation loop
    let animationFrameId: number;
    const clock = new THREE.Clock();
    let windLevel = windTargetRef.current;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const t = clock.elapsedTime;
      // Transisi halus (±1 detik) saat angin dinyalakan/dimatikan, tidak bergantung FPS
      windLevel += (windTargetRef.current - windLevel) * (1 - Math.exp(-dt * 2.5));
      for (const tree of treesRef.current) tree.update(t, windLevel);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    // Ikuti perubahan ukuran wadah (mis. masuk/keluar layar penuh)
    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      treesRef.current.forEach((tree) => tree.dispose());
      treesRef.current = [];
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Sun Position and Sun Arc
  useEffect(() => {
    if (!sunLightRef.current || !sunMeshRef.current || !sceneRef.current) return;

    const sunDistance = 30;
    const altRad = solarPos.altitude * DEG2RAD;
    const azRad = solarPos.azimuth * DEG2RAD;

    // Calculate Cartesian coordinates
    // Azimuth: 0 = North (+Z), 90 = East (+X), 180 = South (-Z), 270 = West (-X)
    const sunX = Math.sin(azRad) * Math.cos(altRad) * sunDistance;
    const sunY = Math.sin(altRad) * sunDistance;
    const sunZ = Math.cos(azRad) * Math.cos(altRad) * sunDistance;

    if (solarPos.isDaylight && solarPos.altitude > 0) {
      sunLightRef.current.position.set(sunX, sunY, sunZ);
      sunLightRef.current.target.position.set(0, 1.2, 0);
      sunLightRef.current.intensity = 2.5 * Math.sin(altRad);
      sunLightRef.current.visible = true;

      sunMeshRef.current.position.set(sunX, sunY, sunZ);
      sunMeshRef.current.visible = true;
    } else {
      sunLightRef.current.visible = false;
      sunMeshRef.current.visible = false;
    }

    // Build or update sun trajectory arc for today
    if (sunArcRef.current) {
      sceneRef.current.remove(sunArcRef.current);
      sunArcRef.current.geometry.dispose();
      sunArcRef.current = null;
    }

    if (showSunArc) {
      const arcPoints: THREE.Vector3[] = [];
      for (let h = 4.5; h <= 19.5; h += 0.25) {
        const p = calculateSolarPosition(latitude, dayOfYear, h, longitude, timezoneOffset);
        if (p.altitude > -2) {
          const aR = p.altitude * DEG2RAD;
          const azR = p.azimuth * DEG2RAD;
          const px = Math.sin(azR) * Math.cos(aR) * sunDistance;
          const py = Math.sin(aR) * sunDistance;
          const pz = Math.cos(azR) * Math.cos(aR) * sunDistance;
          arcPoints.push(new THREE.Vector3(px, Math.max(0.1, py), pz));
        }
      }

      if (arcPoints.length > 2) {
        const arcGeom = new THREE.BufferGeometry().setFromPoints(arcPoints);
        const arcMat = new THREE.LineBasicMaterial({
          color: 0xf59e0b,
          transparent: true,
          opacity: 0.55,
        });
        const arcLine = new THREE.Line(arcGeom, arcMat);
        sceneRef.current.add(arcLine);
        sunArcRef.current = arcLine;
      }
    }
  }, [solarPos, latitude, longitude, timezoneOffset, dayOfYear, showSunArc]);

  // Update PV Array Geometry (Tilt, Azimuth, Rack, Modules, Shading Colors)
  useEffect(() => {
    if (!arrayGroupRef.current) return;
    const group = arrayGroupRef.current;

    // Clear old children
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      child.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
    }
    moduleMeshesRef.current = [];

    const { moduleCountX, moduleCountY, moduleWidth, moduleLength, tilt, azimuth, mountHeight } = arrayConfig;
    const totalW = moduleCountX * moduleWidth;
    const totalL = moduleCountY * moduleLength;

    // Sub-group for tilt rotation
    const tiltGroup = new THREE.Group();
    tiltGroup.position.set(0, mountHeight, 0);

    // Orientation: the panel FACES `azimuth` (0=N, 90=E, 180=S, 270=W), so its high edge points the
    // opposite way → yaw by azimuth + 180°. Order 'YXZ' = tilt about the row axis first, then yaw
    // (same convention as arrayLocalToWorld() in shadingMath).
    tiltGroup.rotation.order = 'YXZ';
    tiltGroup.rotation.y = (azimuth + 180) * DEG2RAD;
    tiltGroup.rotation.x = -tilt * DEG2RAD;

    // Build Aluminum mounting frame rails underneath
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.8,
      roughness: 0.3,
    });
    const railGeom = new THREE.BoxGeometry(totalW + 0.2, 0.06, 0.06);

    for (let r = 0; r <= moduleCountY; r++) {
      const railMesh = new THREE.Mesh(railGeom, railMat);
      railMesh.position.set(0, -0.05, (r / moduleCountY - 0.5) * totalL);
      railMesh.castShadow = true;
      tiltGroup.add(railMesh);
    }

    // Build individual modules with high-contrast bright color for maximum shadow visibility
    const moduleTexture = createModuleCanvasTexture(activeColorMode);

    const normalFrameMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1, // clean bright anodized aluminum silver
      metalness: 0.65,
      roughness: 0.35,
    });

    const cellGeom = new THREE.PlaneGeometry(moduleWidth - 0.04, moduleLength - 0.04);
    const borderGeom = new THREE.BoxGeometry(moduleWidth, 0.035, moduleLength);

    for (let r = 0; r < moduleCountY; r++) {
      for (let c = 0; c < moduleCountX; c++) {
        // Position on slope
        const posX = (c + 0.5) * moduleWidth - totalW / 2;
        const posZ = (r + 0.5) * moduleLength - totalL / 2;

        const modGroup = new THREE.Group();
        modGroup.position.set(posX, 0, posZ);

        // Keep module frames neutral; real shadows show the shading pattern without false colors.
        const frameMesh = new THREE.Mesh(borderGeom, normalFrameMat);
        frameMesh.position.set(0, 0, 0);
        frameMesh.castShadow = true;
        frameMesh.receiveShadow = true;
        modGroup.add(frameMesh);

        // Low-gloss silicon texture provides a more familiar modern PV appearance.
        const cellMat = new THREE.MeshStandardMaterial({
          map: moduleTexture,
          color: 0xffffff,
          roughness: 0.45,
          metalness: 0.08,
        });

        const cellMesh = new THREE.Mesh(cellGeom, cellMat);
        cellMesh.rotation.x = -Math.PI / 2;
        cellMesh.position.set(0, 0.019, 0);
        cellMesh.castShadow = true;
        cellMesh.receiveShadow = true;
        modGroup.add(cellMesh);
        moduleMeshesRef.current.push(cellMesh);

        tiltGroup.add(modGroup);
      }
    }

    // Support legs / ground racks down to ground
    const legMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.7,
      roughness: 0.5,
    });
    const legRadius = 0.04;

    // Compute leg points in world space
    const legPointsLocal = [
      [-totalW / 2 + 0.1, -totalL / 2 + 0.1],
      [totalW / 2 - 0.1, -totalL / 2 + 0.1],
      [-totalW / 2 + 0.1, totalL / 2 - 0.1],
      [totalW / 2 - 0.1, totalL / 2 - 0.1],
    ];

    legPointsLocal.forEach(([lx, lz]) => {
      // Calculate world position of this hinge attachment
      const localVec = new THREE.Vector3(lx, 0, lz);
      localVec.applyAxisAngle(new THREE.Vector3(1, 0, 0), -tilt * DEG2RAD);
      localVec.applyAxisAngle(new THREE.Vector3(0, 1, 0), (azimuth + 180) * DEG2RAD);
      const topY = mountHeight + localVec.y;
      const legHeight = Math.max(0.1, topY);

      const legGeom = new THREE.CylinderGeometry(legRadius, legRadius, legHeight, 8);
      const legMesh = new THREE.Mesh(legGeom, legMat);
      legMesh.position.set(localVec.x, legHeight / 2, localVec.z);
      legMesh.castShadow = true;
      group.add(legMesh);
    });

    group.add(tiltGroup);

    // Identical PV row in front (multi-row / self-shading study)
    if (arrayConfig.frontRowEnabled) {
      const off = frontRowOffset(arrayConfig);
      const frontGroup = new THREE.Group();
      frontGroup.position.set(off[0], mountHeight, off[2]);
      frontGroup.rotation.order = 'YXZ';
      frontGroup.rotation.y = (azimuth + 180) * DEG2RAD;
      frontGroup.rotation.x = -tilt * DEG2RAD;
      const slabMat = new THREE.MeshStandardMaterial({
        map: moduleTexture,
        roughness: 0.3,
        metalness: 0.05,
      });
      const slab = new THREE.Mesh(new THREE.BoxGeometry(totalW, 0.04, totalL), slabMat);
      slab.castShadow = true;
      slab.receiveShadow = true;
      frontGroup.add(slab);
      group.add(frontGroup);

      legPointsLocal.forEach(([lx, lz]) => {
        const v = new THREE.Vector3(lx, 0, lz);
        v.applyAxisAngle(new THREE.Vector3(1, 0, 0), -tilt * DEG2RAD);
        v.applyAxisAngle(new THREE.Vector3(0, 1, 0), (azimuth + 180) * DEG2RAD);
        const legHeight = Math.max(0.1, mountHeight + v.y);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(legRadius, legRadius, legHeight, 8), legMat);
        leg.position.set(v.x + off[0], legHeight / 2, v.z + off[2]);
        leg.castShadow = true;
        group.add(leg);
      });
    }
  }, [arrayConfig, activeColorMode]);

  // Update Obstacles in 3D Scene
  useEffect(() => {
    if (!obstaclesGroupRef.current) return;
    const group = obstaclesGroupRef.current;

    treesRef.current.forEach((tree) => tree.dispose());
    treesRef.current = [];

    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      child.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
    }

    obstacles.forEach((obs) => {
      if (!obs.enabled) return;

      const azRad = obs.azimuth * DEG2RAD;
      const centerDist = obstacleCenterDistance(obs);
      const posX = Math.sin(azRad) * centerDist;
      const posZ = Math.cos(azRad) * centerDist;

      const baseElev = obs.baseElevation || 0;
      const obsGroup = new THREE.Group();
      obsGroup.position.set(posX, baseElev, posZ);
      // Width runs across the line of sight (tangential), depth along it — same as shadingMath
      obsGroup.rotation.y = azRad;

      // If baseElevation > 0, render a concrete foundation pedestal down to ground (y = -baseElev)
      if (baseElev > 0.05) {
        const foundationSize = Math.max(obs.width, obs.depth || 2);
        const foundationGeom = new THREE.BoxGeometry(
          Math.min(foundationSize, 6),
          baseElev,
          Math.min(obs.depth || 3, 6)
        );
        const foundationMat = new THREE.MeshStandardMaterial({
          color: 0x94a3b8,
          roughness: 0.85,
        });
        const foundationMesh = new THREE.Mesh(foundationGeom, foundationMat);
        foundationMesh.position.y = -baseElev / 2;
        foundationMesh.castShadow = true;
        foundationMesh.receiveShadow = true;
        obsGroup.add(foundationMesh);
      }

      if (obs.type === 'tree') {
        // Pohon realistis beranimasi angin; daun/cabang dijaga di dalam amplop elipsoid tajuk
        // yang sama dengan perhitungan bayangan (getTreeGeometry).
        const tree = createRealisticTree(getTreeGeometry(obs), obs.id);
        tree.group.rotation.y = -azRad; // orientasi pohon tidak ikut berputar mengikuti azimuth
        obsGroup.add(tree.group);
        treesRef.current.push(tree);
      } else if (obs.type === 'building') {
        // Gedung realistis — amplop kotak W × H × D sama dengan perhitungan bayangan
        obsGroup.add(createRealisticBuilding(obs.width, obs.height, obs.depth || 5));
      } else if (obs.type === 'wall') {
        // Parapet / Perimeter Wall
        const wGeom = new THREE.BoxGeometry(obs.width, obs.height, 0.3);
        const wMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 });
        const wMesh = new THREE.Mesh(wGeom, wMat);
        wMesh.position.y = obs.height / 2;
        wMesh.castShadow = true;
        wMesh.receiveShadow = true;
        obsGroup.add(wMesh);
      } else if (obs.type === 'pole') {
        // Utility pole
        const pGeom = new THREE.CylinderGeometry(0.12, 0.15, obs.height, 8);
        const pMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6 });
        const pMesh = new THREE.Mesh(pGeom, pMat);
        pMesh.position.y = obs.height / 2;
        pMesh.castShadow = true;
        obsGroup.add(pMesh);

        // Arm
        const armGeom = new THREE.BoxGeometry(1.2, 0.1, 0.1);
        const armMesh = new THREE.Mesh(armGeom, pMat);
        armMesh.position.set(0, obs.height - 0.2, 0);
        armMesh.castShadow = true;
        obsGroup.add(armMesh);
      } else if (obs.type === 'front_row') {
        // Front PV Row (for inter-row self shading visualization)
        const rowGeom = new THREE.BoxGeometry(obs.width, obs.height, 1.2);
        const rowMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.3 });
        const rowMesh = new THREE.Mesh(rowGeom, rowMat);
        rowMesh.position.y = obs.height / 2;
        rowMesh.rotation.x = -arrayConfig.tilt * DEG2RAD;
        rowMesh.castShadow = true;
        rowMesh.receiveShadow = true;
        obsGroup.add(rowMesh);
      }

      // Add label or pointer on ground
      const markerGeom = new THREE.RingGeometry(0.3, 0.45, 16);
      const markerMat = new THREE.MeshBasicMaterial({ color: 0xd97706, side: THREE.DoubleSide });
      const marker = new THREE.Mesh(markerGeom, markerMat);
      marker.rotation.x = -Math.PI / 2;
      marker.position.y = 0.02;
      obsGroup.add(marker);

      group.add(obsGroup);
    });
  }, [obstacles, arrayConfig.tilt]);

  // Handle Camera Presets
  const setCameraView = (view: ViewPreset) => {
    setViewPreset(view);
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    if (view === 'perspective') {
      camera.position.set(10, 8, 12);
      controls.target.set(0, 1.2, 0);
    } else if (view === 'top') {
      camera.position.set(0, 18, 0.01);
      controls.target.set(0, 0, 0);
    } else if (view === 'side') {
      camera.position.set(14, 2, 0);
      controls.target.set(0, 1.2, 0);
    } else if (view === 'sun') {
      // Look from the sun's perspective down towards the array
      if (solarPos.isDaylight) {
        const altRad = solarPos.altitude * DEG2RAD;
        const azRad = solarPos.azimuth * DEG2RAD;
        const d = 20;
        camera.position.set(
          Math.sin(azRad) * Math.cos(altRad) * d,
          Math.sin(altRad) * d,
          Math.cos(azRad) * Math.cos(altRad) * d
        );
        controls.target.set(0, 1.2, 0);
      }
    }
    controls.update();
  };

  return (
    <div
      ref={wrapperRef}
      className={`relative w-full h-full bg-white overflow-hidden ${
        isFullscreen ? 'min-h-screen rounded-none border-0' : 'min-h-[460px] rounded-xl border border-slate-200 shadow-sm'
      }`}
    >
      {/* 3D Canvas Mount */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Viewport Floating Overlay Controls - Bright Theme */}
      {/* Top overlay row: wraps onto two lines on narrow screens instead of overlapping */}
      <div className="absolute top-3 left-3 right-3 flex flex-wrap items-start justify-between gap-2 z-20 pointer-events-none">
      <div ref={viewMenuRef} className="pointer-events-auto relative">
        <button
          onClick={() => setIsViewMenuOpen(!isViewMenuOpen)}
          aria-expanded={isViewMenuOpen}
          aria-haspopup="listbox"
          className={`px-2.5 py-1 text-xs rounded-lg backdrop-blur-md border transition-all shadow-md flex items-center gap-1.5 ${
            isViewMenuOpen
              ? 'bg-amber-500 text-white border-amber-600 font-semibold'
              : 'bg-white/95 text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
          title="Pilih sudut pandang kamera"
        >
          <Eye className={`w-3.5 h-3.5 ${isViewMenuOpen ? 'text-white' : 'text-amber-500'}`} />
          <span className="font-semibold">{VIEW_OPTIONS.find((v) => v.id === viewPreset)?.label}</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${isViewMenuOpen ? 'rotate-180' : ''}`} />
        </button>
        {isViewMenuOpen && (
          <div
            role="listbox"
            className="absolute left-0 top-full mt-2 w-60 bg-white rounded-xl shadow-2xl border border-slate-200 p-1.5 z-30"
          >
            {VIEW_OPTIONS.map((v) => {
              const disabled = v.id === 'sun' && !solarPos.isDaylight;
              const active = viewPreset === v.id;
              return (
                <button
                  key={v.id}
                  role="option"
                  aria-selected={active}
                  disabled={disabled}
                  onClick={() => {
                    setCameraView(v.id);
                    setIsViewMenuOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 ${
                    disabled
                      ? 'text-slate-300 cursor-not-allowed'
                      : active
                      ? 'bg-amber-50 text-amber-900'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>
                    <span className="font-semibold block">{v.label}</span>
                    <span className={`text-[10px] ${disabled ? 'text-slate-300' : 'text-slate-500'}`}>
                      {disabled ? 'Tidak tersedia saat malam' : v.hint}
                    </span>
                  </span>
                  {active && <Check className="w-4 h-4 text-amber-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Sun Arc & Panel Color Selector - Bright Theme (Right-anchored, does NOT obscure perspective controls on left) */}
      <div className="pointer-events-auto flex flex-wrap items-center gap-2 ml-auto">
        {/* Tombol & Popover Timbul Warna Panel */}
        <div ref={colorMenuRef} className="relative">
          <button
            onClick={() => setIsColorMenuOpen(!isColorMenuOpen)}
            aria-expanded={isColorMenuOpen}
            className={`px-2.5 py-1 text-xs rounded-lg backdrop-blur-md border transition-all shadow-md flex items-center gap-1.5 cursor-pointer ${
              isColorMenuOpen
                ? 'bg-amber-500 text-white border-amber-600 font-semibold ring-2 ring-amber-400/40'
                : 'bg-white/95 text-slate-700 border-slate-200 hover:text-slate-900 hover:bg-slate-50'
            }`}
            title="Klik untuk memilih warna panel surya"
          >
            <Palette className={`w-3.5 h-3.5 ${isColorMenuOpen ? 'text-white' : 'text-amber-500'}`} />
            <span className="font-semibold hidden sm:inline">Warna Panel</span>
            <span
              className={`w-2.5 h-2.5 rounded-full border shadow-2xs ${
                PANEL_COLOR_OPTIONS.find((c) => c.id === activeColorMode)?.swatchClass || 'bg-slate-200'
              } ${
                PANEL_COLOR_OPTIONS.find((c) => c.id === activeColorMode)?.borderClass || 'border-slate-400'
              }`}
              aria-hidden="true"
            />
            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isColorMenuOpen ? 'rotate-180 text-white' : 'text-slate-400'}`} />
          </button>

          {/* Menu Dropdown Timbul (Elevated Popover) - Terletak di Kanan, Tidak Menutup Menu Perspektif di Kiri */}
          {isColorMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white/98 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200 p-2.5 z-30 animate-in fade-in zoom-in-95 duration-150 origin-top-right">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-amber-500" />
                  Warna Visibilitas Bayangan
                </span>
                <button
                  onClick={() => setIsColorMenuOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                  title="Tutup Menu"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-[11px] text-slate-500 mb-2 leading-relaxed px-1">
                Pilih warna modul agar siluet bayangan rintangan (pohon/gedung) tampak sangat kontras di permukaan panel:
              </p>

              <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-0.5">
                {PANEL_COLOR_OPTIONS.map((opt) => {
                  const isSelected = activeColorMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleColorChange(opt.id)}
                      className={`w-full p-2 rounded-lg text-left text-xs transition-all border flex items-center justify-between gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-amber-50/90 border-amber-400 text-amber-950 shadow-xs ring-1 ring-amber-400/40'
                          : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-800'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span
                          className={`w-4 h-4 rounded-full border shadow-2xs mt-0.5 shrink-0 ${opt.swatchClass} ${opt.borderClass}`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-xs text-slate-900">{opt.shortLabel}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
                                isSelected ? 'bg-amber-200 text-amber-900' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {opt.badge}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-tight mt-0.5 truncate">
                            {opt.description}
                          </p>
                        </div>
                      </div>

                      {isSelected ? (
                        <Check className="w-4 h-4 text-amber-600 shrink-0" />
                      ) : (
                        <span className="w-4 h-4 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-100 px-1">
                <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded block leading-tight border border-amber-200/60">
                  💡 Pilih <b>Perak</b> bila ingin siluet bayangan paling kontras. </span>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => {
            const next = !windOn;
            setWindOn(next);
            windTargetRef.current = next ? 1 : 0;
          }}
          className={`px-2.5 py-1 text-xs rounded-lg backdrop-blur-md border transition-colors shadow-md flex items-center gap-1 ${
            windOn
              ? 'bg-emerald-600 text-white border-emerald-700 font-medium'
              : 'bg-white/95 text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50'
          }`}
          title="Animasi pohon bergoyang tertiup angin (visual saja, tidak mengubah perhitungan bayangan)"
        >
          <Wind className="w-3.5 h-3.5" />
          Angin {windOn ? 'ON' : 'OFF'}
        </button>

        <button
          onClick={() => setShowSunArc(!showSunArc)}
          className={`px-2.5 py-1 text-xs rounded-lg backdrop-blur-md border transition-colors shadow-md ${
            showSunArc
              ? 'bg-amber-500 text-white border-amber-600 font-medium'
              : 'bg-white/95 text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          Lintasan {showSunArc ? 'ON' : 'OFF'}
        </button>

        <button
          onClick={toggleFullscreen}
          className="hidden lg:flex px-2.5 py-1 text-xs rounded-lg backdrop-blur-md border transition-colors shadow-md items-center gap-1 bg-white/95 text-slate-700 border-slate-200 hover:text-slate-900 hover:bg-slate-50"
          title={isFullscreen ? 'Keluar layar penuh (Esc)' : 'Tampilkan simulasi 3D layar penuh'}
          aria-label={isFullscreen ? 'Keluar layar penuh' : 'Layar penuh'}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          <span className="font-semibold">{isFullscreen ? 'Keluar' : 'Layar Penuh'}</span>
        </button>
      </div>
      </div>

      {/* Overlay kurva produksi harian — hanya saat layar penuh */}
      {isFullscreen && fullscreenOverlay && (
        <div className="absolute right-3 bottom-[68px] z-20 w-[min(680px,52vw)]">
          <div className="flex justify-end mb-1.5">
            <button
              onClick={() => setShowOverlay(!showOverlay)}
              className="px-2.5 py-1 text-xs rounded-lg bg-white/95 border border-slate-200 shadow-md text-slate-700 hover:bg-slate-50 font-semibold"
            >
              {showOverlay ? 'Sembunyikan Grafik' : 'Tampilkan Kurva Produksi'}
            </button>
          </div>
          {showOverlay && (
            <div className="max-h-[calc(100vh-170px)] overflow-y-auto rounded-xl shadow-2xl [&>*]:bg-white/95 [&>*]:backdrop-blur-md space-y-2">
              {fullscreenOverlay}
            </div>
          )}
        </div>
      )}

      {/* Live Sun State & Shading HUD Bar at Bottom - Bright Theme */}
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-3 p-2.5 bg-white/95 backdrop-blur-md rounded-lg border border-slate-200 shadow-md text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Sun className={`w-4 h-4 ${solarPos.isDaylight ? 'text-amber-500 animate-pulse' : 'text-slate-400'}`} />
            <span className="font-semibold text-slate-800">
              {solarPos.isDaylight ? 'Matahari Aktif' : 'Malam / Di Bawah Horizon'}
            </span>
          </div>
          <span className="text-slate-300" aria-hidden="true">|</span>
          <div className="flex items-center gap-2 text-slate-600 font-mono tabular-nums">
            <span>Elevasi: <b className="text-amber-600 font-semibold">{solarPos.altitude.toFixed(1)}°</b></span>
            <span>·</span>
            <span>Azimuth: <b className="text-amber-600 font-semibold">{solarPos.azimuth.toFixed(0)}°</b></span>
          </div>
        </div>

        {/* Shading Status */}
        <div className="flex items-center gap-2" title="Persentase luas permukaan modul yang tertutup bayangan. Rugi daya bisa lebih besar karena efek mismatch pada rangkaian seri.">
          {totalShadedFraction > 0.01 ? (
            <div className="flex items-center gap-1.5 text-rose-700 font-semibold bg-rose-50 px-2.5 py-0.5 rounded border border-rose-200">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              <span>Luas Terbayang: {(totalShadedFraction * 100).toFixed(0)}%</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-emerald-700 font-medium bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
              <span className="text-emerald-500 font-bold">●</span>
              <span>100% Bebas Bayangan</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper: Creates 3D Compass indicator with N, E, S, W labels
function createCompassRing(): THREE.Group {
  const group = new THREE.Group();

  // Compass ring
  const ringGeom = new THREE.RingGeometry(8, 8.1, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x94a3b8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.7,
  });
  const ring = new THREE.Mesh(ringGeom, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.015;
  group.add(ring);

  // North arrow pointer (+Z)
  const arrowGeom = new THREE.ConeGeometry(0.3, 0.8, 4);
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const arrow = new THREE.Mesh(arrowGeom, arrowMat);
  arrow.rotation.x = Math.PI / 2;
  arrow.position.set(0, 0.02, 8.5);
  group.add(arrow);

  // Cardinal labels (U/T/S/B) — azimuth convention: x = sin(az), z = cos(az)
  const labels: { t: string; az: number; color: string }[] = [
    { t: 'U', az: 0, color: '#dc2626' },
    { t: 'T', az: 90, color: '#334155' },
    { t: 'S', az: 180, color: '#334155' },
    { t: 'B', az: 270, color: '#334155' },
  ];
  labels.forEach(({ t, az, color }) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.arc(64, 64, 56, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t, 64, 70);
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false }));
    const r = 9.6;
    const a = (az * Math.PI) / 180;
    sprite.position.set(Math.sin(a) * r, 0.6, Math.cos(a) * r);
    sprite.scale.set(0.045, 0.045, 1); // ukuran tetap di layar (tidak membesar saat kamera dekat)
    sprite.renderOrder = 10;
    group.add(sprite);
  });

  return group;
}
