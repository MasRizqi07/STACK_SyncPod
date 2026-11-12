# Phase 2b Plan: Penyelarasan & Penyelesaian Prototipe Semifinal

**Branch:** `phase/2b-screens` (dibuat dari `main` di `d2d715e`, yang membawa prototipe awal 2b di atas Phase 2a `b1814b3`)  
**Sumber kebenaran:** `Docs/DECISIONS.md` (D1–D32) > `Docs/PRD.md` > `Docs/DESIGN.md`.  
**Target panjang berkas:** ≤ 250 baris. **Status:** Stage A Plan (belum ada kode produk diubah).

## 1. Konfirmasi Scope & Non-Scope

- **Part M (wajib lebih dulu):** `M0` (tidak ada `2A REVIEW NOTES` dari user), `M1` (`.github/workflows/ci.yml` dua mode build), `M2` (sentinel + `scripts/check-real-bundle.mjs` + tes mode `real` `/pod/[podId]`), `M3` (`scripts/capture-screens.mjs` menimpa set `proof/phase-2b/`), `M4` (`runRealtimeClientContract` di `apps/web/test/`), `M5` (`scripts/check-contrast.mjs` untuk token CSS), `M6` (`scripts/depcheck.mjs` jujur, tanpa `minimumReleaseAgeExclude`), `M7` (audit UI/UX Pro Max 2a & 2b + perbaikan), `M8` (`packages/shared/src/fixtures/syllabus.ts` ≥ 3 matkul, 3 tingkat, ≥ 8 daun `isLeaf`).
- **Part S (layar & demo):** `S1` (`/masuk`, `/` redirect), `S2` (`/pod` state machine lengkap + kontrol native D22), `S3` (transisi radar → cockpit D29, buka `LOBBY`), `S4` (`/pod/[podId]/selesai` + blok P1 `Beri apresiasi` hanya setelah gate P0 hijau + redirect bila pod belum `COMPLETED`), `S5` (`ConnectionBanner` delay 2s + toast 2s, `app/error.tsx`, `app/pod/error.tsx`, `app/not-found.tsx`, `app/pod/loading.tsx`, empty states A7), `S6` (`DemoControls` `?demo=1` mode `fake`), `S7` (`Docs/DEMO_SCRIPT.md` + tes timeline ≤ 120s), `S8` (`build:prototype`, `cross-env`, README deploy Vercel, penanda D32 `"Prototipe: data simulasi"`).
- **Non-scope (PRD §4.2, D13, D21, D23, §8):** Auth.js nyata & DB (Phase 3), Socket.IO nyata (Phase 4), Yjs (Phase 6), Gemini nyata (Phase 7), profil FR-1.2, banner statistik "28 mahasiswa" (D21), light mode / multi-bahasa / video / Redis, serta `shadcn init` / `framer-motion` / `react-hook-form` / chart libs.

## 2. Decision Points (Risiko Teknis)

### DP1: Kontinuitas visual radar ke timer (`D29`)
Hasil inspeksi `next@16.4.6` (`config-shared.d.ts`) dan `react@19.3.1`: `experimental.viewTransition` tidak diekspos pada versi Next stabil terpasang (`ViewTransition` hanya di `@types/react/experimental.d.ts`).
- **Opsi A (Rekomendasi):** Pasang `view-transition-name: syncpod-pod-ring` pada `PodRing` (nonaktif bila `prefers-reduced-motion: reduce`), lalu lakukan 1 percobaan `document.startViewTransition` membungkus `router.push('/pod/' + podId)` saat transisi `found → cockpit`. Jika Chromium/App Router gagal merender transisi antar-rute karena navigasi asinkron, pakai fallback **cross-fade 200 ms** (`syncpod-ring-enter` CSS `@keyframes`) pada mount `/pod/[podId]` dan catat di laporan.
- **Opsi B:** Langsung pakai cross-fade 200 ms CSS tanpa mencoba View Transitions — risiko nol, tapi melewatkan percobaan eksplisit D29.
- **Opsi C:** Paksa `react@experimental` di `next.config.ts` — melanggar pin toolchain D4 dan stabilitas Phase 2.

### DP2: Dua identitas (leader & non-leader) di `FakeRealtimeClient` (`G3`)
- **Opsi A (Rekomendasi):** Ekstrak state runtime pod/antrean/matching ke store memori kecil `FakeWorldStore` (`~130` baris) yang dapat di-inject lewat `FakeRealtimeClientOptions.store`. Satu instance client terikat satu `userId` tetap (`leader`, `member`, `outsider`), persis kontrak `RealtimeClient` tanpa `userId` di payload, sehingga `runRealtimeClientContract` langsung siap dipakai ulang untuk klien Socket.IO nyata di Phase 4. Sekaligus memecah `fake-client.ts` (1039 baris) agar tiap berkas `<= 250` baris.
- **Opsi B:** Tambah metode test-only `setUserId()` pada satu `FakeRealtimeClient` — lebih singkat, tetapi membocorkan mutasi identitas ke kontrak klien nyata dan mengaburkan batas otorisasi antar koneksi.
- **Opsi C:** Simulasi message broker event bus penuh meniru Socket.IO rooms — over-engineering (R1 rung 6 berlebih) dan menduplikasi Phase 4.

