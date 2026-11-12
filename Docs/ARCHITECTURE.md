# Arsitektur Teknis SyncPod

Dokumen ini merangkum arsitektur sistem, batas dependensi monorepo, alur pencocokan (*matchmaking*), siklus sprint pod, dan batas keamanan yang bersumber dari [`DESIGN.md`](DESIGN.md), [`PRD.md`](PRD.md), dan [`DECISIONS.md`](DECISIONS.md).

---

## 1. Batas Paket & Pemisahan Transport (`D18`, `D19`)

SyncPod memisahkan **Next.js App Router (`apps/web`)** dari **Server Realtime stateful (`apps/realtime`)** karena koneksi WebSocket/Socket.IO berumur panjang dan state timer/Yjs di memori tidak cocok berjalan di lingkungan serverless.

```mermaid
flowchart TB
  subgraph Web["apps/web (Next.js App Router)"]
    UI["Komponen UI: Masuk, Matchmaking, Cockpit, Ringkasan"]
    Contract["Interface RealtimeClient (1:1 DESIGN B5)"]
    Fake["FakeRealtimeClient (mode fake / prototipe)"]
    Socket["Socket.IO Client (mode real / Build Period)"]
  end

  subgraph Shared["packages/shared (Pure TypeScript + Zod)"]
    Schemas["Event Schemas, ErrorCode & PodSnapshot"]
    Fixtures["Syllabus 3-Tingkat & buildSessionSummaryMarkdown"]
  end

  subgraph Realtime["apps/realtime (Node.js + Socket.IO + Helmet)"]
    Engine["Matcher + Server Timer (phaseEndsAt) + Presence"]
    YjsRoom["Yjs WebSocket Room (/yjs/:podId)"]
    Socratic["Gemini Socratic Engine + Guardrail Filter"]
  end

  subgraph DB["packages/db (Prisma 6.19.3 + PostgreSQL)"]
    Schema["User, Course, Module, MatchRequest, SprintPod, Question, Endorsement"]
  end

  UI --> Contract
  Contract --> Fake
  Contract --> Socket
  Web --> Shared
  Realtime --> Shared
  Socket -->|"WS + JWT HS256 (5 mnt)"| Engine
  UI -->|"Yjs Sync + JWT"| YjsRoom
  Web --> DB
  Realtime --> DB
```

- **`apps/*` -> `packages/*`:** `packages/shared` tidak mengimpor `@prisma/client` maupun API browser sehingga aman dipakai oleh klien, server, dan unit test.
- **Mode Prototipe (`fake`) vs Produksi (`real`):** Antarmuka `RealtimeClient` menjaga seluruh komponen UI terpisah dari detail transport sehingga perpindahan ke Socket.IO tidak mengubah struktur layar.

---

## 2. Alur Autentikasi & Keamanan (`NFR-4`, `DESIGN B4 & B10`)

```mermaid
sequenceDiagram
  actor U as Mahasiswa (Browser)
  participant W as apps/web (Auth.js)
  participant R as apps/realtime (Socket.IO)
  participant G as Google Gemini API

  U->>W: Masuk (Google OAuth / Demo Mode jika DEMO_MODE=true)
  W-->>U: Sesi JWT di cookie HttpOnly + SameSite=Lax
  U->>W: GET /api/realtime/token
  W-->>U: JWT HS256 pendek (exp 5 mnt, sub = userId)
  U->>R: Socket.IO handshake (auth.token)
  Note over R: Server mengekstrak userId dari JWT terverifikasi.<br/>Payload event klien tidak pernah membawa userId pelaku.
  U->>R: socratic:ask { podId, questionId }
  R->>R: Cek keanggotaan + rate limit (1/10 dtk user, 20/pod) + baca catatan server
  R->>G: System instruction Sokratik + responseSchema JSON (maks 8.000 char)
  G-->>R: SocraticHint JSON
  R->>R: Filter pascarespons (tolak blok kode & pola terlarang)
  R-->>U: socratic:result { questionId, hint }
```

