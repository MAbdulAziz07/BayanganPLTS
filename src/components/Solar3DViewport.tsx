import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PVArrayConfig, ObstacleConfig, SolarPosition, ModuleShadingState } from '../types/solar';
import { DEG2RAD, calculateSolarPosition } from '../utils/solarMath';
import { Compass, Eye, Sun, Maximize2, ShieldAlert } from 'lucide-react';

interface Solar3DViewportProps {
  arrayConfig: PVArrayConfig;
  obstacles: ObstacleConfig[];
  solarPos: SolarPosition;
  moduleStates: ModuleShadingState[];
  totalShadedFraction: number;
  latitude: number;
  dayOfYear: number;
  hour: number;
}

export const Solar3DViewport: React.FC<Solar3DViewportProps> = ({
  arrayConfig,
  obstacles,
  solarPos,
  moduleStates,
  totalShadedFraction,
  latitude,
  dayOfYear,
  hour,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
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

  const [viewPreset, setViewPreset] = useState<'perspective' | 'top' | 'side' | 'sun'>('perspective');
  const [showSunArc, setShowSunArc] = useState(true);

  // Initialize Three.js scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0xffffff);
    scene.fog = new THREE.Fog(0xffffff, 45, 95);

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
    renderer.toneMappingExposure = 1.05;
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

    // Ambient light - balanced for distinct, high-contrast shadows on white ground
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.5);
    scene.add(ambientLight);

    // Hemisphere light for sky/ground contrast
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe2e8f0, 0.4);
    scene.add(hemiLight);

    // Directional Sun Light
    const sunLight = new THREE.DirectionalLight(0xfffaed, 2.7);
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
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // Sun Visual Mesh
    const sunGeom = new THREE.SphereGeometry(0.7, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
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
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.95,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Ground Grid - clean slate lines on white ground
    const grid = new THREE.GridHelper(50, 50, 0x94a3b8, 0xe2e8f0);
    grid.position.y = 0.01;
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
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
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

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
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
      sunLightRef.current.intensity = 2.4 * Math.sin(altRad);
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
      for (let h = 5.5; h <= 18.5; h += 0.25) {
        const p = calculateSolarPosition(latitude, dayOfYear, h);
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
  }, [solarPos, latitude, dayOfYear, showSunArc]);

  // Update PV Array Geometry (Tilt, Azimuth, Rack, Modules, Shading Colors)
  useEffect(() => {
    if (!arrayGroupRef.current) return;
    const group = arrayGroupRef.current;

    // Clear old children
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
    }
    moduleMeshesRef.current = [];

    const { moduleCountX, moduleCountY, moduleWidth, moduleLength, tilt, azimuth, mountHeight } = arrayConfig;
    const totalW = moduleCountX * moduleWidth;
    const totalL = moduleCountY * moduleLength;

    // Sub-group for tilt rotation
    const tiltGroup = new THREE.Group();
    tiltGroup.position.set(0, mountHeight, 0);

    // Apply Array Azimuth rotation (around Y axis)
    // Three.js rotation: Y axis clockwise/counter-clockwise
    // In our convention: 0=N, 90=E, 180=S, 270=W
    tiltGroup.rotation.y = azimuth * DEG2RAD;

    // Tilt rotation around local X axis
    // When tilted, the upper edge rises
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

    // Build individual modules
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.7,
      roughness: 0.4,
    });

    const cellGeom = new THREE.PlaneGeometry(moduleWidth - 0.04, moduleLength - 0.04);
    const borderGeom = new THREE.BoxGeometry(moduleWidth, 0.035, moduleLength);

    for (let r = 0; r < moduleCountY; r++) {
      for (let c = 0; c < moduleCountX; c++) {
        const index = r * moduleCountX + c;
        const state = moduleStates[index];
        const isShaded = state && state.shadedRatio > 0.05;

        // Position on slope
        const posX = (c + 0.5) * moduleWidth - totalW / 2;
        const posZ = (r + 0.5) * moduleLength - totalL / 2;

        const modGroup = new THREE.Group();
        modGroup.position.set(posX, 0, posZ);

        // Aluminum module frame
        const frameMesh = new THREE.Mesh(borderGeom, frameMat);
        frameMesh.position.set(0, 0, 0);
        frameMesh.castShadow = true;
        frameMesh.receiveShadow = true;
        modGroup.add(frameMesh);

        // Photovoltaic cell face
        // Color changes to indicate shading / bypass status
        let cellColor = 0x0f2744; // normal rich solar navy blue
        let cellEmissive = 0x000000;

        if (isShaded) {
          if (state.relativePower <= 0.1) {
            cellColor = 0x1f1f2e; // deeply shaded
            cellEmissive = 0x3f1515; // faint warning tint
          } else if (state.relativePower <= 0.4) {
            cellColor = 0x1e293b;
            cellEmissive = 0x3d2005;
          } else {
            cellColor = 0x18283d;
          }
        }

        const cellMat = new THREE.MeshStandardMaterial({
          color: cellColor,
          emissive: cellEmissive,
          roughness: 0.25,
          metalness: 0.55,
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
      localVec.applyAxisAngle(new THREE.Vector3(0, 1, 0), azimuth * DEG2RAD);
      const topY = mountHeight + localVec.y;
      const legHeight = Math.max(0.1, topY);

      const legGeom = new THREE.CylinderGeometry(legRadius, legRadius, legHeight, 8);
      const legMesh = new THREE.Mesh(legGeom, legMat);
      legMesh.position.set(localVec.x, legHeight / 2, localVec.z);
      legMesh.castShadow = true;
      group.add(legMesh);
    });

    group.add(tiltGroup);
  }, [arrayConfig, moduleStates]);

  // Update Obstacles in 3D Scene
  useEffect(() => {
    if (!obstaclesGroupRef.current) return;
    const group = obstaclesGroupRef.current;

    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
    }

    obstacles.forEach((obs) => {
      if (!obs.enabled) return;

      const azRad = obs.azimuth * DEG2RAD;
      const posX = Math.sin(azRad) * obs.distance;
      const posZ = Math.cos(azRad) * obs.distance;

      const baseElev = obs.baseElevation || 0;
      const obsGroup = new THREE.Group();
      obsGroup.position.set(posX, baseElev, posZ);

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
        // Tree: Trunk + Organic Foliage Spheres
        const trunkH = obs.height * 0.45;
        const trunkGeom = new THREE.CylinderGeometry(0.2, 0.28, trunkH, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
        const trunkMesh = new THREE.Mesh(trunkGeom, trunkMat);
        trunkMesh.position.y = trunkH / 2;
        trunkMesh.castShadow = true;
        trunkMesh.receiveShadow = true;
        obsGroup.add(trunkMesh);

        // Lush green foliage
        const foliageMat = new THREE.MeshStandardMaterial({
          color: 0x166534,
          roughness: 0.8,
        });
        const crownR = obs.width / 2;

        const crownGeom1 = new THREE.SphereGeometry(crownR, 16, 16);
        const crown1 = new THREE.Mesh(crownGeom1, foliageMat);
        crown1.position.y = trunkH + crownR * 0.8;
        crown1.castShadow = true;
        crown1.receiveShadow = true;
        obsGroup.add(crown1);

        const crownGeom2 = new THREE.SphereGeometry(crownR * 0.8, 12, 12);
        const crown2 = new THREE.Mesh(crownGeom2, foliageMat);
        crown2.position.set(crownR * 0.25, trunkH + crownR * 1.3, -crownR * 0.2);
        crown2.castShadow = true;
        obsGroup.add(crown2);
      } else if (obs.type === 'building') {
        // Modern rectangular building block
        const bWidth = obs.width;
        const bHeight = obs.height;
        const bDepth = obs.depth || 5;

        const bGeom = new THREE.BoxGeometry(bWidth, bHeight, bDepth);
        const bMat = new THREE.MeshStandardMaterial({
          color: 0x475569,
          roughness: 0.7,
          metalness: 0.2,
        });
        const bMesh = new THREE.Mesh(bGeom, bMat);
        bMesh.position.y = bHeight / 2;
        bMesh.castShadow = true;
        bMesh.receiveShadow = true;
        obsGroup.add(bMesh);

        // Windows strip
        const winMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.9 });
        const winGeom = new THREE.PlaneGeometry(bWidth * 0.85, 0.4);
        const floors = Math.floor(bHeight / 2.5);
        for (let f = 1; f <= floors; f++) {
          const winMesh = new THREE.Mesh(winGeom, winMat);
          winMesh.position.set(0, f * 2.2, bDepth / 2 + 0.01);
          obsGroup.add(winMesh);
        }
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
  const setCameraView = (view: 'perspective' | 'top' | 'side' | 'sun') => {
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
    <div className="relative w-full h-full min-h-[460px] bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      {/* 3D Canvas Mount */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Viewport Floating Overlay Controls - Bright Theme */}
      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 p-1 bg-white/90 backdrop-blur-md rounded-lg border border-slate-200 shadow-md text-xs">
        <button
          onClick={() => setCameraView('perspective')}
          className={`px-2.5 py-1 rounded font-medium transition-colors ${
            viewPreset === 'perspective' ? 'bg-amber-500 text-white font-semibold shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Perspektif 3D
        </button>
        <button
          onClick={() => setCameraView('top')}
          className={`px-2.5 py-1 rounded font-medium transition-colors ${
            viewPreset === 'top' ? 'bg-amber-500 text-white font-semibold shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Atas (Top)
        </button>
        <button
          onClick={() => setCameraView('side')}
          className={`px-2.5 py-1 rounded font-medium transition-colors ${
            viewPreset === 'side' ? 'bg-amber-500 text-white font-semibold shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Samping (Tilt)
        </button>
        <button
          onClick={() => setCameraView('sun')}
          disabled={!solarPos.isDaylight}
          className={`px-2.5 py-1 rounded font-medium transition-colors ${
            viewPreset === 'sun'
              ? 'bg-amber-500 text-white font-semibold shadow-sm'
              : solarPos.isDaylight
              ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              : 'text-slate-300 cursor-not-allowed'
          }`}
          title="Lihat dari arah datangnya sinar matahari"
        >
          Matahari (LOS)
        </button>
      </div>

      {/* Sun Arc & Help Toggle - Bright Theme */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <button
          onClick={() => setShowSunArc(!showSunArc)}
          className={`px-2.5 py-1 text-xs rounded-lg backdrop-blur-md border transition-colors shadow-sm ${
            showSunArc
              ? 'bg-amber-500 text-white border-amber-600 font-medium'
              : 'bg-white/90 text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          Lintasan Matahari {showSunArc ? 'ON' : 'OFF'}
        </button>
      </div>

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
        <div className="flex items-center gap-2">
          {totalShadedFraction > 0.01 ? (
            <div className="flex items-center gap-1.5 text-rose-700 font-semibold bg-rose-50 px-2.5 py-0.5 rounded border border-rose-200">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              <span>Array Terbayang: {(totalShadedFraction * 100).toFixed(0)}%</span>
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

  return group;
}
