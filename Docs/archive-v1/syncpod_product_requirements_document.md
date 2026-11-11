# Product Requirement Document (PRD)
## Project: SyncPod — Automated Micro-Study Pod & Collaborative Sprint Platform
**Competition:** STACK 2026 by GDGoC ITB  
**Track:** Case 1: Smarter Campus and Learning  
**Team:** Cah Kacawww (Institut Teknologi Adhi Tama Surabaya)  
**Version:** 1.0.0 (Semifinal to Final Prototype)  

---

## 1. Executive Summary & Vision

### 1.1 Vision Statement
SyncPod mentransformasi cara mahasiswa teknik dan komputasi menghadapi materi kuliah sulit dari belajar mandiri yang rentan frustrasi menjadi sesi kolaboratif terstruktur (*sprint pods*) berbasis pencocokan otomatis topik silabus dan sinkronisasi fokus *real-time*.

### 1.2 Core Value Proposition
* **Zero Scheduling Overhead:** Menghilangkan friksi koordinasi jadwal belajar di grup chat konvensional melalui algoritma pencocokan 4-orang instan.
* **Synchronous Flow State:** Menyediakan *sprint room cockpit* dengan timer Pomodoro tersinkronisasi, catatan Markdown bersama, dan antrean tanya-jawab terstruktur.
* **Socratic AI Guidance:** Asisten berbasis Google Gemini API yang memberikan arahan sokratik terstruktur untuk memecah kebuntuan konsep tanpa memberikan jawaban instan (mencegah ketergantungan kognitif).
* **Target Metric:** Memangkas waktu inisiasi belajar kelompok hingga 40% dan menaikkan tingkat penyelesaian tugas mandiri/kelompok hingga 25%.

---

## 2. Target Users & Personas

### Persona A: The Overwhelmed Underclassman (Mahasiswa Tahun 1–2)
* **Demografi:** Mahasiswa Teknik/Informatika semester 1–4.
* **Pain Point:** Kesulitan memahami mata kuliah fundamental (Struktur Data, Aljabar Linear, Arsitektur Komputer). Malu bertanya ke dosen, ragu mengajak teman karena takut merepotkan.
* **Goal:** Menemukan rekan belajar yang memiliki problem serupa pada modul yang sama tanpa canggung.

### Persona B: The Course Mentor / Senior Tutor (Mahasiswa Tahun 3–4)
* **Demografi:** Asisten laboratorium atau mahasiswa berprestasi.
* **Pain Point:** Terlalu banyak pertanyaan berulang di chat personal; tidak memiliki platform terpusat untuk memandu sesi *catch-up* terstruktur.
* **Goal:** Membimbing adik tingkat secara terjadwal dengan reputasi terakreditasi (*Peer Tutor Karma Score*).

---

## 3. Product Scope & Functional Requirements

### Epic 1: Identity & Syllabus Taxonomy
* **FR-1.1 Campus Account Authentication:** Registrasi dan otentikasi cepat via OAuth Google / Email Institusi.
* **FR-1.2 Academic Profile Setup:** Mahasiswa memilih program studi, semester, dan daftar mata kuliah yang sedang diambil semester berjalan.
* **FR-1.3 Syllabus Milestones:** Taksonomi mata kuliah dipecah menjadi modul hierarkis (misal: *Data Structures -> Trees -> AVL & Red-Black Trees*).

### Epic 2: Automated Matchmaking Engine (Pod Formation)
* **FR-2.1 Bottleneck Declaration:** Pengguna memilih 1 modul silabus yang ingin dipelajari dan menandai tingkat urgensi (misal: "Persiapan Kuis", "Tugas Praktikum Macet", "Review Teori").
* **FR-2.2 Availability Slotting:** Pengguna memilih jendela waktu luang hari ini (misal: 15:30 - 17:30 WIB).
* **FR-2.3 Pod Assembler:** Algoritma mengelompokkan 3 hingga 4 pengguna dengan preferensi topik dan jadwal yang kompatibel ke dalam satu *Ephemeral Pod*.
* **FR-2.4 Fallback Grace Period:** Jika dalam 5 menit pod belum penuh 4 orang, sistem otomatis menawarkan opsi: *Start with 3 members* atau *Extend matching window*.

