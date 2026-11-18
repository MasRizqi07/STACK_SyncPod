# Teach-Back: Phase 3 Complete (DB, Auth.js, Next 16 Proxy, Realtime JWT, Authz & Env)

## 1. Tiga Pertanyaan Penguji (Examiner Questions)

1. **Isolasi Token Realtime HS256 vs Sesi Cookie JWE (`proxy.ts` & `/api/realtime/token`):**
   Mengapa arsitektur SyncPod memisahkan cookie sesi Auth.js (`HttpOnly` JWE `A256CBC-HS512` berdurasi 30 hari di domain web) dari token otentikasi server realtime (`HS256` JWT berdurasi 5 menit dari `GET /api/realtime/token`), alih-alih meneruskan cookie sesi web secara langsung pada handshake Socket.IO dan upgrade WebSocket `/yjs/:podId`? Apa dampak keamanan jika `REALTIME_JWT_SECRET` dan `AUTH_SECRET` disamakan?

2. **Batas Kepercayaan `proxy.ts` (Next.js 16) vs Otorisasi Berbasis DB (`assertPodMember` / `assertPodLeader`):**
   `apps/web/src/proxy.ts` hanya memverifikasi integritas kriptografis token JWT di cookie tanpa menyentuh PostgreSQL agar tidak memicu *DB round-trip* pada setiap navigasi, sementara `assertPodMember` dan `assertPodLeader` di `packages/db` melakukan query langsung ke tabel `SprintPod` dan `PodMember`. Dalam skenario apa permintaan yang lolos `proxy.ts` tetap wajib ditolak oleh `assertPodMember` atau `assertPodLeader` di Phase 4–8?

3. **Konkurensi Indeks Parsial PostgreSQL & Fail-Fast Environment Guard:**
   Ketika dua permintaan `match:enqueue` dari user yang sama tiba serentak, bagaimana indeks unik parsial `CREATE UNIQUE INDEX one_waiting_per_user ON "MatchRequest"("userId") WHERE status = 'WAITING'` mencegah *TOCTOU race condition* di level tuple PostgreSQL — dan mengapa `validateWebEnv()` di `apps/web/src/instrumentation.ts` sengaja melewati pemeriksaan rahasia saat `NEXT_PHASE === 'phase-production-build'` namun tetap gagal cepat (*fail-fast*) saat server boot (`next start`)?

---

## 2. Satu Analogi (One Analogy)

Pemisahan antara **cookie sesi web Auth.js** dan **token realtime 5 menit (`/api/realtime/token`)** diibaratkan seperti **kartu tanda mahasiswa (KTM) dan tiket masuk ruang laboratorium komputer**: KTM disimpan aman di dalam dompet (`HttpOnly` cookie, tidak pernah disentuh skrip pihak ketiga di browser), sedangkan untuk masuk ke ruang lab realtime yang terpisah gedungnya (port 4000 / Socket.IO + Yjs), petugas resepsionis (`GET /api/realtime/token`) mengecek KTM-mu lalu mencetak tiket akses sekali pakai yang otomatis kedaluwarsa dalam 5 menit. Jika tiket ruang lab terjatuh, aksesnya mati sendiri dalam 5 menit tanpa membocorkan KTM maupun memberi akses ke akun web utamamu.

---

## 3. Apa yang Rapuh (What is Fragile)

1. **Sinkronisasi Cookie `authjs.session-token` pada Mode Reverse Proxy / LAN HTTP:**  
   `isSecureRequest()` mengandalkan header `X-Forwarded-Proto` dan protokol URL request untuk memilih antara `authjs.session-token` (HTTP LAN/dev) dan `__Secure-authjs.session-token` (HTTPS produksi). Jika aplikasi di-deploy di belakang *reverse proxy* yang memutus TLS tetapi tidak meneruskan `X-Forwarded-Proto: https` (atau meneruskan header palsu dari klien yang tidak dibersihkan di edge), cookie yang ditulis oleh `/api/demo/login` bisa tidak cocok dengan cookie yang dibaca oleh `auth()` atau `proxy.ts`.
2. **Ketergantungan `apps/web` Test pada `DATABASE_URL` Aktif:**  
   Berbeda dengan `packages/db` yang otomatis mengisolasi test ke database `syncpod_test` lewat `globalSetup`, dua file test integrasi di `apps/web` (`auth.test.ts` dan `demo-login-route.test.ts`) masih menyentuh `DATABASE_URL` langsung (`upsert` akun seeded `demo-1@demo.syncpod.local`). Jika lingkungan lokal belum menjalankan `pnpm db:migrate`, dua test tersebut akan gagal hingga migrasi diterapkan.
