# Topologi Branch, Tata Kelola Integrasi, dan Latihan Merge (C6, D37)

Dokumen ini mendokumentasikan arsitektur branch repository STACK_SyncPod per 20 November 2026, tujuan tiap cabang, urutan penggabungan (merge order) yang direkomendasikan, serta hasil latihan penggabungan (merge rehearsal) antara cabang semifinal pack dan cabang backend.

---

## 1. Diagram Topologi Branch

```text
main (0ecfe09) [Lolos Phase 2C - Prototipe Fake Mode]
 │
 ├── phase/2d-semifinal-pack (15c604d) [Semifinal Submission Pack - 30 Nov]
 │    ├── Alat bukti mandiri: scripts/proof-run.mjs, scripts/check-proof-logs.mjs
 │    ├── Matriks klaim & bukti: Docs/semifinal/CLAIMS_AND_EVIDENCE.md
 │    ├── Naskah demo 2 menit: Docs/DEMO_SCRIPT.md
 │    ├── Latihan demo 6 run otomatis: scripts/demo-rehearsal.mjs, proof/phase-2d/
 │    └── BERSIH 100% dari kode backend (apps/realtime, packages/db, auth.ts, api)
 │
 └── phase/3-db-auth (0c4fa51) [Phase 3A + 3A-FIX - Basis Data & Auth]
      │
      └── phase/3b-guards (eead534) [Phase 3B - Proteksi Rute, Realtime Token, Env]
           │
           └── phase/3c-closeout (HEAD) [Phase 3C Closeout - CI Matrix, Mutasi, Branch Audit]
                ├── Audit default mode: getRealtimeMode() -> 'real' (D18)
                ├── CI Security Matrix: .github/workflows/ci.yml (real-mode-matrix, fake-bundle)
                ├── Config-driven mutation harness: scripts/mutation-check.mjs (26/26 mutan killed)
                └── Dokumen topologi & hasil latihan merge: Docs/BRANCHES.md
```

---

## 2. Tujuan dan Status Tiap Cabang

| Cabang | Tujuan Utama | Ketergantungan Backend | Status Push Remote (D37) |
|---|---|---|---|
| `main` | Production-ready prototype baseline yang telah lulus review Phase 2C. | Nol backend aktif (`NEXT_PUBLIC_REALTIME_MODE=fake`). | Sudah di remote (`origin/main`). |
| `phase/2d-semifinal-pack` | Paket penyerahan semifinal STACK (30 Nov): bukti, tangkapan layar, naskah demo, tabel klaim jujur. | **NOL KODE BACKEND.** Terbukti bersih lewat audit C6. | Siap dimerge ke `main` untuk pengumpulan. |
| `phase/3-db-auth` | Migrasi PostgreSQL, seed idempoten, Auth.js v5 satu jalur, demo login. | Database PostgreSQL lokal, Prisma ORM, Auth.js v5. | Cabang lokal (tunggu izin panitia/Build Period). |
| `phase/3b-guards` | Proteksi rute (`proxy.ts` + Server Components), token realtime HS256, authz pod, Zod env. | Prisma DB authz, token signer/verifier jose. | Cabang lokal (tunggu izin panitia/Build Period). |
| `phase/3c-closeout` | Closeout Phase 3: harness mutasi, CI security matrix, audit default mode, gate mentah. | PostgreSQL lokal, secret generator acak. | Cabang aktif saat ini; tetap lokal sampai user approve. |

---

## 3. Konfirmasi Kebersihan Cabang Semifinal (C6.3)

Pemeriksaan integritas kode backend pada `phase/2d-semifinal-pack` dijalankan dengan perintah:
```bash
git diff --stat main...phase/2d-semifinal-pack -- apps/realtime packages/db apps/web/src/auth.ts apps/web/src/app/api
```
**Hasil:** Output kosong (0 berkas, 0 baris berubah).  
Hal ini membuktikan secara definitif bahwa `phase/2d-semifinal-pack` bebas dari kode backend dan sepenuhnya aman diserahkan ke dewan juri semifinal tanpa risiko diskualifikasi aturan Build Period.

---

## 4. Urutan Penggabungan yang Diusulkan (Proposed Merge Order)

Sesuai **D37** (backend tetap lokal sampai izin panitia STACK diperoleh atau Build Period resmi dimulai 7 Desember 2026):

