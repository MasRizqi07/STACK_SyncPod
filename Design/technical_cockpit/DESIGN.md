---
name: Technical Cockpit
colors:
  surface: '#0f1418'
  surface-dim: '#0f1418'
  surface-bright: '#343a3e'
  surface-container-lowest: '#0a0f12'
  surface-container-low: '#171c20'
  surface-container: '#1b2024'
  surface-container-high: '#252b2e'
  surface-container-highest: '#303539'
  on-surface: '#dee3e8'
  on-surface-variant: '#bdc8d1'
  inverse-surface: '#dee3e8'
  inverse-on-surface: '#2c3135'
  outline: '#87929a'
  outline-variant: '#3e484f'
  surface-tint: '#7bd0ff'
  primary: '#8ed5ff'
  on-primary: '#00354a'
  primary-container: '#38bdf8'
  on-primary-container: '#004965'
  inverse-primary: '#00668a'
  secondary: '#bcc7de'
  on-secondary: '#263143'
  secondary-container: '#3e495d'
  on-secondary-container: '#aeb9d0'
  tertiary: '#ffc176'
  on-tertiary: '#472a00'
  tertiary-container: '#f1a02b'
  on-tertiary-container: '#613b00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c4e7ff'
  primary-fixed-dim: '#7bd0ff'
  on-primary-fixed: '#001e2c'
  on-primary-fixed-variant: '#004c69'
  secondary-fixed: '#d8e3fb'
  secondary-fixed-dim: '#bcc7de'
  on-secondary-fixed: '#111c2d'
  on-secondary-fixed-variant: '#3c475a'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb960'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#0f1418'
  on-background: '#dee3e8'
  surface-variant: '#303539'
  bg-canvas: '#090D16'
  bg-surface: '#0F172A'
  bg-surface-elevated: '#1E293B'
  border-subtle: rgba(255, 255, 255, 0.08)
  border-active: rgba(56, 189, 248, 0.30)
  color-primary-hover: '#0EA5E9'
  color-on-primary: '#04121F'
  color-amber: '#F59E0B'
  color-emerald: '#10B981'
  color-purple: '#A855F7'
  color-purple-text: '#C084FC'
  color-danger: '#F87171'
  text-primary: '#F8FAFC'
  text-secondary: '#94A3B8'
  text-muted: '#8393A8'
typography:
  display-lg:
    fontFamily: Bricolage Grotesque
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Bricolage Grotesque
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Bricolage Grotesque
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Bricolage Grotesque
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Bricolage Grotesque
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 23px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 19px
  mono-timer-lg:
    fontFamily: JetBrains Mono
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 40px
  mono-timer-md:
    fontFamily: JetBrains Mono
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 24px
  mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 18px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.25rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.25rem
  space-xl: 1.5rem
---

# DESIGN: SyncPod Technical Cockpit
**Part A: Design system dan token layar. Part B: Arsitektur dan aturan implementasi.**

| Atribut | Nilai Spesifikasi |
|---|---|
| Produk | SyncPod — Automated Micro-Study Pod & Sprint Cockpit (3–4 mahasiswa teknik fokus 25 menit) |
| Mode | Gelap mutlak (Dark theme only) |
| Bahasa UI | Bahasa Indonesia teknis, nada suara "kamu", huruf kecil/sentence case, tombol menyatakan aksi |
| Objek Memorable | Pod Ring (cincin SVG 4 kursi di 12, 3, 6, 9; radar saat mencari, timer saat sprint) |
| Data Prototipe | Menggunakan data simulasi; bot membawa label kecil "Simulasi" |

---

## 1. Token Warna (Palet Murni & Terkunci)

Dilarang keras memakai rona warna di luar daftar ini. Tidak ada gradien warna-warni, tidak ada glow neon ungu/pink, dan tidak ada glassmorphism.