## 3. Pohon Berkas Baru & Pemecahan (>250 baris)

- **CI & Scripts:** `.github/workflows/ci.yml` (~95), `scripts/check-real-bundle.mjs` (~65), `scripts/check-contrast.mjs` (~110), `scripts/depcheck.mjs` (~75), `scripts/capture-screens.mjs` (~190).
- **Shared (`packages/shared`):** `src/fixtures/syllabus.ts` (~165), `src/summary-markdown.ts` (~75), `test/shared.test.ts` (~95).
- **Realtime & Errors (`apps/web/src/features/`):**
  - Pecah `fake-client.ts` (1039) → `fake-store.ts` (~135), `fake-client.ts` (~240), `fake-scenario.ts` (~45), `client-loader.ts` (~35; dynamic import agar tree-shake bersih di mode `real` + sentinel).
  - `errors/error-copy.ts` (~70, exhaustive `Record<ErrorCode, ...>` D27).
- **UI & Routes (`apps/web/src/`):**
  - `components/common/`: `PrototypeBadge.tsx` (~25, D32), `DemoControls.tsx` (~135, D25 + sentinel), `ConnectionBanner.tsx` (~60, delay 2s + toast 2s); routes `app/error.tsx` (~35), `app/pod/error.tsx` (~40), `app/not-found.tsx` (~35), `app/pod/loading.tsx` (~45).
  - Pecah file gemuk: `CockpitShell.tsx` (839) → `usePodCockpit.ts` (~190) + `CockpitHeader.tsx` (~115) + `CockpitDrawer.tsx` (~130) + `CockpitShell.tsx` (~240); `MatchmakingShell.tsx` (594) → `useMatchmakingFlow.ts` (~175) + `FallbackOfferPanel.tsx` (~75) + `MatchFoundPanel.tsx` (~55) + `MatchmakingShell.tsx` (~220); `SummaryShell.tsx` (338) → `SummaryQuestions.tsx` (~95) + `EndorseSection.tsx` (~75) + `SummaryShell.tsx` (~190); `PodRing.tsx` (325) → `PodRingSvg.tsx` (~130) + `PodRing.tsx` (~190).
- **Docs:** `Docs/DEMO_SCRIPT.md` (~110).

## 4. State Machine Matchmaking (`/pod`)

| State | Pemicu Masuk | Tampilan & Aksesibilitas | Keluar → Event |
|---|---|---|---|
| `loading` | Mount sebelum klien/sesi siap | Skeleton seukuran form (CLS < 0.1) | `idle` (klien siap) |
| `idle` | Selesai load / `Batal` | Form modul (`<details>` + radio), urgensi, jendela (default `Sekarang 25 mnt`), ring 0/4 redup, pilihan sebelumnya tetap | `invalid` (validasi klien gagal), `submitting` (submit valid) |
| `invalid` | Modul non-daun / jendela D6 salah | Pesan galat di dekat field + fokus otomatis pindah ke field pertama yg salah | `idle` (ubah input), `submitting` (perbaiki & submit) |
| `submitting` | Klik `Cari pod` valid | Tombol `Cari pod` disabled + indikator tunggu (anti klik ganda) | `searching` (ack `match:enqueue` ok), `error` (ack error) |
| `searching` | Ack `match:enqueue` ok / `Extend` | Radar `n/4`, `aria-live="polite"` `"Menemukan n dari 4 teman belajar"`, tombol `Batal` aktif; di mobile ring pindah ke atas | `fallback-offer` (`match:fallback-offer`), `found` (`match:found`), `idle` (klik `Batal`), `error` (putus/ack gagal) |
| `fallback-offer` | Event `match:fallback-offer` (D24 `scenario=fallback` berhenti di 3/4 lalu 8 dtk tunggu) | Panel D7 60 dtk hitung mundur (helper 2a), tombol `Mulai bertiga` & `Tunggu lebih lama` | `found` (semua terima), `searching` (tolak / tunggu lebih lama / TTL habis) |
| `found` | Event `match:found` | `"Pod ditemukan"`, ring 4/4 (atau 3/4), tombol `Masuk sekarang`, auto-navigasi 1,5 dtk ke `/pod/[podId]` (D29) | `/pod/[podId]` |
| `error` | Ack error (`ALREADY_IN_POD`, dll.) | Teks dari `errorCopy` (D27); `ALREADY_IN_POD` tampilkan aksi `Kembali ke pod` | `idle` (tutup/ulang), `/pod/[activePodId]` |

