# Tabel Klaim dan Bukti Prototipe Semifinal SyncPod

**Dokumen:** `Docs/semifinal/CLAIMS_AND_EVIDENCE.md`  
**Target:** Penjurian Semifinal GDGoC ITB STACK 2026 (Case 1: Smarter Campus and Learning)  
**Referensi Utama:** `Docs/PRD.md`, `README.md`, `Docs/DEMO_SCRIPT.md`, `Docs/DECISIONS.md`  
**Aturan Status:**  
- `IMPLEMENTED+TESTED`: Fitur kode nyata yang dibuktikan dengan nama test spesifik atau berkas log lulus.
- `SIMULATED`: Fitur antarmuka yang berjalan menggunakan adapter simulasi lokal (`FakeRealtimeClient`) tanpa backend terhubung.
- `NOT BUILT`: Fitur yang berada di cakupan Build Period (Phase 4–9) atau di luar MVP.

---

## 1. Matriks Persyaratan Fungsional (FR-1.1 s.d. FR-5.2)

| ID | Deskripsi Kebutuhan | Status di `phase/3b-guards` | Bukti Verifikasi | Kalimat Aman untuk Proposal (10 Halaman) |
|---|---|---|---|---|
| **FR-1.1** | Autentikasi akun Google kampus / SSO institusi, sesi terlindungi, demo login, proteksi rute, dan token realtime | `IMPLEMENTED+TESTED` | `proof/phase-3a-fix/`, `proof/phase-3b/fake-bundle.log`, `proof/phase-3b/redirect-real.log`, `proof/phase-3b/token.log`, `proof/phase-3b/authz.log`, `proof/phase-3b/env-validation.log`, `proof/phase-3b/bundle-secrets.log` | "Autentikasi sesi JWT terproteksi (Auth.js v5), demo login satu-jalur, proteksi rute ganda (proxy Next.js 16 + Server Component per D38), penerbitan token realtime HS256 (D39), dan otorisasi keanggotaan pod pada database PostgreSQL (3.8) telah terimplementasi dan teruji penuh; server Socket.IO kolaboratif diaktifkan pada Build Period (Phase 4)." |
| **FR-1.2** | Profil akademik (prodi, semester, mata kuliah aktif) | `NOT BUILT` | Kolom ada di `packages/db/prisma/schema.prisma`; form UI belum dibuat | "Fitur pelengkapan profil akademik dirancang pada skema basis data dan akan diimplementasikan sebagai prioritas P1." |
| **FR-1.3** | Taksonomi silabus komputasi 3 tingkat (`Course -> Topik -> Modul daun`) | `IMPLEMENTED+TESTED` | `apps/web/test/matchmaking-logic.test.ts`, `packages/shared/src/fixtures/syllabus.ts` | "Taksonomi silabus komputasi 3 tingkat telah terimplementasi penuh dengan pencegahan pemilihan topik umum secara interaktif." |
| **FR-2.1** | Deklarasi hambatan belajar & tingkat urgensi | `IMPLEMENTED+TESTED` | `apps/web/test/matchmaking-logic.test.ts`, `apps/web/src/components/matchmaking/Chip.tsx` | "Deklarasi hambatan belajar dan tingkat urgensi tervalidasi menggunakan skema tipe Zod dan komponen seleksi yang memenuhi standar aksesibilitas." |
| **FR-2.2** | Slot ketersediaan waktu hari ini (preset & kustom WIB) | `IMPLEMENTED+TESTED` | `apps/web/test/matchmaking-logic.test.ts` | "Penetapan jendela waktu belajar hari ini (WIB) telah diuji dengan preset cepat (25 mnt, 1 jam) dan rentang kustom." |
| **FR-2.3** | Perakit pod (pencocokan otomatis kelompok 4 orang) | `SIMULATED` | `apps/web/test/fake-client.test.ts`, `apps/web/src/components/pod-ring/PodRing.tsx` | "Alur perakitan pod 4 orang disimulasikan secara visual melalui komponen PodRing interaktif; algoritma matcher antrean terpusat dibangun pada Build Period." |
| **FR-2.4** | Masa tunggu cadangan (*fallback* 3 orang setelah 60s) | `SIMULATED` | `apps/web/test/fake-client-phase2b.test.ts` | "Mekanisme fallback fleksibel 3 orang terbukti berjalan pada state machine frontend; logika timeout antrean server diimplementasikan pada Build Period." |
| **FR-3.1** | Timer sprint serempak (Pomodoro 25/5 mnt & koreksi drift) | `IMPLEMENTED+TESTED` | `apps/web/test/clock.test.ts` | "Algoritma sinkronisasi jam dan penghitungan sisa waktu Pomodoro teruji dengan toleransi drift milidetik." |
| **FR-3.2** | Catatan Markdown bersama di kokpit | `SIMULATED` | `apps/web/src/components/cockpit/WorkspaceCenter.tsx` (CodeMirror 6 terpasang) | "Antarmuka editor Markdown responsif telah terintegrasi di kokpit; kolaborasi CRDT real-time multi-pengguna diaktifkan pada Build Period." |
| **FR-3.3** | Antrean pertanyaan (maksimal 1 pertanyaan aktif/anggota) | `SIMULATED` | `apps/web/test/fake-client.test.ts` | "Manajemen batas 1 pertanyaan aktif per anggota telah berjalan di antarmuka kokpit dengan sinkronisasi state lokal." |
| **FR-3.4** | Bar kehadiran rekan pod (fokus, mencatat, bertanya) | `SIMULATED` | `apps/web/test/fake-client.test.ts`, `apps/web/src/components/cockpit/MemberRow.tsx` | "Indikator kehadiran 4 anggota pod divisualisasikan dengan label peran dan status koneksi." |
| **FR-3.5** | Ketahanan koneksi (banner delay 2s & pemulihan otomatis) | `IMPLEMENTED+TESTED` | `apps/web/test/resilience-components.test.tsx` | "Mekanisme peredam fluktuasi jaringan (banner delay 2 detik dan pemulihan otomatis) telah tervalidasi oleh rangkaian tes unit." |
| **FR-4.1** | Pembedah konsep Sokratik (tepat 3 pertanyaan + 1 analogi) | `SIMULATED` | `apps/web/src/components/cockpit/SocraticDrawer.tsx` | "Struktur interaksi pemandu Sokratik 3-pertanyaan telah terintegrasi pada panel drawer; integrasi live LLM Gemini API dibangun pada Build Period." |
| **FR-4.2** | Pagar anti-menyontek (*guardrail* tanpa kode solusi) | `NOT BUILT` | Rencana Phase 7 (`Docs/PHASES_3-9.md`) | "Arsitektur filter pencegah kebocoran kode solusi telah dirancang dan akan divalidasi pada Phase 7." |
| **FR-4.3** | Kesadaran konteks modul dan catatan kelompok | `SIMULATED` | `apps/web/src/components/cockpit/SocraticDrawer.tsx` | "Penggabungan konteks modul dan catatan telah disiapkan pada state UI untuk dikirimkan ke model AI." |
| **FR-5.1** | Kartu ringkasan & generator ekspor Markdown | `IMPLEMENTED+TESTED` | `packages/shared/test/summary.test.ts`, `apps/web/test/summary-export.test.ts` | "Generator berkas ringkasan Markdown pascasprint telah teruji unit secara menyeluruh dengan struktur metrik lengkap." |
| **FR-5.2** | Endorsement sejawat & apresiasi kontribusi rekan | `SIMULATED` | `apps/web/src/components/summary/SummaryShell.tsx` | "Komponen pemberian apresiasi sejawat tersedia di halaman ringkasan; penyimpanan reputasi ke database diselesaikan pada Phase 8." |

