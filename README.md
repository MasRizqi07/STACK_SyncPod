<div align="center">

# SyncPod

**Platform Sprint Belajar Kolaboratif Terarah & Pemandu Sokratik AI**  
*Micro-study pods beranggotakan 3–4 mahasiswa dengan sinkronisasi sprint serempak dan AI tanpa bocoran kode solusi.*

Dibangun oleh **Tim Cah Kacawww** (Institut Teknologi Adhi Tama Surabaya)  
untuk **GDGoC ITB STACK 2026 — Case 1: Smarter Campus and Learning**

![Node](https://img.shields.io/badge/Node.js-26.8.1-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-12.8.1-F69220?style=flat-square&logo=pnpm&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16.4.6-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0.3-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6.19.3-2D3748?style=flat-square&logo=prisma&logoColor=white)

**Tautan Prototipe Publik (Vercel):** `PENDING USER (deploy)`

[Tabel Klaim & Bukti](Docs/semifinal/CLAIMS_AND_EVIDENCE.md) · [Panduan Deploy Prototipe](Docs/semifinal/DEPLOY_PROTOTYPE.md) · [Naskah Demo 120 Detik](Docs/DEMO_SCRIPT.md) · [Arsitektur Teknis](Docs/ARCHITECTURE.md) · [ADR (Decisions)](Docs/DECISIONS.md) · [Dokumentasi Lengkap](Docs/README.md)

</div>

---

> [!IMPORTANT]
> **Status Kejujuran Prototipe Semifinal (D32):**
> Versi yang dinilai pada tahap semifinal ini adalah **prototipe antarmuka frontend penuh yang berjalan dalam mode simulasi deterministik (`NEXT_PUBLIC_REALTIME_MODE=fake`)** dengan penanda visual `"Prototipe: data simulasi"`. Seluruh interaksi rekan pod berlabel `"Simulasi"`.
> 
> Backend multipemain sesungguhnya (autentikasi Google SSO via Auth.js, basis data PostgreSQL + Prisma, gateway WebSocket Socket.IO, kolaborasi dokumen Yjs CRDT, dan pemandu live Gemini 2.5 Flash dengan guardrail anti-menyontek) dijadwalkan dan diselesaikan pada **Build Period (7–15 Des 2026)**.

---

## Cara Menjalankan Cepat (3 Perintah)

Tanpa perlu menginstal Docker atau basis data eksternal, jalankan prototipe secara lokal dalam 3 perintah:

```bash
# 1. Pasang seluruh dependensi monorepo
pnpm install --frozen-lockfile

# 2. Bangun paket bersama dan bundel prototipe web
pnpm build:prototype

# 3. Jalankan server lokal production
pnpm --filter @syncpod/web start -p 3000
```

Buka **`http://localhost:3000`** di browser Anda untuk menelusuri seluruh alur:
`Masuk (/masuk)` ➔ `Matchmaking (/pod)` ➔ `Sprint Cockpit (/pod/pod-042)` ➔ `Ringkasan Sesi (/pod/pod-042/selesai)`.

---

---

## Ringkasan Masalah & Solusi

Mahasiswa teknik dan komputasi semester awal sering terhenti pada satu modul spesifik (*traversal graf*, *ruang vektor*, *deadlock*). Belajar kelompok membantu, tetapi gagal di awal karena tiga biaya gesekan: mencari teman pada modul yang sama, menyamakan jadwal secara manual, dan tergoda AI umum yang langsung memberi jawaban instan.

| Gesekan Awal | Solusi SyncPod | Implementasi Kunci |
|---|---|---|
| **Mencari rekan sepemahaman modul** | Pencocokan otomatis berbasis taksonomi silabus 3 tingkat (`Course -> Topik -> Modul daun`) & jendela waktu hari ini (WIB) | Layar Matchmaking + `PodRing` Radar (3–4 anggota, opsi *fallback* bertiga 60 detik; disimulasikan pada prototipe semifinal) |
| **Koordinasi sprint yang berantakan** | Satu ruang kerja serempak: timer fokus/istirahat, status kehadiran, catatan Markdown bersama, dan antrean 1 pertanyaan/anggota | `Cockpit` responsif dengan koreksi offset jam server & sanitasi pratinjau |
| **Ketergantungan jawaban instan AI** | Pemandu Sokratik berbasis konteks modul & catatan bersama: tepat **3 pertanyaan pemandu**, **1 analogi konseptual**, tanpa blok kode solusi | Panel Sokratik terintegrasi (keluaran simulasi di prototipe semifinal; server-side Gemini Engine terhubung di Build Period) |

> [!NOTE]
> **Transparansi Status Prototipe (`NEXT_PUBLIC_REALTIME_MODE`):**
> - **Mode `fake` (Prototipe Semifinal):** Berjalan mandiri di `apps/web` memakai `FakeRealtimeClient` deterministik tanpa jaringan eksternal. Anggota simulasi ditandai eksplisit sebagai **`Simulasi`**.
> - **Mode `real` (Build Period):** Menghubungkan autentikasi Google/demo Auth.js, PostgreSQL + Prisma, server Socket.IO (`apps/realtime`), Yjs CRDT, dan API Gemini di sisi server.

---

## Pratinjau Antarmuka (Verified Proof)

Seluruh tangkapan layar di bawah diambil langsung dari browser headless pada viewport `1280px` menggunakan font self-hosted lokal (tanpa permintaan CDN eksternal).

| 1. Masuk (`/masuk`) | 2. Radar Matchmaking (`/pod`) |
|---|---|
| ![Layar Masuk SyncPod](proof/phase-2b/masuk-1280.png) | ![Radar Matchmaking Aktif](proof/phase-2b/matchmaking-active-1280.png) |
| **3. Sprint Cockpit (`/pod/[podId]`)** | **4. Ringkasan Pascasprint (`/pod/[podId]/selesai`)** |
| ![Sprint Cockpit SyncPod](proof/phase-2a/cockpit-focus-1280.png) | ![Ringkasan Sesi SyncPod](proof/phase-2b/summary-1280.png) |

<details>
<summary>Lihat variasi state sistem (Fallback Bertiga & Connection Banner)</summary>

| Tawaran Mulai Bertiga (`3/4`) | Banner Koneksi Terputus (`Cockpit`) |
|---|---|
| ![Tawaran Mulai Bertiga](proof/phase-2b/matchmaking-fallback-1280.png) | ![Banner Koneksi Terputus](proof/phase-2b/cockpit-disconnected-1280.png) |

</details>

---

## Arsitektur Monorepo

`apps/*` hanya bergantung pada `packages/*`, sedangkan `packages/shared` terisolasi murni tanpa dependensi Prisma atau browser agar kontrak event Socket.IO dan skema Zod tetap tunggal.

```mermaid
flowchart LR
  User["Browser Mahasiswa (Next.js App Router)"]
  subgraph Web["apps/web (Port 3000)"]
    UI["PodRing & Cockpit UI"]
    Fake["FakeRealtimeClient (mode fake)"]
    Auth["Auth.js & /api/realtime/token (Phase 3+)"]
  end
  subgraph Shared["packages/shared"]
    Zod["Zod Event Contracts, ErrorCode, Silabus & Summary MD"]
  end
  subgraph RT["apps/realtime (Node + Socket.IO, Port 4000)"]
    Matcher["Matcher, Timer & Presence"]
    Yjs["Yjs WebSocket Room"]
    Gemini["Socratic AI & Guardrail Filter"]
  end
  DB["packages/db (Prisma 6.19.3 + PostgreSQL)"]

  User --> UI
  UI -->|"mode=fake"| Fake
  UI -->|"mode=real"| Auth
  UI -->|"Socket.IO + JWT pendek"| RT
  Web --> Shared
  RT --> Shared
  Web --> DB
  RT --> DB
```

### Struktur Direktori

| Paket / Folder | Peran | Teknologi Utama |
|---|---|---|
| [`apps/web`](apps/web/package.json) | Frontend App Router, `PodRing`, Sprint Cockpit, CodeMirror Markdown & adapter realtime | Next.js `16.4.6`, React `19.3.1`, Tailwind CSS v4, CodeMirror 6, `@fontsource-variable/*` |
| [`apps/realtime`](apps/realtime/package.json) | Server Node terpisah untuk health check, matchmaking, timer, Yjs, & Gemini | Node.js `26.8.1`, Socket.IO `4.8.4`, Helmet `8.3.0` |
| [`packages/shared`](packages/shared/package.json) | Sumber kebenaran tipe event B5, skema Zod, fixture silabus, & ekspor ringkasan | TypeScript `6.0.3`, Zod `4.6.7`, Vitest `5.1.0` |
| [`packages/db`](packages/db/package.json) | Skema PostgreSQL (`User`, `Course`, `Module`, `MatchRequest`, `SprintPod`, `Question`, `Endorsement`) | Prisma `6.19.3` |
| [`Docs/`](Docs/README.md) | Spesifikasi PRD, Design System & Arsitektur, ADR (`DECISIONS.md`), rencana fase, & naskah demo | Markdown + Mermaid |
| [`proof/`](proof/) | Bukti verifikasi mentah per fase (`typecheck`, `lint`, `test`, `build`, offline build, screenshot CDP) | Log & PNG |
| [`scripts/`](scripts/) | Utilitas verifikasi lokal (mis. `block-network.cjs` untuk uji build offline) | Node.js |

---

## Prasyarat

- **Node.js:** `26.8.1` (sesuai `.nvmrc`, minimum `>= 20.9.0`)
- **pnpm:** `12.8.1` (terkunci pada `packageManager` di root `package.json`; aktifkan via `corepack enable`)
- **Docker:** Opsional untuk PostgreSQL lokal (dibutuhkan mulai Phase 3 / Build Period)

---

## Menjalankan Secara Lokal

### 1. Mode Prototipe (Tanpa Database & Tanpa Internet)

Cocok untuk demo semifinal atau meninjau seluruh alur antarmuka (`/masuk` -> `/pod` -> `/pod/[podId]` -> `/pod/[podId]/selesai`):

```bash
pnpm install --frozen-lockfile
```

Jalankan build/dev dalam mode `fake` (Linux / macOS bash):

```bash
NEXT_PUBLIC_REALTIME_MODE=fake NEXT_TELEMETRY_DISABLED=1 pnpm --filter @syncpod/web... dev
```

Atau di **Windows PowerShell**:

```powershell
$env:NEXT_PUBLIC_REALTIME_MODE = "fake"
$env:NEXT_TELEMETRY_DISABLED = "1"
pnpm --filter @syncpod/web... dev
```

Buka `http://localhost:3000` (otomatis mengarah ke `/masuk`). Tambahkan `?scenario=fallback` pada `/pod` untuk mencoba alur tawaran bertiga, atau `?demo=1` untuk kontrol demo cepat.

### 2. Monorepo Lengkap & Quality Gate

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm -r build
```

Untuk menjalankan server web + server realtime (skeleton health check port 4000) secara paralel:

```bash
pnpm dev
```

- **Web:** `http://localhost:3000` (mode simulasi aktif via `NEXT_PUBLIC_REALTIME_MODE=fake`)
- **Realtime health check:** `http://localhost:4000/health` (fondasi server Node.js)

---

## Mode Offline (Uji Venue Tanpa Internet)

Seluruh font (`Bricolage Grotesque`, `Plus Jakarta Sans`, `JetBrains Mono`) dibundel secara lokal melalui `@fontsource-variable/*` — **nol** request ke `fonts.googleapis.com` atau CDN eksternal.

Untuk memverifikasi build prototipe tanpa akses internet (Wi-Fi dimatikan setelah `pnpm install --frozen-lockfile`):

1. Matikan koneksi internet / Wi-Fi pada perangkat.
2. Jalankan build paket bersama dan web dalam mode `fake`:

```powershell
# Windows PowerShell
$env:NEXT_PUBLIC_REALTIME_MODE = "fake"
$env:NEXT_TELEMETRY_DISABLED = "1"
pnpm --filter @syncpod/web... build
pnpm --filter @syncpod/web start
```

```bash
# Linux / macOS
NEXT_PUBLIC_REALTIME_MODE=fake NEXT_TELEMETRY_DISABLED=1 pnpm --filter @syncpod/web... build
pnpm --filter @syncpod/web start
```

3. Buka `http://localhost:3000` dan telusuri alur `/masuk` -> `/pod` -> `/pod/pod-042` -> `/pod/pod-042/selesai`.

---

## Deploy prototipe (Vercel)

Untuk men-deploy prototipe frontend standalone ke Vercel (mode simulasi, tanpa server realtime/database):

| Pengaturan Vercel | Nilai |
|---|---|
| **Framework Preset** | Next.js |
| **Root Directory** | `apps/web` *(atau root monorepo jika memakai command di bawah)* |
| **Install Command** | `pnpm install --frozen-lockfile` |
| **Build Command** | `pnpm --filter @syncpod/web... build` |
| **Environment Variables** | `NEXT_PUBLIC_REALTIME_MODE=fake` dan `NEXT_TELEMETRY_DISABLED=1` |

> [!IMPORTANT]
> Pastikan **Root Directory** mengarah tepat sesuai strategi build monorepo: jika memakai command `pnpm --filter @syncpod/web... build`, jalankan dari **root repository** agar paket `@syncpod/shared` ikut ter-build otomatis sebagai dependensi workspace (`...`).

---

## Skrip Verifikasi & Audit Lokal (`scripts/`)

SyncPod menyertakan skrip verifikasi otomatis berbasis browser headless (Chrome DevTools Protocol dan Lighthouse CLI) yang menghasilkan bukti visual dan audit aksesibilitas WCAG 2.1 AA di folder `proof/phase-2c/`.

### Konfigurasi Lingkungan (`CHROME_PATH`) & Alokasi Port

| Konfigurasi / Port | Nilai Standar | Keterangan & Penggunaan |
|---|---|---|
| `CHROME_PATH` | `C:/Program Files/Google/Chrome/Application/chrome.exe` (Windows)<br>`/usr/bin/google-chrome` (Linux) | Path binary Google Chrome headless. Dapat di-override melalui environment variable `CHROME_PATH` di sistem operasi atau CI runner. |
| **Port `3114`** | `http://127.0.0.1:3114` | Port HTTP server internal yang dipakai oleh `scripts/phase2c-verify.mjs` untuk melayani bundel harness pengujian komponen mandiri. |
| **Port `9332`** | `http://127.0.0.1:9332` | Port remote debugging Chrome DevTools Protocol (CDP) untuk inspeksi DOM, pengukuran batas elemen, audit a11y, dan tangkapan layar. |
| **Port `3118`** | `http://127.0.0.1:3118` | Port Next.js production server yang dijalankan oleh `scripts/lighthouse-2c.mjs` untuk audit resmi Lighthouse CLI. |

### Menjalankan Skrip Bukti

```bash
# 1. Audit kontras token desain terhadap WCAG 2.1 AA (membaca langsung tokens.css)
node scripts/measure-contrast.mjs

# 2. Verifikasi responsif (375/768/1280), clearance numeral timer, tap targets >= 44px, dan tangkapan layar
node scripts/phase2c-verify.mjs

# 3. Audit aksesibilitas Lighthouse resmi per rute dan state fallback (menghasilkan skor 100/100)
node scripts/lighthouse-2c.mjs
```

---

## Tim Pengembang

**Tim Cah Kacawww** — Institut Teknologi Adhi Tama Surabaya (ITATS)  
Peserta **GDGoC ITB STACK 2026 — Case 1: Smarter Campus and Learning**

> *Lihat [`Docs/README.md`](Docs/README.md) untuk daftar lengkap spesifikasi produk, arsitektur teknis, keputusan desain (ADR), dan bukti verifikasi per fase.*
