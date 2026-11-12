# Naskah Demo Video 2 Menit — SyncPod (Semifinal)

Dokumen ini memandu rekaman demo **120 detik** prototipe SyncPod (`NEXT_PUBLIC_REALTIME_MODE=fake`) secara deterministik. Total durasi seluruh shot wajib **≤ 120 detik**.

## Konstanta Timeline

| Segmen | Topik | Rentang Waktu | Durasi (detik) |
|---|---|---|---:|
| **Shot 1** | Masalah & Masuk | `00:00 – 00:10` | `10` |
| **Shot 2** | Matchmaking & Radar | `00:10 – 00:35` | `25` |
| **Shot 3** | Sprint Serempak & Catatan Bersama | `00:35 – 01:05` | `30` |
| **Shot 4** | Antrean Pertanyaan & Pemandu Sokratik | `01:05 – 01:35` | `30` |
| **Shot 5** | Ringkasan Sesi & Penutup | `01:35 – 02:00` | `25` |
| **Total** | **5 Shot Berurutan** | **`00:00 – 02:00`** | **`120`** |

> [!IMPORTANT]
> **Kejujuran Prototipe (D32):** Setiap narasi demo dan layar wajib transparan bahwa ini adalah **prototipe frontend dengan data simulasi (`Simulasi`)**, bukan backend multipemain nyata. Backend realtime (`Socket.IO`, PostgreSQL, Auth.js, Yjs, dan Gemini API) dibangun pada **Build Period**.

---

## Rincian Shot-by-Shot

### Shot 1 — Masalah & Masuk (`10 detik`: `00:00 – 00:10`)
- **Layar:** Halaman Masuk
- **URL:** `/masuk`
- **Klik Persis:**
  1. Tampilkan penanda `"Prototipe: data simulasi"` dan headline `"Cari teman belajar yang buntu di modul yang sama."`
  2. Klik tombol **"Masuk dengan Google"** *(atau tautan **"Masuk sebagai akun demo"**)* untuk langsung masuk ke `/pod`.
- **Narasi Singkat:**  
  *"Mahasiswa teknik sering macet di satu modul spesifik dan terhenti sebelum belajar kelompok sempat dimulai, atau langsung bergantung pada jawaban instan AI. SyncPod mempertemukan 3 sampai 4 mahasiswa di modul yang sama dalam satu sprint 25 menit."*
- **Yang Tidak Boleh Diklaim:** Jangan menyebut login ini sudah memverifikasi OAuth Google/email kampus ITATS ke database (Auth.js aktif di Build Period).

---

### Shot 2 — Matchmaking & Radar (`25 detik`: `00:10 – 00:35`)
- **Layar:** Matchmaking (`/pod`)
- **URL:** `/pod` *(opsional untuk adegan cadangan bertiga: `/pod?scenario=fallback`)*
- **Klik Persis:**
  1. Di pemilih modul silabus 3 tingkat, pilih daun **`Struktur Data › Graf › Traversal Graf dan Dijkstra`** (atau ketik `"Dijkstra"` di kolom cari).
  2. Biarkan urgensi **`Persiapan kuis`** dan jendela waktu **`Sekarang (25 mnt)`**.
  3. Klik **"Cari pod"**, perlihatkan radar `PodRing` terisi deterministik `1/4 -> 2/4 -> 3/4 -> 4/4` (anggota lain berlabel **`Simulasi`**) hingga muncul status pod ditemukan dan berpindah ke cockpit.
- **Narasi Singkat:**  
  *"Cukup pilih modul daun yang membuat buntu, tingkat urgensi, dan ketersediaan hari ini. Radar PodRing mengisi empat kursi rekan belajar secara otomatis—dan jika baru ada tiga orang setelah masa tunggu, sistem menawarkan opsi mulai bertiga."*
- **Yang Tidak Boleh Diklaim:** Jangan mengklaim tiga anggota lain (`Simulasi`) adalah pengguna asli yang sedang online bersamaan di server produksi.

---

