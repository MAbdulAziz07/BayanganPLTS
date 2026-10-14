import React, { useState, useId } from 'react';
import { HelpCircle, ChevronDown, SlidersHorizontal } from 'lucide-react';

/**
 * Kamus istilah teknis yang dipakai di alur pemula dan panel kontrol.
 * Ditulis dalam bahasa sehari-hari, dengan istilah teknis aslinya di bagian `term`.
 */
export const GLOSSARY = {
  tilt: {
    term: 'Kemiringan panel (tilt, β)',
    text:
      'Sudut antara permukaan panel dan bidang datar. 0° berarti panel rebah mendatar, 90° berarti tegak berdiri. ' +
      'Di Indonesia yang dekat khatulistiwa, kemiringan 10°–15° biasanya terbaik: matahari tetap tertangkap dengan baik ' +
      'dan air hujan bisa mengalir sambil membersihkan debu.',
  },
  azimuth: {
    term: 'Arah hadap panel (azimuth, γ)',
    text:
      'Ke mata angin mana permukaan panel menghadap, diukur searah jarum jam dari Utara: 0° = Utara, 90° = Timur, ' +
      '180° = Selatan, 270° = Barat. Lokasi di selatan khatulistiwa (sebagian besar Indonesia) sebaiknya menghadap Utara; ' +
      'lokasi di utara khatulistiwa sebaiknya menghadap Selatan.',
  },
  latitude: {
    term: 'Garis lintang (latitude)',
    text:
      'Jarak sebuah lokasi dari khatulistiwa dalam derajat. Nilai negatif = selatan khatulistiwa, positif = utara. ' +
      'Lintang menentukan seberapa tinggi matahari melintas dan ke arah mana panel sebaiknya dihadapkan.',
  },
  month: {
    term: 'Bulan pengamatan',
    text:
      'Posisi matahari bergeser sepanjang tahun. Sekitar Juni matahari lebih condong ke utara, sekitar Desember ' +
      'lebih condong ke selatan, sehingga panjang dan arah bayangan ikut berubah.',
  },
  kt: {
    term: 'Indeks kecerahan langit (KT)',
    text:
      'Perbandingan sinar matahari yang benar-benar sampai ke tanah dengan sinar di luar atmosfer. 0,30 = sering mendung, ' +
      '0,50 = kondisi khas daerah tropis lembap, 0,75 = sangat cerah. Sesuaikan agar radiasi harian sama dengan data ' +
      'lokasi Anda (misalnya Global Solar Atlas atau NASA POWER).',
  },
  skyMode: {
    term: 'Model cuaca',
    text:
      '"Rata-rata iklim" memperhitungkan awan seperti kondisi sehari-hari dan cocok untuk memperkirakan produksi. ' +
      '"Langit cerah" menganggap tidak ada awan sama sekali, sehingga hasilnya adalah batas atas teoretis.',
  },
  mountHeight: {
    term: 'Tinggi pemasangan panel',
    text:
      'Tinggi panel dari permukaan tanah. Panel yang dipasang lebih tinggi (misalnya di atap gedung) bisa berada di atas ' +
      'puncak pohon atau tembok di sekitarnya sehingga terhindar dari bayangannya.',
  },
  wp: {
    term: 'Watt-peak (Wp) dan kWp',
    text:
      'Daya maksimum satu panel pada kondisi uji standar (sinar 1000 W/m², suhu sel 25 °C). kWp adalah jumlah daya ' +
      'semua panel dibagi 1000, yaitu ukuran kapasitas PLTS.',
  },
  pitch: {
    term: 'Jarak antarbaris (pitch)',
    text:
      'Jarak dari tepi depan satu baris panel ke tepi depan baris berikutnya. Jika terlalu rapat, baris depan ' +
      'membayangi baris belakang saat matahari rendah (pagi dan sore). Ini disebut bayangan antarbaris (self-shading).',
  },
  inverter: {
    term: 'Jenis inverter',
    text:
      'Inverter mengubah listrik DC dari panel menjadi AC. Pada string inverter, panel dirangkai seri sehingga satu panel ' +
      'yang terbayang ikut menurunkan panel lain. Optimizer dan microinverter mengatur tiap panel sendiri-sendiri, ' +
      'sehingga kerugian akibat bayangan lebih kecil.',
  },
  obstacleAzimuth: {
    term: 'Arah letak rintangan',
    text:
      'Di sisi mana rintangan berada jika dilihat dari panel. Rintangan di Timur membuat bayangan pada pagi hari, ' +
      'rintangan di Barat pada sore hari. Di Indonesia, rintangan di sisi Utara atau Selatan berpengaruh sesuai musim.',
  },
  baseElevation: {
    term: 'Tinggi dasar rintangan',
    text:
      'Ketinggian titik dasar rintangan dari tanah, misalnya pohon yang tumbuh di atas tanggul atau tembok di atas atap. ' +
      'Puncak rintangan = tinggi dasar + tinggi rintangan.',
  },
  shadingLoss: {
    term: 'Rugi bayangan',
    text:
      'Persentase energi yang hilang karena bayangan dibandingkan jika panel tidak terhalang sama sekali. ' +
      'Kurang dari 3% tergolong kecil, 3–10% sedang, lebih dari 10% perlu ditangani.',
  },
  specificYield: {
    term: 'Hasil spesifik (kWh/kWp)',
    text:
      'Energi yang dihasilkan untuk setiap 1 kWp kapasitas terpasang. Angka ini memudahkan membandingkan PLTS dengan ' +
      'ukuran berbeda. Di Indonesia biasanya sekitar 3,5–4,5 kWh/kWp per hari.',
  },
  pr: {
    term: 'Performance Ratio (PR)',
    text:
      'Perbandingan energi yang benar-benar dihasilkan dengan energi teoretis dari sinar matahari yang diterima panel. ' +
      'Sudah termasuk rugi suhu, kotoran, kabel, inverter, dan bayangan. PLTS yang baik biasanya memiliki PR 75–85%.',
  },
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;

interface TermHelpProps {
  /** Kunci istilah di GLOSSARY. */
  k: GlossaryKey;
  /** Teks tombol; bawaan "Apa artinya?". */
  label?: string;
  className?: string;
}

/**
 * Tombol kecil "Apa artinya?" yang membuka penjelasan istilah teknis di bawahnya.
 * Penjelasan dirender di dalam blok yang sama agar tidak menutupi kontrol lain.
 */
export const TermHelp: React.FC<TermHelpProps> = ({ k, label = 'Apa artinya?', className = '' }) => {
  const [open, setOpen] = useState(false);
  const id = useId();
  const entry = GLOSSARY[k];
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 hover:text-sky-900 underline-offset-2 hover:underline"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        {open ? 'Tutup penjelasan' : label}
      </button>
      {open && (
        <div
          id={id}
          className="mt-1.5 p-2.5 rounded-lg bg-sky-50 border border-sky-200 text-[11px] leading-relaxed text-slate-700"
        >
          <span className="font-semibold text-sky-900 block mb-0.5">{entry.term}</span>
          {entry.text}
        </div>
      )}
    </div>
  );
};

interface AdvancedSectionProps {
  /** Ringkasan isi yang ditampilkan saat tertutup, mis. "Lintang kustom, model cuaca". */
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/** Wadah "Pengaturan lanjutan" yang bisa dibuka/tutup untuk parameter teknis. */
export const AdvancedSection: React.FC<AdvancedSectionProps> = ({ summary, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-slate-50 rounded-xl"
      >
        <span className="flex items-center gap-2 min-w-0">
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="min-w-0">
            <span className="block font-semibold text-slate-700 text-xs">Pengaturan lanjutan</span>
            {summary && !open && <span className="block text-[10px] text-slate-500 truncate">{summary}</span>}
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div id={id} className="px-3 pb-3 pt-1 space-y-4 border-t border-slate-200">
          {children}
        </div>
      )}
    </div>
  );
};

/** Label arah mata angin dari sudut azimuth (0 = Utara). */
export function compassName(az: number): string {
  const a = ((az % 360) + 360) % 360;
  const names = ['Utara', 'Timur Laut', 'Timur', 'Tenggara', 'Selatan', 'Barat Daya', 'Barat', 'Barat Laut'];
  return names[Math.round(a / 45) % 8];
}