### Epic 3: Synchronized Sprint Cockpit (The Core Workspace)
* **FR-3.1 Unified Sprint Timer:** Timer fokus tersinkronisasi (default 25 menit fokus, 5 menit evaluasi) via WebSockets. Semua anggota melihat detik yang sama persis.
* **FR-3.2 Shared Markdown Scratchpad:** Area pencatatan kolaboratif untuk merangkum solusi bersama atau berbagi cuplikan kode penting secara *real-time*.
* **FR-3.3 Question Queue & Icebreaker:** Setiap anggota dapat menambahkan 1 pertanyaan utama ke antrean sesi agar waktu belajar terarah dan tidak keluar topik.
* **FR-3.4 Member Presence Bar:** Indikator status fokus (*In Focus*, *Taking Notes*, *Asking Gemini*).

### Epic 4: Contextual Socratic Copilot (Gemini API Integration)
* **FR-4.1 Concept Deconstructor:** Ketika anggota mengajukan pertanyaan rumit, asisten AI membedah problem menjadi 3 pertanyaan panduan (*Socratic prompting*).
* **FR-4.2 Anti-Cheating Guardrail:** Asisten dilarang memberikan baris kode jawaban langsung; hanya menyediakan analogi konseptual, verifikasi logika, dan petunjuk dokumentasi resmi.
* **FR-4.3 Context Awareness:** Gemini menerima konteks silabus aktif dan catatan bersama yang ada di scratchpad untuk menghasilkan saran yang relevan.

### Epic 5: Post-Sprint Accountability & Reputation
* **FR-5.1 Session Summary Card:** Di akhir sesi, sistem mengekspor rangkuman catatan dan metrik durasi fokus yang dapat diunduh (*Markdown / PDF*).
* **FR-5.2 Peer Endorsement:** Anggota memberikan *Helpful Peer* upvote kepada rekan satu pod untuk membangun *Community Karma*.

---

## 4. Non-Functional Requirements (NFR)

* **NFR-1 Latency & Real-time Sync:** Latensi sinkronisasi timer dan teks catatan antar pengguna wajib $< 200 \text{ ms}$ pada koneksi 4G standar.
* **NFR-2 Reliability:** State sesi (timer, catatan, status pod) tidak boleh hilang jika terjadi putus koneksi singkat (*auto-reconnect handler* dengan fallback *local state*).
* **NFR-3 Responsiveness:** Desain adaptif penuh (*mobile-friendly web*) untuk akses cepat via smartphone maupun laptop tanpa patah tampilan.
* **NFR-4 Security & Privacy:** Token sesi diamankan via HTTP-only cookies; API keys Google Gemini diamankan secara ketat di backend proxy tanpa bocor ke client-side.

---

## 5. Phased Competition Roadmap (GDGoC ITB STACK 2026)

| Fase | Target Tanggal | Deliverables & Scope |
| :--- | :--- | :--- |
| **Preliminary** | 10 Nov 2026 | Abstrak 418 kata, validasi masalah, arsitektur dasar (*SUBMITTED & APPROVED*). |
| **Semifinal** | 30 Nov 2026 | Proposal 10 halaman, demonstrasi UI video 2 menit, prototype alur matching & mockup cockpit interaktif. |
| **Build Period** | 7–16 Des 2026 | Integrasi Socket.IO real-time timer, backend database NestJS/PostgreSQL, Gemini API backend proxy. |
| **Final Day** | 16 Des 2026 | Sesi koding offline di Bandung: penyempurnaan markdown collision handling, stress-testing room, dan pitch deck 15 slide. |