### Shot 3 — Sprint Serempak & Catatan Bersama (`30 detik`: `00:35 – 01:05`)
- **Layar:** Sprint Cockpit (`/pod/pod-042?demo=1`)
- **URL:** `/pod/pod-042?demo=1` *(atau melanjutkan dari `/pod` lalu tambah `?demo=1`)*
- **Klik Persis:**
  1. Jika pod terbuka di `LOBBY`, leader menekan **"Mulai sprint"**; perlihatkan `PodRing` yang sama berubah menjadi timer fokus serta daftar kehadiran anggota (`Fokus`, `Mencatat`, `Bertanya ke pemandu`, label **`Simulasi`**).
  2. Klik editor Markdown di panel kiri, ketik satu baris catatan misalnya `- Cek kasus bobot negatif`, lalu klik tab **Pratinjau** (tunjukkan hasil render bersih).
  3. Buka panel **"Kontrol demo (simulasi)"**, uji cepat **"Jeda"** / **"Lanjut"** atau **"Loncat ke 60 detik terakhir"** (arc menyala amber/menegaskan fase akhir).
- **Narasi Singkat:**  
  *"PodRing yang sama berubah dari radar menjadi timer sprint serempak. Semua anggota berbagi catatan Markdown ter-sanitasi, melihat status kehadiran rekan tanpa obrolan bising, dan tetap menjaga sinkronisasi timer."*
- **Yang Tidak Boleh Diklaim:** Jangan mengklaim penyuntingan multi-perangkat Yjs atau sinkronisasi WebSocket antar-browser sudah berjalan di prototipe ini.

---

### Shot 4 — Antrean Pertanyaan & Pemandu Sokratik (`30 detik`: `01:05 – 01:35`)
- **Layar:** Panel Antrean & Pemandu (`Cockpit`)
- **URL:** `/pod/pod-042?demo=1`
- **Klik Persis:**
  1. Di panel **Antrean pertanyaan**, masukkan 1 pertanyaan (mis. `"Mengapa Dijkstra gagal pada bobot negatif?"`) dan klik **"Tambah pertanyaan"** (tunjukkan aturan maksimal 1 pertanyaan per anggota).
  2. Pilih pertanyaan di antrean, buka panel **Pemandu**, lalu klik **"Tanya pemandu"**.
  3. Perlihatkan status hadir berubah sementara menjadi **`Bertanya ke pemandu`**, lalu tampil **konsep kunci**, **tepat 3 pertanyaan pemandu**, **1 analogi konseptual**, dan rujukan dokumentasi tanpa blok kode solusi.
- **Narasi Singkat:**  
  *"Setiap anggota hanya menaruh satu pertanyaan kunci agar sesi tetap fokus. Pemandu Sokratik membaca konteks modul dan catatan, lalu menjawab dengan tiga pertanyaan pemandu dan satu analogi—tanpa membocorkan kode solusi."*
- **Yang Tidak Boleh Diklaim:** Jangan mengklaim jawaban AI di video ini berasal dari panggilan live API Gemini (prototipe memakai keluaran deterministik; integrasi `@google/genai` + guardrail aktif di server realtime pada Build Period).

---

### Shot 5 — Ringkasan Sesi & Penutup (`25 detik`: `01:35 – 02:00`)
- **Layar:** Ringkasan Pascasprint
- **URL:** `/pod/pod-042/selesai`
- **Klik Persis:**
  1. Dari **"Kontrol demo (simulasi)"**, klik **"Akhiri sprint"** (atau akhiri lewat kontrol leader) untuk diarahkan ke `/pod/pod-042/selesai`.
  2. Tampilkan ringkasan jalur modul, tanggal WIB, durasi fokus per anggota (dengan label **`Simulasi`**), daftar pertanyaan beserta disclosure petunjuk pemandu, dan catatan akhir.
  3. Klik **"Unduh ringkasan"** untuk mengunduh berkas `.md` laporan sesi.
- **Narasi Singkat:**  
  *"Setelah sprint berakhir, seluruh durasi fokus, pertanyaan, petunjuk pemandu, dan catatan dirangkum menjadi berkas Markdown siap pakai. Ini adalah prototipe antarmuka penuh SyncPod dengan data simulasi; seluruh backend Socket.IO, PostgreSQL, Yjs, dan Gemini diselesaikan di Build Period."*
- **Yang Tidak Boleh Diklaim:** Jangan mengklaim statistik endorsement tersimpan permanen di PostgreSQL atau ada angka pengguna aktif nyata.