## 5. Daftar Tugas Terurut (`T1..T16`)

| Tugas | Tujuan & Berkas | Tes Lebih Dulu (Mutasi/Kontrak) | Verifikasi & Hasil | PRD AC |
|---|---|---|---|---|
| **T1 (M8)** | Pindah syllabus ke `packages/shared/src/fixtures/syllabus.ts` + helper pencarian breadcrumb; pakai di web | Tes bentuk: ≥ 3 matkul, 3 tingkat, ≥ 8 daun `isLeaf`, tanpa duplikat ID | `pnpm --filter @syncpod/shared test` → lulus semua | FR-1.3 |
| **T2 (D26)** | Ekspor `buildSessionSummaryMarkdown(summary)` di `packages/shared/src/summary-markdown.ts` | Golden file test output Markdown WIB, anggota, catatan, & 3 status pertanyaan | `pnpm --filter @syncpod/shared test` → snapshot cocok | FR-5.1 |
| **T3 (M4,DP2)** | Ekstrak `FakeWorldStore` + tulis `runRealtimeClientContract` di `apps/web/test/realtime-contract.test.ts` (seluruh G3) **sebelum** implementasi/perbaikan `FakeRealtimeClient` | Tulis seluruh kasus G3 (leader vs non-leader `FORBIDDEN`, non-anggota `NOT_A_MEMBER`, `QUESTION_LIMIT`, `socratic:ask` 3 tanya/idempoten/`ASKING_GEMINI`, `ENDORSE` state, D7 fallback, `VALIDATION_FAILED`) | `pnpm --filter @syncpod/web test` → seluruh kasus G3 hijau | FR-2.1–4.3, 5.2 |
| **T4 (D24,D25,M2)** | Tambah `?scenario=happy|fallback` (tunggu 8s di 3/4 → offer 60s), `DemoControls.tsx` (`?demo=1`, sentinel, aman dari tab bar mobile), dynamic loader mode `real` vs `fake` + `scripts/check-real-bundle.mjs` | Tes skenario `fallback` D24, tes komponen `/pod/[podId]` mode `real` tanpa impor fake | `node scripts/check-real-bundle.mjs` → sentinel ada di `fake`, 0 di `real` | FR-2.4, NFR-4 |
| **T5 (D27)** | Buat `errorCopy: Record<ErrorCode, ...>` exhaustive + aksi `ALREADY_IN_POD` | Tes exhaustiveness tiap `ErrorCode` & render tombol `Kembali ke pod` | `pnpm --filter @syncpod/web test` & `typecheck` → 0 error | FR-2.1, NFR |
| **T6 (M5,M6)** | Buat `scripts/check-contrast.mjs` (`--color-purple-text` teks kecil ≥ 4.5:1) & pindah `scripts/depcheck.mjs` dengan daftar pengecualian eksplisit di atas berkas | — (skrip CLI + asersi exit code) | `node scripts/check-contrast.mjs` & `node scripts/depcheck.mjs` → exit 0 | NFR-5 |
| **T7 (M7)** | Audit UI/UX Pro Max 2a (`PodRing`, `CockpitShell`, `layout.tsx`) + pecah `CockpitShell.tsx` & `PodRing.tsx` (`<=250` baris): skip link, `viewport-fit=cover`, safe-area tab bar, `touch-action: manipulation`, scrim drawer 50%, jarak sentuh ≥ 8px, target ≥ 44px | Tes DOM & heading berurutan + aria-label tombol ikon | `pnpm -r test` + tabel checklist G14 lengkap | NFR-3, NFR-5 |
| **T8 (M1)** | Tambah `.github/workflows/ci.yml` (`push`, `pull_request`, `contents: read`, concurrency, Node `.nvmrc`, pnpm `packageManager`, matriks `real`/`fake`, `check-real-bundle`) | — (verifikasi langsung run CI setelah push) | Push branch → cek status run GitHub Actions hijau | Gate G1 |
| **T9 (S2,D22)** | Refactor `ModulePicker.tsx` (`<details>/<summary>`, `<input type="radio">`, breadcrumb hasil pencarian + `aria-live="polite"` + `"Hapus pencarian"`), `Chip.tsx` (radio native), pecah `MatchmakingShell.tsx` dengan state machine 8 state lengkap | Tes state machine (`invalid` fokus ke field error, `submitting` anti double-submit, `found` 1.5s, `Batal` simpan pilihan, D6 validasi, `ALREADY_IN_POD`) | `pnpm --filter @syncpod/web test` → seluruh tes S2 hijau | FR-1.3, 2.1–2.4 |
| **T10 (S3,DP1)** | Implementasi transisi `found → /pod/[podId]` (`LOBBY`), `view-transition-name` D29 dengan fallback 200ms cross-fade & `prefers-reduced-motion` | Tes reduced-motion & fallback cross-fade | Verifikasi CDP `getComputedStyle` & `phase === 'LOBBY'` | FR-3.1, NFR-5 |
| **T11 (S4)** | Pecah `SummaryShell.tsx` (`<=250` baris): redirect ke cockpit bila belum `COMPLETED`, disclosure native AI hint, kosong `"Tidak ada pertanyaan di sesi ini."`, unduh `.md` lewat `buildSessionSummaryMarkdown`, blok P1 `Beri apresiasi` (sesudah P0 hijau) | Tes redirect non-`COMPLETED`, tes empty questions, tes `endorseGive` P1 (`INVALID_STATE` / `FORBIDDEN` lewat `errorCopy`) | `pnpm --filter @syncpod/web test` → lulus | FR-5.1, FR-5.2 |
| **T12 (S1)** | Sempurnakan `/masuk` (`MasukCard.tsx`): `h1` A7, tombol Google pakai ikon Lucide generik, mode `real` disabled + keterangan Phase 3, mode `fake` + tautan akun demo | Tes mode `fake` vs `real` pada `MasukCard` | `pnpm --filter @syncpod/web test` → lulus | FR-1.1 |
| **T13 (S5,D32)** | `ConnectionBanner` delay 2s + toast `"Tersambung kembali"` 2s, tambah `app/error.tsx`, `app/pod/error.tsx`, `app/not-found.tsx`, `app/pod/loading.tsx`, empty state modul tidak ditemukan, & `PrototypeBadge` `"Prototipe: data simulasi"` | Tes timer 2s disconnect/reconnect, tes `PrototypeBadge` tampil di mode `fake` & absen di `real` | `pnpm --filter @syncpod/web test` → lulus | FR-3.5, D32 |
| **T14 (S8,D30)** | Pasang `cross-env` exact pin (cek usia rilis tanpa `minimumReleaseAgeExclude`), tambah `build:prototype` di root `package.json`, tulis bagian `"Deploy prototipe (Vercel)"` + instruksi uji Wi-Fi mati di `README.md` | — | `pnpm build:prototype` lokal → exit 0, log disimpan | NFR-6, G13 |
| **T15 (S7)** | Tulis `Docs/DEMO_SCRIPT.md` (cap waktu 10+25+30+30+25 = 120 dtk, klik, URL, narasi, batasan klaim) + tes timeline konstanta ≤ 120s | Tes parsing/validasi jumlah durasi segmen `Docs/DEMO_SCRIPT.md` ≤ 120 detik | `pnpm --filter @syncpod/web test` → lulus (G12) | NFR-6 |
| **T16 (M3,G2–G14)** | Pindahkan skrip ke `scripts/capture-screens.mjs` (CLI `CHROME_PATH`, timpa `proof/phase-2b/`), jalankan seluruh gate G2–G13 (`tee` ke `proof/phase-2b/*.log`), Lighthouse `pnpm dlx lighthouse@<pin>`, cek zero raw hex | Tes CLI `capture-screens.mjs` & seluruh suite gate | Semua log & PNG G1–G14 lengkap di `proof/phase-2b/`, CI hijau | NFR-1–6 |

