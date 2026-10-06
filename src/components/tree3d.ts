import * as THREE from 'three';

/**
 * Pohon 3D realistis (gaya pohon mangga) dengan animasi tiupan angin.
 *
 * Seluruh daun, cabang dan buah dibangkitkan secara prosedural dan DIJAGA tetap berada di dalam
 * amplop elipsoid tajuk yang sama dengan perhitungan bayangan (getTreeGeometry di shadingMath),
 * sehingga visual 3D tetap konsisten dengan angka % bayangan.
 */

export interface TreeEnvelope {
  rh: number; // jari-jari horizontal tajuk (m)
  rv: number; // jari-jari vertikal tajuk (m)
  crownCenterY: number; // tinggi pusat tajuk dari dasar (m)
  trunkTopY: number;
}

export interface AnimatedTree {
  group: THREE.Group;
  /** t = detik berjalan, wind = 0 (tenang) … 1 (angin normal) */
  update: (t: number, wind: number) => void;
  dispose: () => void;
}

// ───────────────────────── Tekstur prosedural (di-cache, dipakai bersama) ─────────────────────────

let leafTextureCache: THREE.CanvasTexture | null = null;
let barkTextureCache: THREE.CanvasTexture | null = null;

function makeRng(seed: number) {
  let s = Math.abs(Math.floor(seed)) % 2147483646 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Satu "rumpun" daun mangga: 7–9 helai lanset memancar dari satu ranting (dasar tekstur = pangkal). */
function getLeafTexture(): THREE.CanvasTexture {
  if (leafTextureCache) return leafTextureCache;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  const rnd = makeRng(4242);
  const baseX = size / 2;
  const baseY = size - 6;

  const palette = ['#2d5a22', '#356a27', '#3f7a2e', '#2a4f1f', '#4b8a34', '#5b9a3c'];
  const count = 9;
  for (let i = 0; i < count; i++) {
    const spread = (i / (count - 1) - 0.5) * 2.5; // radian, kipas ±72°
    const ang = -Math.PI / 2 + spread + (rnd() - 0.5) * 0.25;
    const len = 150 + rnd() * 75;
    const w = 17 + rnd() * 8;
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.rotate(ang + Math.PI / 2);
    // Tangkai daun
    ctx.strokeStyle = '#4a5a24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -14);
    ctx.stroke();
    // Helai lanset (meruncing di ujung)
    const grad = ctx.createLinearGradient(-w, -len, w, 0);
    const c1 = palette[Math.floor(rnd() * palette.length)];
    const c2 = palette[Math.floor(rnd() * palette.length)];
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.bezierCurveTo(w, -len * 0.3, w * 0.8, -len * 0.75, 0, -len);
    ctx.bezierCurveTo(-w * 0.8, -len * 0.75, -w, -len * 0.3, 0, -12);
    ctx.fill();
    // Kilap tepi atas
    ctx.fillStyle = 'rgba(190,225,140,0.16)';
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.bezierCurveTo(w * 0.9, -len * 0.3, w * 0.7, -len * 0.75, 0, -len);
    ctx.lineTo(0, -12);
    ctx.fill();
    // Tulang daun
    ctx.strokeStyle = 'rgba(214,230,160,0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(0, -len + 6);
    ctx.stroke();
    // Tulang daun sekunder
    ctx.strokeStyle = 'rgba(200,220,150,0.22)';
    ctx.lineWidth = 0.8;
    for (let k = 1; k < 7; k++) {
      const y = -12 - (len - 20) * (k / 7);
      const ww = w * 0.75 * Math.sin((k / 7) * Math.PI);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(ww, y - 10);
      ctx.moveTo(0, y);
      ctx.lineTo(-ww, y - 10);
      ctx.stroke();
    }
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  leafTextureCache = tex;
  return tex;
}

function getBarkTexture(): THREE.CanvasTexture {
  if (barkTextureCache) return barkTextureCache;
  const w = 128;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#6a5040';
  ctx.fillRect(0, 0, w, h);
  const rnd = makeRng(977);
  for (let i = 0; i < 70; i++) {
    const x = rnd() * w;
    ctx.strokeStyle = rnd() > 0.5 ? 'rgba(40,28,20,0.55)' : 'rgba(150,125,100,0.25)';
    ctx.lineWidth = 0.8 + rnd() * 2.2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    let cx = x;
    for (let y = 0; y <= h; y += 16) {
      cx += (rnd() - 0.5) * 5;
      ctx.lineTo(cx, y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(30,20,14,0.25)' : 'rgba(170,150,120,0.15)';
    ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 3);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  barkTextureCache = tex;
  return tex;
}

// ───────────────────────── Pembangun pohon ─────────────────────────

const UP = new THREE.Vector3(0, 1, 0);

function branchMesh(a: THREE.Vector3, b: THREE.Vector3, rA: number, rB: number, mat: THREE.Material): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = Math.max(0.01, dir.length());
  const geom = new THREE.CylinderGeometry(rB, rA, len, 8, 1);
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

interface Pivot {
  group: THREE.Group; // pivot animasi (dipasang di titik pangkal cabang)
  origin: THREE.Vector3; // posisi pangkal dalam koordinat pohon
  tip: THREE.Vector3; // ujung cabang dalam koordinat pohon
  phase: number;
  freq: number;
  amp: number;
  leafMatrices: THREE.Matrix4[];
  leafColors: THREE.Color[];
}

export function createRealisticTree(env: TreeEnvelope, seedKey: string): AnimatedTree {
  const seed = seedKey.split('').reduce((s, c) => s * 31 + c.charCodeAt(0), 7) % 100000;
  const rnd = makeRng(seed + 11);
  const { rh, rv } = env;
  const center = new THREE.Vector3(0, env.crownCenterY, 0);

  const root = new THREE.Group();
  root.name = 'realistic-tree';

  // Materials (per pohon, dibuang saat dispose)
  const barkMat = new THREE.MeshStandardMaterial({ map: getBarkTexture(), color: 0x8a6a55, roughness: 0.97 });
  const leafTex = getLeafTexture();
  const leafMat = new THREE.MeshStandardMaterial({
    map: leafTex,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
    roughness: 0.72,
    metalness: 0,
  });
  leafMat.shadowSide = THREE.DoubleSide;
  const leafDepthMat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: leafTex,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
  });
  const fruitMat = new THREE.MeshStandardMaterial({ color: 0x9cb83e, roughness: 0.55 });
  const fruitMat2 = new THREE.MeshStandardMaterial({ color: 0xc7b445, roughness: 0.55 });

  /** Mengembalikan "jari-jari ternormalisasi" titik terhadap elipsoid tajuk (1 = tepat di permukaan). */
  const ellR = (p: THREE.Vector3) =>
    Math.sqrt(((p.x - center.x) / rh) ** 2 + ((p.y - center.y) / rv) ** 2 + ((p.z - center.z) / rh) ** 2);
  const clampInside = (p: THREE.Vector3, maxR: number) => {
    const r = ellR(p);
    if (r > maxR) p.sub(center).multiplyScalar(maxR / r).add(center);
    return p;
  };

  // ── Batang utama (sedikit condong & melengkung) + akar menonjol ──
  const crownBottom = env.crownCenterY - rv;
  const forkY = Math.max(0.7, Math.min(env.crownCenterY - rv * 0.25, crownBottom + rv * 0.45));
  const lean = new THREE.Vector3((rnd() - 0.5) * 0.35, 0, (rnd() - 0.5) * 0.35);
  const trunkR0 = Math.min(0.34, 0.2 + rh * 0.04);
  const p0 = new THREE.Vector3(0, 0, 0);
  const p1 = new THREE.Vector3(lean.x * 0.4, forkY * 0.5, lean.z * 0.4);
  const fork = new THREE.Vector3(lean.x, forkY, lean.z);
  root.add(branchMesh(p0, p1, trunkR0, trunkR0 * 0.85, barkMat));
  root.add(branchMesh(p1, fork, trunkR0 * 0.85, trunkR0 * 0.7, barkMat));
  const flare = new THREE.Mesh(new THREE.CylinderGeometry(trunkR0, trunkR0 * 1.45, 0.35, 10), barkMat);
  flare.position.y = 0.175;
  flare.castShadow = true;
  flare.receiveShadow = true;
  root.add(flare);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rnd() * 0.6;
    const rootEnd = new THREE.Vector3(Math.cos(a) * trunkR0 * 2.6, 0.0, Math.sin(a) * trunkR0 * 2.6);
    root.add(branchMesh(new THREE.Vector3(0, 0.22, 0), rootEnd, trunkR0 * 0.38, 0.03, barkMat));
  }

  // ── Dahan utama (limbs) → ranting (sub-branches) dengan hierarki pivot untuk animasi ──
  const limbPivots: Pivot[] = [];
  const twigPivots: Pivot[] = [];
  const nLimbs = 4 + Math.floor(rnd() * 2);
  const limbR0 = trunkR0 * 0.62;

  const makePivot = (parent: THREE.Object3D, parentOrigin: THREE.Vector3, origin: THREE.Vector3, tip: THREE.Vector3, amp: number, freq: number): Pivot => {
    const g = new THREE.Group();
    g.position.copy(origin).sub(parentOrigin);
    parent.add(g);
    return { group: g, origin: origin.clone(), tip: tip.clone(), phase: rnd() * Math.PI * 2, freq, amp, leafMatrices: [], leafColors: [] };
  };

  const rootOrigin = new THREE.Vector3(0, 0, 0);
  for (let i = 0; i <= nLimbs; i++) {
    const isLeader = i === nLimbs;
    const a = (i / nLimbs) * Math.PI * 2 + (rnd() - 0.5) * 0.7;
    const limbEnd = isLeader
      ? new THREE.Vector3(center.x + (rnd() - 0.5) * rh * 0.2, center.y + rv * 0.45, center.z + (rnd() - 0.5) * rh * 0.2)
      : new THREE.Vector3(
          center.x + Math.cos(a) * rh * (0.42 + rnd() * 0.18),
          center.y + rv * (-0.15 + rnd() * 0.35),
          center.z + Math.sin(a) * rh * (0.42 + rnd() * 0.18)
        );
    clampInside(limbEnd, 0.72);
    const limb = makePivot(root, rootOrigin, fork, limbEnd, 0.018, 0.55 + rnd() * 0.25);
    // Dahan dibuat sedikit melengkung (2 segmen)
    const mid = new THREE.Vector3().lerpVectors(fork, limbEnd, 0.5);
    mid.y += rv * 0.08;
    const lr = isLeader ? limbR0 * 0.85 : limbR0;
    limb.group.add(branchMesh(fork.clone().sub(fork), mid.clone().sub(fork), lr, lr * 0.72, barkMat));
    limb.group.add(branchMesh(mid.clone().sub(fork), limbEnd.clone().sub(fork), lr * 0.72, lr * 0.45, barkMat));
    limbPivots.push(limb);

    // Ranting dari ujung dahan menuju permukaan tajuk
    const nTwigs = 3 + Math.floor(rnd() * 2);
    const limbDir = new THREE.Vector3().subVectors(limbEnd, fork).normalize();
    for (let k = 0; k < nTwigs; k++) {
      const dir = limbDir
        .clone()
        .add(new THREE.Vector3((rnd() - 0.5) * 1.6, (rnd() - 0.2) * 1.1, (rnd() - 0.5) * 1.6))
        .normalize();
      const twigEnd = limbEnd.clone().add(new THREE.Vector3(dir.x * rh, dir.y * rv, dir.z * rh).multiplyScalar(0.55));
      clampInside(twigEnd, 0.82);
      const twig = makePivot(limb.group, fork, limbEnd, twigEnd, 0.045, 1.3 + rnd() * 0.9);
      twig.group.add(branchMesh(new THREE.Vector3(), twigEnd.clone().sub(limbEnd), lr * 0.42, 0.025, barkMat));
      twigPivots.push(twig);
    }
  }

  // ── Rumpun daun: titik-titik pada cangkang elipsoid, ditempel ke ranting terdekat ──
  const volumeScale = (rh * rh * rv) / (2.25 * 2.25 * 2.25);
  const nClusters = Math.round(THREE.MathUtils.clamp(100 * Math.pow(volumeScale, 0.66), 36, 260));
  const leafScale = THREE.MathUtils.clamp(Math.min(rh, rv) * 0.48, 0.48, 1.4);
  const tmpQ = new THREE.Quaternion();
  const tmpQ2 = new THREE.Quaternion();
  const tmpS = new THREE.Vector3();
  const tmpM = new THREE.Matrix4();
  const fruitPoints: { pivot: Pivot; pos: THREE.Vector3 }[] = [];

  for (let c = 0; c < nClusters; c++) {
    // Titik acak pada elipsoid (bias ke cangkang luar agar tajuk tampak padat dari luar)
    const u = rnd() * 2 - 1;
    const th = rnd() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const shell = 0.35 + Math.pow(rnd(), 0.45) * 0.55;
    const cc = new THREE.Vector3(center.x + s * Math.cos(th) * rh * shell, center.y + u * rv * shell, center.z + s * Math.sin(th) * rh * shell);
    // Ranting terdekat
    let best = twigPivots[0];
    let bestD = Infinity;
    for (const tp of twigPivots) {
      const d = tp.tip.distanceToSquared(cc);
      if (d < bestD) {
        bestD = d;
        best = tp;
      }
    }
    // Ranting kecil dari ujung ranting ke pusat rumpun
    if (Math.sqrt(bestD) > 0.25) {
      best.group.add(branchMesh(best.tip.clone().sub(best.origin), cc.clone().sub(best.origin), 0.022, 0.012, barkMat));
    }
    // Arah luar rumpun = normal elipsoid
    const outward = new THREE.Vector3((cc.x - center.x) / (rh * rh), (cc.y - center.y) / (rv * rv), (cc.z - center.z) / (rh * rh)).normalize();

    const leavesHere = 11 + Math.floor(rnd() * 7);
    for (let l = 0; l < leavesHere; l++) {
      const base = cc.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.5).multiplyScalar(leafScale * 1.3));
      const dir = outward
        .clone()
        .multiplyScalar(0.9)
        .add(new THREE.Vector3(rnd() - 0.5, rnd() * 0.9 - 0.2, rnd() - 0.5))
        .normalize();
      let sz = leafScale * (0.7 + rnd() * 0.45);
      // Pastikan ujung daun tidak keluar dari amplop tajuk perhitungan bayangan
      clampInside(base, 0.96);
      for (let guard = 0; guard < 4; guard++) {
        if (ellR(base.clone().addScaledVector(dir, sz)) <= 1.0) break;
        sz *= 0.72;
      }
      tmpQ.setFromUnitVectors(UP, dir);
      tmpQ2.setFromAxisAngle(UP, rnd() * Math.PI * 2);
      tmpQ.multiply(tmpQ2);
      tmpS.set(sz, sz, sz);
      tmpM.compose(base.clone().sub(best.origin), tmpQ, tmpS);
      best.leafMatrices.push(tmpM.clone());
      const shade = 0.78 + rnd() * 0.3;
      const hueShift = rnd();
      best.leafColors.push(new THREE.Color(shade * (hueShift > 0.85 ? 1.08 : 1), shade, shade * (hueShift > 0.85 ? 0.8 : 1)));
    }

    // Buah mangga menggantung di bagian bawah/samping tajuk
    if (outward.y < 0.25 && rnd() < 0.3) fruitPoints.push({ pivot: best, pos: cc.clone().addScaledVector(outward, -leafScale * 0.15) });
  }

  // Satu InstancedMesh daun per ranting (sedikit draw-call, tetap bisa bergoyang per ranting)
  const leafGeom = new THREE.PlaneGeometry(1, 1);
  leafGeom.translate(0, 0.5, 0); // pivot di pangkal rumpun
  for (const tp of twigPivots) {
    if (tp.leafMatrices.length === 0) continue;
    const inst = new THREE.InstancedMesh(leafGeom, leafMat, tp.leafMatrices.length);
    tp.leafMatrices.forEach((m, i) => {
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, tp.leafColors[i]);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.customDepthMaterial = leafDepthMat;
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.frustumCulled = false;
    tp.group.add(inst);
  }

  // Buah
  const fruitGeom = new THREE.SphereGeometry(1, 12, 10);
  const fruitSize = THREE.MathUtils.clamp(rh * 0.04, 0.06, 0.11);
  fruitPoints.slice(0, 14).forEach(({ pivot, pos }, i) => {
    const fruitTop = pos.clone();
    const fruitPos = pos.clone().add(new THREE.Vector3(0, -fruitSize * 2.2, 0));
    clampInside(fruitPos, 0.97);
    pivot.group.add(branchMesh(fruitTop.clone().sub(pivot.origin), fruitPos.clone().sub(pivot.origin), 0.008, 0.008, barkMat));
    const fruit = new THREE.Mesh(fruitGeom, i % 3 === 0 ? fruitMat2 : fruitMat);
    fruit.scale.set(fruitSize * 0.78, fruitSize * 1.15, fruitSize * 0.72);
    fruit.position.copy(fruitPos).sub(pivot.origin).add(new THREE.Vector3(0, -fruitSize * 0.9, 0));
    fruit.rotation.z = (rnd() - 0.5) * 0.5;
    fruit.castShadow = true;
    pivot.group.add(fruit);
  });

  // ── Animasi angin ──
  const allPivots = [...limbPivots, ...twigPivots];
  const update = (t: number, wind: number) => {
    // Hembusan (gust) yang naik-turun perlahan agar tidak terlihat mekanis
    const gust = 0.65 + 0.35 * Math.sin(t * 0.37) * Math.sin(t * 0.83 + 1.3);
    const w = wind * gust;
    for (const p of allPivots) {
      const ph = p.phase;
      p.group.rotation.x = w * p.amp * (Math.sin(t * p.freq + ph) + 0.35 * Math.sin(t * p.freq * 2.3 + ph * 1.7));
      p.group.rotation.z = w * p.amp * (0.6 * Math.cos(t * p.freq * 0.9 + ph) + 0.4) ;
      p.group.rotation.y = w * p.amp * 0.5 * Math.sin(t * p.freq * 1.4 + ph * 0.5);
    }
  };

  const dispose = () => {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    barkMat.dispose();
    leafMat.dispose();
    leafDepthMat.dispose();
    fruitMat.dispose();
    fruitMat2.dispose();
  };

  return { group: root, update, dispose };
}
