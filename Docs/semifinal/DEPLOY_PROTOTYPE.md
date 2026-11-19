# Panduan Deployment Prototipe SyncPod ke Vercel

**Dokumen:** `Docs/semifinal/DEPLOY_PROTOTYPE.md`  
**Target:** Tim, Reviewer, dan Juri Semifinal STACK 2026  
**Status Mode:** Prototipe Simulasi Frontend (`NEXT_PUBLIC_REALTIME_MODE=fake`)

---

## 1. Konteks dan Arsitektur Prototipe

Prototipe semifinal SyncPod dirancang untuk mendemonstrasikan seluruh alur UX/UI kokpit sprint belajar tanpa bergantung pada basis data PostgreSQL eksternal atau server Socket.IO selama masa penjurian semifinal.

- Seluruh interaksi multipemain, radar matchmaking, fallback 3-orang, pengatur waktu Pomodoro 25/5 menit, sokratik drawer, dan ekspor ringkasan disimulasikan secara deterministik via `FakeRealtimeClient`.
- Penanda tetap `"Prototipe: data simulasi"` ditampilkan di setiap halaman (sesuai keputusan D32).
- Backend riil (PostgreSQL, Auth.js Google SSO, Socket.IO gateway, Yjs CRDT, Gemini API) diselesaikan pada Build Period (Phase 3B–7).

---

## 2. Pengaturan Persis Vercel Project

Saat mengimpor repositori ke Vercel Dashboard, gunakan konfigurasi berikut:

| Parameter | Nilai Pengaturan | Penjelasan / Catatan |
|---|---|---|
| **Framework Preset** | `Next.js` | Terdeteksi otomatis oleh Vercel |
| **Root Directory** | `./` (repo root) | Repositori adalah monorepo pnpm |
| **Package Manager** | `pnpm` (versi >= 10, diatur via `packageManager` di `package.json`) | Vercel mendeteksi `pnpm-lock.yaml` |
| **Install Command** | `pnpm install --frozen-lockfile` | Override default install command |
| **Build Command** | `pnpm build:prototype` | Menjalankan build `@syncpod/shared`, `@syncpod/db`, lalu `@syncpod/web` |
| **Output Directory** | `apps/web/.next` | Lokasi build output Next.js |

### Environment Variables di Vercel

Tambahkan Environment Variable berikut pada Vercel Dashboard:

| Key | Value | Environment |
|---|---|---|
| `NEXT_PUBLIC_REALTIME_MODE` | `fake` | Production, Preview, Development |
| `NODE_ENV` | `production` | Production |

*(Catatan: Jangan mengisi `DATABASE_URL` atau OAuth secrets pada deployment prototipe publik semifinal ini).*

---

## 3. Langkah Pengujian Lokal Sebelum Deploy

Jalankan perintah build prototipe yang sama persis secara lokal:

```bash
# 1. Jalankan build prototipe
pnpm build:prototype

# 2. Jalankan server lokal production di port 3120
pnpm --filter @syncpod/web start -p 3120

# 3. Di terminal lain, jalankan uji kelayakan smoke URL
node scripts/smoke-url.mjs http://127.0.0.1:3120
```

---

## 4. Validasi URL Hasil Deploy Vercel

Setelah deployment berhasil di Vercel, lakukan verifikasi URL publik menggunakan skrip otomatis yang sama:

```bash
node scripts/smoke-url.mjs <URL_VERCEL_HASIL_DEPLOY>
```

Skrip ini secara otomatis memverifikasi:
1. Status `200 OK` (setelah redirect) pada 7 rute utama (`/`, `/masuk`, `/pod`, `/pod?scenario=fallback`, `/pod/pod-042`, `/pod/pod-042?demo=1`, `/pod/pod-042/selesai`).
2. Keberadaan penanda transparansi `"Prototipe: data simulasi"` di setiap halaman.
3. Nol `Set-Cookie` header (karena tidak ada cookie sesi bocor di prototipe fake).
4. Tidak ada kebocoran referensi `localhost` dalam HTML.
5. 20 sampel aset statis `/_next/static/...` mengembalikan status `200 OK`.
