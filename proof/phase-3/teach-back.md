# Teach-Back: Phase 3A (Database, Seed, Auth.js, Demo Login)

## 1. Tiga Pertanyaan Penguji (Examiner Questions)

1. **Konkurensi & Indeks Parsial PostgreSQL:**
   Ketika dua request pencarian pod (`match:enqueue`) dari satu pengguna yang sama tiba di server pada milidetik yang identik sebelum baris pertama selesai disimpan, mengapa pemeriksaan tingkat aplikasi seperti `prisma.matchRequest.findFirst({ where: { userId, status: 'WAITING' } })` rentan terhadap *time-of-check to time-of-use (TOCTOU) race condition*, dan bagaimana indeks unik parsial `CREATE UNIQUE INDEX one_waiting_per_user ON "MatchRequest"("userId") WHERE status = 'WAITING'` menyelesaikan kondisi balapan tersebut secara deterministik di level *page latch/tuple lock* PostgreSQL?

2. **Enkripsi JWE vs Bearer Token pada Auth.js v5:**
   Mengapa Auth.js v5 menggunakan enkripsi JWE (`A256CBC-HS512`) untuk cookie `authjs.session-token` alih-alih JWT bertanda tangan biasa (`JWS`), dan apa konsekuensi latensi serta beban CPU pada server ketika setiap pemanggilan `auth()` di server-rendered component harus mendekripsi payload cookie tersebut dibandingkan dengan memverifikasi tanda tangan simetris ringan HS256?

3. **Idempotensi Seed pada Multi-Instance CI:**
   Pada lingkungan CI paralel atau orkestrasi multi-kontainer yang menjalankan migrasi dan seed secara bersamaan, bagaimana pola `upsert` pada kunci unik (`code` pada Course dan `id` pada Module) menjamin bahwa data referensi silang (`parentId` pada hierarki pohon modul) tidak memicu *foreign key violation* atau *deadlock* saat transaksi dieksekusi di bawah isolasi transaksi *Read Committed*?

---

## 2. Satu Analogi (One Analogy)

Indeks unik parsial `one_waiting_per_user` diibaratkan seperti **gantungan nomor antrean di loket perpustakaan**: seorang mahasiswa boleh memiliki banyak kuitansi pengembalian buku yang telah selesai atau dibatalkan (`CANCELLED`), namun papan gantungan fisik hanya menyediakan satu slot nomor aktif (`WAITING`) untuk setiap nomor induk mahasiswa. Jika mahasiswa tersebut mencoba mengambil nomor antrean kedua sebelum nomor antrean pertama dipanggil atau dikembalikan, pasak slot fisik akan terkunci dan menolak karcis kedua secara mekanis, terlepas dari berapa banyak petugas loket yang melayani di waktu bersamaan.

---

## 3. Apa yang Rapuh (What is Fragile)

Penamaan cookie sesi Auth.js bervariasi secara otomatis bergantung pada protokol koneksi: `authjs.session-token` pada HTTP (lokal/dev) dan `__Secure-authjs.session-token` pada HTTPS (produksi). Jika aplikasi dijalankan di lingkungan produksi (`NODE_ENV === 'production'`) di belakang *reverse proxy* (misalnya NGINX, Cloudflare, atau Docker ingress) yang melakukan *TLS termination* namun tidak meneruskan header `X-Forwarded-Proto: https`, Next.js dapat menganggap koneksi sebagai HTTP biasa sementara handler login menulis cookie berawalan `__Secure-`. Hal ini dapat menyebabkan browser menolak menyimpan cookie tersebut atau server gagal membacanya, mengakibatkan *redirect loop* unauthenticated yang sulit didiagnosis.
