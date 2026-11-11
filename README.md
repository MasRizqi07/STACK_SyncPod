# SyncPod

**Automated Micro-Study Pod dan Collaborative Sprint Platform**  
Tim **Cah Kacawww** (Institut Teknologi Adhi Tama Surabaya) — GDGoC ITB STACK 2026, Case 1: Smarter Campus and Learning.

## Struktur Monorepo

- `apps/web` — Aplikasi Next.js (App Router, Tailwind CSS v4, desain token & font self-hosted)
- `apps/realtime` — Server Node + Socket.IO (health check, sinkronisasi pod, matchmaking, Yjs, pemandu Sokratik Gemini)
- `packages/db` — Skema PostgreSQL, migrasi, dan seed Prisma (`6.19.3`)
- `packages/shared` — Tipe bersama, `ErrorCode`, `Ack<T>`, dan skema Zod kontrak event
- `Docs/` — Dokumen sumber kebenaran (`PRD.md`, `DESIGN.md`, `DECISIONS.md`)

## Prasyarat

- Node.js `>= 20.9.0` (lihat `.nvmrc`: `26.8.1`)
- pnpm `12.8.1` (`corepack enable` atau instalasi global `pnpm`)
- Docker (untuk PostgreSQL lokal)

## Menjalankan Secara Lokal

1. Salin konfigurasi lingkungan:

   ```bash
   cp .env.example .env
   ```

2. Jalankan PostgreSQL lokal (mulai Phase 3):

   ```bash
   docker compose up -d
   ```

3. Pasang dependensi dan jalankan quality gate:

   ```bash
   pnpm install
   pnpm -r typecheck
   pnpm -r lint
   pnpm -r test
   pnpm -r build
   ```

4. Jalankan server pengembangan (`apps/web` dan `apps/realtime`):

   ```bash
   pnpm dev
   ```

   - Web: `http://localhost:3000`
   - Realtime health check: `http://localhost:4000/health`

## Mode Offline (Demo Venue)

Setelah `pnpm install` dan `pnpm -r build`, seluruh aplikasi dibangun tanpa mengambil font dari CDN eksternal (`@fontsource-variable/*` di-bundle secara lokal). Atur `GEMINI_MOCK=true`, `DEMO_MODE=true`, dan `NEXT_TELEMETRY_DISABLED=1` di `.env` untuk menjalankan demo tanpa koneksi internet.