```css
:root {
  /* Permukaan & Latar Belakang */
  --bg-canvas: #090D16;
  --bg-surface: #0F172A;
  --bg-surface-elevated: #1E293B;
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-active: rgba(56, 189, 248, 0.3);

  /* Aksen Utama (Fokus & Aksi Primer) */
  --color-primary: #38BDF8;          /* Biru langit: fokus, aksi utama (≈ 8,3:1) */
  --color-primary-hover: #0EA5E9;
  --color-on-primary: #04121F;       /* Teks di atas latar primary */

  /* Semantik Fungsional */
  --color-amber: #F59E0B;            /* Khusus fase istirahat dan peringatan */
  --color-emerald: #10B981;          /* Khusus tanda hadir, online, atau selesai */
  --color-purple: #A855F7;           /* HANYA untuk konten yang dihasilkan Gemini AI (solid fill) */
  --color-purple-text: #C084FC;      /* Teks kecil Gemini untuk kontras tinggi */
  --color-danger: #F87171;           /* Galat dan tindakan destruktif */

  /* Tipografi & Kontras (Seluruhnya ≥ 4.5:1 terhadap surface) */
  --text-primary: #F8FAFC;           /* Teks utama, judul, angka */
  --text-secondary: #94A3B8;         /* Teks sekunder, label, deskripsi */
  --text-muted: #8393A8;             /* Keterangan teknis, baris kode, penanda waktu */
}
```

---

## 2. Tipografi (Self-Hosted & Skala Presisi)

Semua font dimuat lokal tanpa CDN eksternal:

| Peran | Font | Bobot | Detail Gaya |
|---|---|---|---|
| Judul & Display | Bricolage Grotesque | 600, 700 | `letter-spacing: -0.02em`, `line-height: 1.1`, sentence case |
| Teks UI & Isi | Plus Jakarta Sans | 400, 500, 600 | 15px, `line-height: 1.55`, panjang baris optimal < 80 karakter |
| Angka, Timer, Editor | JetBrains Mono | 400, 500, 600 | `font-variant-numeric: tabular-nums`, tidak goyang saat berdetik |
| Font Cadangan | sans-serif | - | Tidak boleh menggunakan font serif di elemen apa pun |

---

## 3. Bentuk, Ruang, dan Ikonografi

- **Border Radius:**
  - Kontrol (tombol, input, chip, badge, dropdown): `8px` (`rounded-lg`).
  - Panel & Kartu Bento: `14px` (`rounded-[14px]`).
- **Spasial & Spacing:**
  - Gap antarkartu: `16px` (`gap-4`).
  - Padding kartu: `20px` (`p-5`).
- **Ikonografi:**
  - Pustaka: Lucide Icons dengan ketebalan garis konsisten `stroke-width="1.5"`.
  - Dilarang keras memakai emoji sebagai representasi ikon antarmuka.

---

## 4. Satu Objek Kunci: Pod Ring

- Cincin geometris SVG beralur tenang dengan 4 titik kursi pada koordinat cardinal (12:00, 03:00, 06:00, 09:00).
- **Peran Ganda:**
  1. *Layar Matchmaking (`/pod`):* Bertindak sebagai radar pencarian rekan. Kursi terisi bertahap saat rekan ditemukan.
  2. *Layar Cockpit (`/pod/[podId]`):* Bertindak sebagai timer terpusat. Busur menyapu waktu 25 menit, kursi menampilkan status rekan (*fokus*, *mencatat*, *tanya pemandu*, *terputus*).
- Seluruh elemen antarmuka lainnya tetap tenang dan berlatar belakang datar (*flat & quiet*).

---

## 5. Panduan Nada Suara & Teks (Indonesian Copy)

- Nada suara: "kamu", ramah teknis, kalimat wajar (sentence case), tanpa basa-basi pemasaran.
- Label tombol menyatakan langsung apa yang terjadi saat diklik (contoh: "Cari pod", "Jeda timer", "Tanya pemandu", "Mulai sprint", "Unduh ringkasan").
- Semua anggota simulasi/bot wajib memuat label kecil `Simulasi`.

---

## 6. Daftar Larangan Mutlak (Forbidden List)

1. Tidak ada gradien warna-warni (terutama ungu/pink neon gradient).
2. Tidak ada efek glow berlebihan, drop shadow tebal neon, atau glassmorphism blur dekoratif.
3. Tidak ada label kapital semua (ALL-CAPS).
4. Tidak ada eyebrow badges klise di atas setiap judul.
5. Tidak ada penomoran dekoratif "01 / 02 / 03" pada konten yang bukan merupakan langkah sekuensial.
6. Tidak ada kartu kembar identik dengan drop-shadow identik berulang.
7. Tidak boleh mengarang statistik palsu, universitas karangan, atau hitungan pengguna fiktif.