---

## 2. Matriks Persyaratan Non-Fungsional (NFR-1 s.d. NFR-6)

| ID | Deskripsi Persyaratan | Status di `phase/3b-guards` | Bukti Verifikasi | Kalimat Aman untuk Proposal (10 Halaman) |
|---|---|---|---|---|
| **NFR-1** | Latensi event pod p95 < 200 ms pada 4G / LAN | `NOT BUILT` | Uji beban WebSocket dijadwalkan Phase 9 | "Target latensi event sub-200ms dirancang menggunakan arsitektur WebSocket Socket.IO murni dan diuji pada Phase 9." |
| **NFR-2** | State sesi bertahan saat server direstart | `NOT BUILT` | Persistensi PostgreSQL dijadwalkan Phase 4 | "Mekanisme pemulihan state pasca-restart server mengandalkan sinkronisasi berkala ke basis data PostgreSQL." |
| **NFR-3** | Responsif 375, 768, 1280 px tanpa scroll horizontal | `IMPLEMENTED+TESTED` | `proof/phase-2c/viewport-overflow.log`, `proof/phase-2d/smoke-local.log` | "Tampilan antarmuka terbukti responsif sempurna pada lebar 375px, 768px, dan 1280px tanpa overflow horizontal." |
| **NFR-4** | Keamanan kredensial & zero-leak di bundle klien | `IMPLEMENTED+TESTED` | `proof/phase-3b/bundle-secrets.log`, `proof/phase-3b/fake-bundle.log`, `scripts/check-bundle-secrets.mjs` | "Kredensial, rahasia database, dan token terisolasi aman di sisi server; bundel klien statis terverifikasi 100% bebas rahasia dan token." |
| **NFR-5** | Aksesibilitas WCAG 2.1 AA (kontras >= 4.5:1, keyboard trap) | `IMPLEMENTED+TESTED` | `apps/web/test/drawer-focus-trap.test.tsx`, `proof/phase-2c/contrast.log` | "Desain sistem memenuhi standar kontras WCAG 2.1 AA (rasio >= 4.5:1), perangkap fokus keyboard aksesibel, dan navigasi ramah pembaca layar." |
| **NFR-6** | Operabilitas offline / venue tanpa internet | `IMPLEMENTED+TESTED` | `@fontsource-variable/*` lokal, `proof/phase-2b/offline-build.log`, `proof/phase-2d/smoke-local.log` | "Prototipe dapat dijalankan dan didemonstrasikan sepenuhnya secara offline tanpa koneksi internet eksternal berkat bundling font lokal mandiri." |

---

## 3. Kejujuran Arsitektur & Realtime Status

1. **Keberadaan Server Realtime:**  
   Pada Phase 3B, server Socket.IO belum dibangun. Permintaan navigasi ke `/pod` di mode real menampilkan *realtime unavailable placeholder shell* yang menyajikan nama akun autentik, tombol keluar, dan pemberitahuan jujur bahwa backend realtime kolaboratif akan dibangun pada Build Period (Phase 4).
2. **Ketiadaan Bocoran Kode Auth di Mode Fake:**  
   Build prototipe mode `fake` diisolasi sepenuhnya dari `next-auth`, `@auth/core`, `@prisma/client`, dan `jose`, dibuktikan oleh `proof/phase-3b/fake-bundle.log`.
3. **Penerbitan Token Terpisah:**  
   Server realtime tidak membaca cookie HTTP-Only Auth.js demi isolasi domain dan portabilitas; otentikasi realtime dilakukan melalui token JWT berumur pendek (300s TTL, HS256) yang diterbitkan melalui `GET /api/realtime/token` (`proof/phase-3b/token.log`).