### Langkah 1: Merge `phase/2d-semifinal-pack` ke `main` (Sebelum 30 Nov)
- **Tindakan:** Buat Pull Request dari `phase/2d-semifinal-pack` ke `main`.
- **Alasan:** Cabang ini hanya berisi artefak semifinal (skrip bukti, naskah demo, bukti audit aksesibilitas/kontras/smoke test) dan tidak mengandung kode backend.
- **Dampak:** `main` menjadi cabang referensi resmi semifinal yang dapat dideploy ke Vercel untuk prototipe publik.

### Langkah 2: Pertahankan Cabang Backend di Lokal (Sampai 7 Des atau Izin Panitia)
- Cabang `phase/3-db-auth`, `phase/3b-guards`, dan `phase/3c-closeout` **TIDAK DI-PUSH** ke remote publik sampai panitia STACK mengonfirmasi kebolehan pengembangan backend sebelum 7 Desember 2026.

### Langkah 3: Sinkronisasi `main` ke Cabang Backend via `git merge` (Bukan Rebase)
- Saat pengembangan backend diizinkan:
  ```bash
  git checkout phase/3c-closeout
  git merge main
  ```
- **Aturan D37:** Gunakan `git merge`, **JANGAN `git rebase`**, agar riwayat audit commit, hash commit, dan penanda waktu verifikasi tidak tertulis ulang.
- Selesaikan konflik sesuai resolusi yang telah divalidasi pada Latihan Merge di bawah.

---

## 5. Laporan Latihan Merge (Merge Rehearsal C6.2)

Latihan merge telah dieksekusi pada cabang sementara `scratch/merge-rehearsal` yang dicabangkan dari `phase/3c-closeout` dengan perintah:
```bash
git checkout -b scratch/merge-rehearsal
git merge --no-commit --no-ff phase/2d-semifinal-pack
```

### Daftar Konflik dan Strategi Resolusi Pasti:

| Berkas Konflik | Tipe Konflik | Penyebab Konflik | Strategi Resolusi yang Divalidasi |
|---|---|---|---|
| `.github/workflows/ci.yml` | Content conflict | `phase/2d` menambahkan verifikasi skrip; `phase/3c` menambahkan generate prisma, job `real-mode-matrix`, dan `fake-bundle`. | **Pilih versi `HEAD` (`phase/3c-closeout`)**. Versi `phase/3c` mencakup seluruh langkah verifikasi `phase/2d` ditambah matriks keamanan backend dan build fake murni. |
| `Docs/semifinal/CLAIMS_AND_EVIDENCE.md` | Add/Add conflict | Berkas dibuat di kedua cabang dengan tabel matriks klaim yang berbeda (klaim mode fake di 2D vs klaim backend terverifikasi di 3B/3C). | **Pilih versi `HEAD` (`phase/3c-closeout`)**. Versi `phase/3c` memuat seluruh klaim prototipe ditambah update status terverifikasi FR-1.1 dengan kalimat aman yang akurat. |
| `apps/web/src/app/layout.tsx` | Content conflict | `phase/2d` merender `<aside>` status prototipe tanpa syarat; `phase/3c` merender kondisional `{isFakeMode && <aside>}` sesuai D32. | **Pilih versi `HEAD` (`phase/3c-closeout`)**. Sesuai D32, penanda simulasi hanya boleh muncul di mode fake, bukan di mode real. |
| `package.json` | Content conflict | `phase/2d` menambahkan `test:scripts`; `phase/3c` menambahkan `test:scripts`, `db:migrate`, `db:seed`, `check:secrets`, `cross-env@7.0.3`, dan `build:prototype`. | **Pilih versi `HEAD` (`phase/3c-closeout`)**. Versi `HEAD` merupakan superset lengkap yang mempertahankan kompatibilitas kedua cabang. |
| `proof/phase-2d/tools.log` | Add/Add conflict | Log eksekusi `test:scripts` dibuat di kedua cabang dengan timestamp berbeda. | **Pilih salah satu versi (keduanya identik EXIT=0)**. Simpan versi `phase/2d-semifinal-pack` untuk integritas audit semifinal pack. |

### Pasca-Latihan:
Setelah seluruh konflik dan resolusinya diverifikasi dan dicatat, latihan dibatalkan secara bersih tanpa residu:
```bash
git merge --abort
git checkout phase/3c-closeout
git branch -D scratch/merge-rehearsal
```
Cabang `phase/3c-closeout` tetap murni dan tidak membawa perubahan dari `phase/2d-semifinal-pack`.
