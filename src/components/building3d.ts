import * as THREE from 'three';

/**
 * Gedung 3D bergaya bangunan Indonesia (dinding plester, list lantai, jendela kaca
 * berbingkai aluminium, pintu, atap dak beton dengan parapet, toren air & outdoor AC).
 *
 * Seluruh elemen berada di dalam amplop kotak  [-W/2, W/2] × [0, H] × [-D/2, D/2]
 * (tonjolan list/bingkai ≤ 5 cm) — amplop yang sama dipakai shadingMath.ts, sehingga
 * bayangan 3D tetap konsisten dengan angka rugi bayangan.
 *
 * Orientasi lokal: sumbu X = lebar (melintang garis pandang dari PLTS),
 * sumbu Z = panjang/kedalaman (menjauhi PLTS); muka -Z menghadap ke array PLTS.
 */

let plasterTexture: THREE.CanvasTexture | null = null;
function getPlasterTexture(): THREE.CanvasTexture {
  if (plasterTexture) return plasterTexture;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ece6d8';
  ctx.fillRect(0, 0, 256, 256);
  let seed = 4721;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 4200; i++) {
    const x = rnd() * 256;
    const y = rnd() * 256;
    const r = 0.4 + rnd() * 1.4;
    const dark = rnd() > 0.5;
    ctx.fillStyle = dark ? `rgba(120,108,88,${0.04 + rnd() * 0.05})` : `rgba(255,255,255,${0.05 + rnd() * 0.06})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Noda rembesan air hujan tipis (khas dinding di iklim tropis)
  for (let i = 0; i < 7; i++) {
    const x = rnd() * 256;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(110,100,85,0.07)');
    g.addColorStop(1, 'rgba(110,100,85,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 3 + rnd() * 8, 120 + rnd() * 136);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  plasterTexture = tex;
  return tex;
}

type Facade = { axis: 'x' | 'z'; sign: 1 | -1; length: number };

export function createRealisticBuilding(width: number, height: number, depth: number): THREE.Group {
  const group = new THREE.Group();
  const W = Math.max(0.5, width);
  const H = Math.max(0.5, height);
  const D = Math.max(0.5, depth);

  // --- Pembagian tinggi: badan bangunan + parapet atap dak ---
  const parapetH = H >= 4 ? 0.9 : H >= 2.5 ? 0.45 : 0;
  const bodyH = H - parapetH;
  const floors = Math.max(1, Math.round(bodyH / 3.3));
  const floorH = bodyH / floors;

  // --- Material ---
  const tex = getPlasterTexture().clone();
  tex.needsUpdate = true;
  tex.repeat.set(Math.max(1, W / 3), Math.max(1, bodyH / 3));
  const wallMat = new THREE.MeshStandardMaterial({ map: tex, color: 0xf3eee2, roughness: 0.92, metalness: 0 });
  const sideTex = tex.clone();
  sideTex.needsUpdate = true;
  sideTex.repeat.set(Math.max(1, D / 3), Math.max(1, bodyH / 3));
  const sideWallMat = new THREE.MeshStandardMaterial({ map: sideTex, color: 0xe9e2d2, roughness: 0.92 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xc9c4b8, roughness: 0.8 });
  const plinthMat = new THREE.MeshStandardMaterial({ color: 0x77736b, roughness: 0.95 });
  const pilasterMat = new THREE.MeshStandardMaterial({ color: 0xd9d1bf, roughness: 0.88 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x3b3f44, roughness: 0.45, metalness: 0.55 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x86a9bd,
    roughness: 0.08,
    metalness: 0.35,
    emissive: 0x0d1d29,
    emissiveIntensity: 0.25,
  });
  const sillMat = new THREE.MeshStandardMaterial({ color: 0xe2ddd2, roughness: 0.7 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.6 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x8f8c86, roughness: 0.95 });

  // --- Badan bangunan (material berbeda tiap sisi: +X,-X,+Y,-Y,+Z,-Z) ---
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, bodyH, D), [
    sideWallMat,
    sideWallMat,
    roofMat,
    plinthMat,
    wallMat,
    wallMat,
  ]);
  body.position.y = bodyH / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // --- Plint / kaki bangunan ---
  const plinthH = Math.min(0.45, bodyH * 0.15);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, plinthH, D + 0.04), plinthMat);
  plinth.position.y = plinthH / 2;
  plinth.receiveShadow = true;
  group.add(plinth);

  // --- List lantai (pelat beton) ---
  for (let f = 1; f <= floors; f++) {
    const y = f * floorH;
    const band = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, 0.2, D + 0.06), trimMat);
    band.position.y = Math.min(y, bodyH) - 0.1;
    band.castShadow = f === floors;
    band.receiveShadow = true;
    group.add(band);
  }

  // --- Pilaster sudut ---
  const pw = Math.min(0.32, W * 0.08, D * 0.08);
  const pilasterGeom = new THREE.BoxGeometry(pw, bodyH, pw);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const p = new THREE.Mesh(pilasterGeom, pilasterMat);
      p.position.set(sx * (W / 2 - pw / 2 + 0.03), bodyH / 2, sz * (D / 2 - pw / 2 + 0.03));
      p.receiveShadow = true;
      group.add(p);
    }
  }

  // --- Parapet & atap dak ---
  if (parapetH > 0) {
    const t = Math.min(0.15, W * 0.05, D * 0.05);
    const parapetGeomX = new THREE.BoxGeometry(W, parapetH, t);
    const parapetGeomZ = new THREE.BoxGeometry(t, parapetH, D);
    const walls: [THREE.BoxGeometry, number, number][] = [
      [parapetGeomX, 0, D / 2 - t / 2],
      [parapetGeomX, 0, -D / 2 + t / 2],
      [parapetGeomZ, W / 2 - t / 2, 0],
      [parapetGeomZ, -W / 2 + t / 2, 0],
    ];
    for (const [g, x, z] of walls) {
      const m = new THREE.Mesh(g, wallMat);
      m.position.set(x, bodyH + parapetH / 2, z);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    }
    // Coping (tutup parapet)
    const copingGeomX = new THREE.BoxGeometry(W + 0.04, 0.06, t + 0.06);
    const copingGeomZ = new THREE.BoxGeometry(t + 0.06, 0.06, D + 0.04);
    for (const [g, x, z] of [
      [copingGeomX, 0, D / 2 - t / 2],
      [copingGeomX, 0, -D / 2 + t / 2],
      [copingGeomZ, W / 2 - t / 2, 0],
      [copingGeomZ, -W / 2 + t / 2, 0],
    ] as [THREE.BoxGeometry, number, number][]) {
      const m = new THREE.Mesh(g, trimMat);
      m.position.set(x, H - 0.03, z);
      group.add(m);
    }

    // Toren air & outdoor AC di atas dak — tetap di bawah puncak parapet (dalam amplop)
    const free = parapetH - 0.08;
    if (W > 2.5 && D > 2.5 && free > 0.35) {
      const tankH = Math.min(0.8, free);
      const tankR = Math.min(0.45, W * 0.1, D * 0.1);
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(tankR, tankR, tankH, 20),
        new THREE.MeshStandardMaterial({ color: 0x2f6fa8, roughness: 0.55 })
      );
      tank.position.set(W / 2 - tankR - 0.45, bodyH + tankH / 2, D / 2 - tankR - 0.45);
      tank.castShadow = true;
      group.add(tank);

      const acMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.6 });
      const acCount = Math.min(3, Math.max(1, Math.floor(W / 4)));
      for (let i = 0; i < acCount; i++) {
        const ac = new THREE.Mesh(new THREE.BoxGeometry(0.75, Math.min(0.55, free), 0.3), acMat);
        ac.position.set(-W / 2 + 0.8 + i * 1.1, bodyH + Math.min(0.55, free) / 2, D / 2 - 0.6);
        ac.castShadow = true;
        group.add(ac);
      }
    }
  }

  // --- Jendela & pintu (InstancedMesh agar ringan) ---
  const facades: Facade[] = [
    { axis: 'z', sign: -1, length: W }, // muka depan (menghadap PLTS)
    { axis: 'z', sign: 1, length: W },
    { axis: 'x', sign: 1, length: D },
    { axis: 'x', sign: -1, length: D },
  ];

  type Win = { facade: Facade; u: number; y: number; w: number; h: number };
  const windows: Win[] = [];
  let door: { u: number; w: number; h: number } | null = null;

  for (const fc of facades) {
    const usable = fc.length - 2 * pw - 0.4;
    if (usable < 0.9) continue;
    const cols = Math.max(1, Math.floor(usable / 2.1));
    const spacing = usable / cols;
    const winW = Math.min(1.4, spacing * 0.58);
    for (let f = 0; f < floors; f++) {
      const base = f * floorH;
      const winH = Math.min(1.5, floorH * 0.46);
      const sillY = base + Math.max(plinthH + 0.35, Math.min(0.95, floorH * 0.3));
      if (sillY + winH > base + floorH - 0.3) continue;
      for (let c = 0; c < cols; c++) {
        const u = -usable / 2 + spacing * (c + 0.5);
        // Pintu di lantai dasar muka depan, kolom tengah
        if (f === 0 && fc === facades[0] && c === Math.floor(cols / 2) && floorH > 2.4) {
          door = { u, w: Math.min(1.1, spacing * 0.6), h: Math.min(2.2, floorH - 0.5) };
          continue;
        }
        windows.push({ facade: fc, u, y: sillY + winH / 2, w: winW, h: winH });
      }
    }
  }

  const place = (fc: Facade, u: number, y: number, out: number, m: THREE.Matrix4, sx: number, sy: number, sz: number) => {
    const pos = new THREE.Vector3();
    const q = new THREE.Quaternion();
    if (fc.axis === 'z') {
      pos.set(u, y, fc.sign * (D / 2 + out));
    } else {
      pos.set(fc.sign * (W / 2 + out), y, u);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    }
    m.compose(pos, q, new THREE.Vector3(sx, sy, sz));
  };

  if (windows.length > 0) {
    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const frames = new THREE.InstancedMesh(unitBox, frameMat, windows.length);
    const glass = new THREE.InstancedMesh(unitBox, glassMat, windows.length);
    const sills = new THREE.InstancedMesh(unitBox, sillMat, windows.length);
    const mullions = new THREE.InstancedMesh(unitBox, frameMat, windows.length);
    const m = new THREE.Matrix4();
    windows.forEach((wnd, i) => {
      place(wnd.facade, wnd.u, wnd.y, 0.012, m, wnd.w + 0.1, wnd.h + 0.1, 0.03);
      frames.setMatrixAt(i, m);
      place(wnd.facade, wnd.u, wnd.y, 0.03, m, wnd.w, wnd.h, 0.01);
      glass.setMatrixAt(i, m);
      place(wnd.facade, wnd.u, wnd.y, 0.038, m, 0.045, wnd.h, 0.01);
      mullions.setMatrixAt(i, m);
      place(wnd.facade, wnd.u, wnd.y - wnd.h / 2 - 0.07, 0.025, m, wnd.w + 0.2, 0.06, 0.05);
      sills.setMatrixAt(i, m);
    });
    for (const im of [frames, glass, sills, mullions]) {
      im.instanceMatrix.needsUpdate = true;
      im.receiveShadow = true;
      group.add(im);
    }
  }

  if (door) {
    const d = door as { u: number; w: number; h: number };
    const fr = new THREE.Mesh(new THREE.BoxGeometry(d.w + 0.12, d.h + 0.08, 0.03), frameMat);
    fr.position.set(d.u, d.h / 2 + 0.02, -D / 2 - 0.012);
    group.add(fr);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(d.w, d.h, 0.02), doorMat);
    leaf.position.set(d.u, d.h / 2, -D / 2 - 0.03);
    leaf.receiveShadow = true;
    group.add(leaf);
    // Kanopi tipis di atas pintu (tonjolan kecil, tetap dekat dinding)
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(d.w + 0.5, 0.05, 0.05), trimMat);
    canopy.position.set(d.u, d.h + 0.18, -D / 2 - 0.025);
    group.add(canopy);
  }

  return group;
}