## 6. Spec Self-Review

- **Placeholder scan:** Tidak ada TODO/TBD; seluruh rute, nama berkas, perintah verifikasi, dan kriteria penerimaan terisi konkret.
- **Cek konsistensi:** Urutan `T1–T16` menuntaskan `M1–M8` sebelum modifikasi UI layar (`S2/S3 → S4 → S1 → S5 → S6 → S8 → S7`), dan blok P1 `Beri apresiasi` berada di `T11` dengan syarat gate P0 hijau. Kontrak `RealtimeClient` tetap tanpa `userId` di payload (DP2). `FakeRealtimeClient` diisolasi via dynamic import (`T4`) sehingga sentinel check `M2` dijamin deterministik.
- **Scope check:** Tidak menyentuh `apps/realtime` server nyata, `packages/db` migrasi Auth, atau dependency terlarang D23. Semua berkas hasil pemecahan dijaga ≤ ~240 baris.
- **Ambiguitas teknis tersisa (diperiksa di Stage B saat eksekusi):** ketersediaan Node `26.8.1` pada runner `ubuntu-latest` di `ci.yml` (`T8`) dan usia rilis `cross-env` terhadap aturan pnpm (`T14`); bila salah satu terblokir, eksekusi akan berhenti dan melapor sesuai aturan M1 & M6.