**Invarian Keamanan Wajib:**
- Kunci rahasia (`GEMINI_API_KEY`, `REALTIME_JWT_SECRET`, `AUTH_SECRET`) hanya hidup di environment server — nol variabel `NEXT_PUBLIC_*` berisi rahasia.
- Konten `<session_notes>` dan `<question>` diperlakukan sebagai data tidak tepercaya (*untrusted student data*) dan dibatasi 8.000 karakter terakhir (`FR-4.3`).
- Pratinjau Markdown di browser disanitasi dengan `react-markdown` + `rehype-sanitize` (`FR-3.2`).

---

## 3. Alur Matchmaking & Fallback Bertiga (`FR-2.1` – `FR-2.4`, `D6`, `D7`)

```mermaid
flowchart LR
  Idle["Form Matchmaking\n(Modul daun + Urgensi + Jendela >= 25 mnt WIB)"] -->|Submit valid| Searching["Radar Mencocokkan\n(1/4 -> 2/4 -> 3/4)"]
  Searching -->|4/4 kompatibel| Found["match:found\n(Pod 4 anggota -> LOBBY)"]
  Searching -->|"Sisa 3/4 setelah masa tunggu"| Offer["match:fallback-offer\n(Tawaran bertiga, TTL 60 dtk)"]
  Offer -->|Ketiganya terima| Found3["match:found\n(Pod 3 anggota -> LOBBY)"]
  Offer -->|Tolak / Tunggu lebih lama / Timeout| Reset["Reset timer grace pribadi,\ntetap di Radar"]
  Searching -->|Klik Batal| Cancelled["match:cancel -> Kembali ke Form\n(pilihan tetap tersimpan)"]
```

---

## 4. Siklus Hidup Sprint Pod & Sinkronisasi Timer (`DESIGN B6`)

Server **tidak** menyiarkan detak detik setiap detik (`timer:tick`), melainkan menyimpan **`phaseEndsAt`** (UTC epoch ms) dan **`pausedRemainingMs`**. Klien menyelaraskan jam lokal melalui 5 kali `time:ping` (memilih RTT terkecil) lalu menghitung mundur secara lokal setiap 250 ms (`NFR` akurasi selisih ≤ 1 detik).

```mermaid
stateDiagram-v2
  [*] --> LOBBY: match:found (3 atau 4 anggota)
  LOBBY --> FOCUS: pod:start (Leader)
  FOCUS --> FOCUS: PAUSE / RESUME (simpan pausedRemainingMs)
  FOCUS --> BREAK: phaseEndsAt habis / SKIP (Leader)
  BREAK --> FOCUS: phaseEndsAt habis & round < MAX_ROUNDS (round + 1)
  BREAK --> COMPLETED: phaseEndsAt habis & round == MAX_ROUNDS
  LOBBY --> COMPLETED: END (Leader)
  FOCUS --> COMPLETED: END (Leader)
  BREAK --> COMPLETED: END (Leader)
  COMPLETED --> [*]: Simpan notesSnapshot & buka /pod/[podId]/selesai
```

---

## 5. Ringkasan Design System (`DESIGN.md` Part A)

- **Satu elemen utama (`PodRing`):** Cincin SVG 4 kursi (posisi pukul 12, 3, 6, 9) berubah peran secara konsisten dari **Radar pencarian** di `/pod` menjadi **Timer & bar kehadiran** di `/pod/[podId]`.
- **Palet Gelap Semantik (Kontras AA terverifikasi):**
  - Permukaan: `--bg-canvas` (`#090D16`), `--bg-surface` (`#0F172A`), `--bg-surface-elevated` (`#1E293B`)
  - Semantik: `--color-primary` (Fokus/Aksi), `--color-amber` (Istirahat/Peringatan), `--color-emerald` (Hadir/Selesai), `--color-purple` + `--color-purple-text` (Khusus konten AI Pemandu), `--color-danger` (Galat)
- **Tipografi Self-Hosted (`@fontsource-variable/*`):** `Bricolage Grotesque` (heading), `Plus Jakarta Sans` (body 15px), `JetBrains Mono` dengan `tabular-nums` (timer, statistik, editor CodeMirror).

