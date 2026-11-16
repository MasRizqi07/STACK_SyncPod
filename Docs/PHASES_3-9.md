# SyncPod: Rancangan Phase 3 sampai 9 (Build Period)

**Tanggal:** 16 Nov 2026
**Simpan sebagai:** `Docs/PHASES_3-9.md`
**Precedence:** `Docs/DECISIONS.md` > `Docs/DESIGN.md` > `Docs/PRD.md` > file ini. Kalau file ini bentrok dengan tiga file itu, file ini yang kalah. Agent wajib melaporkan bentrokannya, bukan diam-diam memilih.

Aturan baca untuk agent: baca DECISIONS, DESIGN, PRD, lalu file ini. Kerjakan **hanya** fase yang sedang di-approve.

---

## 0. Closeout Phase 2C (syarat sebelum merge)

Hasil review F1 sampai F7 di `phase/2c-polish` (commit `82890ef` sampai `0a0abf6`):

| Item | Status | Catatan |
|---|---|---|
| F1 G3 contract test | OK | File dipulihkan tanpa diubah (diff kosong). `FakeWorldStore` dibuat baru (94 baris). Tapi `fake-client.ts` ikut berubah +361 baris, jadi review diff itu sebelum merge. |
| F2 banner saat matched | OK | |
| F3 rail kiri 1280x800 | Perlu cek mata | Klaim "4 anggota terlihat tanpa scroll" harus dilihat di `cockpit-normal-1280.png` yang baru. |
| F4 focus trap | OK | Kode nyata + 6 test. |
| F5 skrip bukti | Sebagian | Skrip sudah di-commit dan ada cek overflow. Tapi `measure-contrast.mjs` **meng-hardcode hex**, bukan membaca `tokens.css`, jadi kalau token berubah log tetap hijau. |
| F6 log bersih | **Regresi** | `typecheck/lint/test/build.log` sekarang hanya `apps/web`. Paket `db`, `shared`, `realtime` hilang dari bukti. Gate wajib `pnpm -r`. |
| F7 higiene | OK | |

**Commit C0 (wajib, 15 menit, di branch yang sama sebelum merge):**

```text
C0.a Re-run pnpm -r typecheck, lint, test, build from repo root (workspace-wide, not --filter). UTF-8, NO_COLOR=1, verbatim into proof/phase-2c/. Expected tests: db 2 + shared 8 + realtime 2 + web 37 = 49.
C0.b scripts/measure-contrast.mjs must parse apps/web/src/styles/tokens.css instead of hardcoding hex. Fail with exit 1 if a token is missing.
C0.c Lighthouse log lines that say "verified" for dynamic states must be backed by saved JSON or axe output files. Otherwise change the line to UNVERIFIED.
C0.d Add .github/workflows/ci.yml: Node from .nvmrc, pnpm from packageManager, Postgres 16 service, run pnpm -r typecheck, lint, test, build. No CI workflow exists in the repo today, but D28 requires CI green.
C0.e View proof/phase-2c/cockpit-normal-1280.png and confirm all 4 member rows are visible without scrolling the left rail.
```

Setelah C0 hijau, kamu merge `phase/2c-polish` ke `main` (D28: hanya user yang merge).

---

## 1. Aturan global (GLOBAL RULES)

Tempel blok ini di awal prompt setiap fase.

```text
GLOBAL RULES (apply to every phase)
1. Precedence: DECISIONS.md > DESIGN.md > PRD.md > PHASES_3-9.md. Disagree? State it with evidence in the report and wait. Never deviate silently.
2. One branch per phase: phase/<n>-<name>. No direct commits to main, no force push, no --no-verify. One commit per task.
3. Evidence gate. Every check is run from the repo root, workspace-wide (pnpm -r, never --filter for the gate), with NO_COLOR=1, written as UTF-8 to proof/phase-<n>/<check>.log, and pasted VERBATIM in the report. No retyping, no "..." elisions. A missing item is marked UNVERIFIED, never "done".
4. Verification scripts (anything that produces a screenshot, a measurement, or a log) are committed under scripts/. A proof nobody can re-run is not proof.
5. Never delete, skip, or weaken a test to get green. Gate: grep -rnE "\.(skip|only)\(|xit\(|xdescribe\(" must return nothing. If a test fails, show the raw failure and fix the cause.
6. Dependencies: exact versions (no ^ or ~). Each new dependency needs a LADDER entry: what it replaces, why native/existing code cannot do it, and the rung. No UI dependency changes in these phases. No dependency upgrades unless a gate fails and the upgrade is the fix.
7. Secrets: nothing secret in NEXT_PUBLIC_*. Tokens, notes content, and API keys never appear in logs.
8. Windows and spaces in paths (D16): every script works in PowerShell and Linux, quotes paths.
9. Honesty: UI and demo copy must never claim something the code does not do (D32). If a phase changes what is real, update DEMO_SCRIPT.md "Yang Tidak Boleh Diklaim" in the same phase.
10. Report format: Evidence table (check, file, result), raw logs, git diff --stat, LADDER CHECK, TEACH-BACK (three examiner questions without answers, one analogy, one "what is fragile"), then STOP and wait for "APPROVED PHASE <n>".
```

---

## 2. Koreksi: jangan pakai "Master Production Prompt" yang lama

Dokumen "Bagian B" dari sesi sebelumnya ditulis tanpa membaca `DESIGN.md` dan `DECISIONS.md`. Banyak hal di dalamnya bertentangan.

| Master prompt lama | Yang benar (sumber) |
|---|---|
| Model `Pod`, `MatchQueueEntry`, `PodQuestion`, `SocraticResponse`, `PodSummary`, `PeerEndorsement` | `SprintPod`, `MatchRequest`, `Question` (dengan `aiHint` Json), `Endorsement`, tanpa `PodSummary` (DESIGN B3, D2) |
| Event `queue:join`, `timer:pause`, `presence:update`, `clock:sync` | `match:enqueue`, `timer:control {PAUSE\|RESUME\|SKIP\|END}`, `presence:set`, `time:ping` (DESIGN B5) |
| `socket.data.userId` bebas, payload membawa `userId` | `userId` hanya dari klaim token. Payload tidak pernah memuat `userId` pelaku (B4.5) |
| Kirim hanya `{courseTopic, question}` ke Gemini, catatan tidak dikirim | PRD dan B9: catatan (≤ 8.000 karakter terakhir) **dikirim**. `copy.ts` sudah bilang itu. Jangan ubah copy jadi bohong |
| Fallback Gemini disimpan agar bisa dipakai ulang | D12: fallback **tidak** disimpan di `Question.aiHint` |
| `y-indexeddb` untuk persistensi lokal | Tidak ada di PRD. B12 hanya minta "offline 20 detik lalu merge", cukup dengan Y.Doc di memori klien. Tangga: tidak perlu |
| Seed berisi email asli anggota tim (`@mhs.itats.ac.id`) | Jangan commit email atau NPM asli. Akun demo fiktif: `demo-1..4@demo.syncpod.local`. Bot: `simulasi-1..3@bot.syncpod.local` (D8, D10) |
| Fase 8 memuat `/profil`, Judge HUD, Ctrl+K | Di luar scope. `/profil` ditunda (D13). HUD dan palet perintah tidak ada di PRD |
| Phase 8 = E2E, Phase 9 tidak ada | PRD §9: Phase 8 = ringkasan + endorsement, Phase 9 = hardening |

---

## 3. PHASE 3: Database, Auth, Token Realtime, Seed

**Target tanggal (PRD):** 7 Des. Boleh mulai 1 Des setelah paket semifinal dikumpulkan.
**Branch:** `phase/3-db-auth`
**Prasyarat:** C0 selesai, `phase/2c-polish` sudah di-merge.

### Tujuan
Satu sumber identitas yang bisa dipercaya: DB nyata, login nyata, token pendek untuk realtime, dan fungsi otorisasi yang sudah teruji sebelum Phase 4 menyentuh socket.

### Scope

| # | Tugas | Detail |
|---|---|---|
| 3.1 | Migrasi | `prisma migrate dev --create-only` dari B3 apa adanya. Edit SQL migrasi untuk menambah `CREATE UNIQUE INDEX one_waiting_per_user ON "MatchRequest"("userId") WHERE status = 'WAITING';`. Script `db:migrate`, `db:seed`, `db:reset`. Postgres lewat `docker-compose.yml` yang sudah ada. DB terpisah `syncpod_test` untuk test. |
| 3.2 | Klien DB | `packages/db` mengekspor singleton `db` aman terhadap hot-reload. Ganti `readDatabaseConfig` placeholder. |
| 3.3 | Seed idempoten | `Course` dan `Module` dari `packages/shared/src/fixtures/syllabus.ts` (sumber tunggal, D26). 4 akun demo fiktif + 3 bot (D8). Menjalankan seed dua kali tidak mengubah jumlah baris. |
| 3.4 | Auth.js | `next-auth@5.0.0-beta.32` (D17). Provider Google (+ `ALLOWED_EMAIL_DOMAINS`). Provider credentials **hanya didaftarkan jika** `DEMO_MODE === 'true'`. Sesi JWT di cookie HttpOnly, SameSite=Lax. Upsert `User` saat login pertama. |
| 3.5 | Login demo | `POST /api/demo/login` (D10): 403 jika `DEMO_MODE !== 'true'`; hanya akun demo yang di-seed; email bot dan email sembarang ditolak. |
| 3.6 | Proteksi rute | Mode `real`: `/pod`, `/pod/[podId]`, `/pod/[podId]/selesai` tanpa sesi → redirect ke `/masuk`. Mode `fake` (D18): tidak ada auth, tidak ada Prisma, nol network call. Pakai konvensi proteksi rute yang berlaku di Next 16.4.6 terpasang (cek dokumentasinya, jangan mengandalkan ingatan soal `middleware` vs `proxy`). |
| 3.7 | Token realtime | `GET /api/realtime/token`: tanpa sesi → 401. Dengan sesi → JWT HS256 (`jose`), `sub = userId`, `exp` 5 menit, `REALTIME_JWT_SECRET`. Fungsi `signRealtimeToken` (web, server-only) dan `verifyRealtimeToken` (dipakai realtime di Phase 4) dalam satu modul server-only di `packages/shared` yang **tidak** ikut ke bundle klien. Token tidak pernah masuk log. |
| 3.8 | Otorisasi | Helper di `packages/db`: `assertPodMember(userId, podId)` melempar `NOT_A_MEMBER`, `assertPodLeader(userId, podId)` melempar `FORBIDDEN`, pod tak ada → `POD_NOT_FOUND`. Dipakai Phase 4 sampai 8. |
| 3.9 | Validasi env | Satu `env.ts` zod per app (web, realtime), gagal cepat saat boot. `DEMO_MODE=true` dengan `NODE_ENV=production` ditolak kecuali flag eksplisit `ALLOW_DEMO_IN_PROD=true` (untuk laptop venue). |
| 3.10 | Higiene rahasia | Skrip yang melarang `NEXT_PUBLIC_*` bernilai rahasia. `.env` tidak ter-track. |

### Prompt untuk Antigravity

```text
[paste GLOBAL RULES]

TASK: PHASE 3 (Database, Auth, Realtime token, Seed). Branch phase/3-db-auth. Read DECISIONS D2, D6, D8, D9, D10, D17, D18, D26, DESIGN B3, B4, B10, B11, B12 first.

Scope = PHASES_3-9.md section 3 tasks 3.1-3.10, one commit per task, in order. Do not touch realtime server logic (Phase 4), matcher (Phase 5), Yjs (Phase 6), Gemini (Phase 7), or UI visuals. Only UI change allowed: wire the /masuk buttons to real auth in real mode; fake mode behavior and the "Prototipe: data simulasi" marker stay exactly as they are.

Allowed new dependencies: next-auth@5.0.0-beta.32 (locked), jose, tsx (seed runner, devDependency). Everything else needs a LADDER entry first.

Rules specific to this phase:
- Schema = DESIGN B3 verbatim, plus only the raw SQL partial unique index.
- D17: before building anything on top of Auth.js, prove login in a real browser (demo flow always; Google flow if credentials exist, otherwise mark UNVERIFIED) with screenshots. If it breaks with Next 16, report raw output and stop.
- Real mode must have no bypass. Fake mode must not import next-auth or @prisma/client (prove with a bundle grep).
- Seed must not contain real student emails or NPM.
- Tests that need Postgres use syncpod_test and a vitest globalSetup that migrates and truncates. CI runs them against the Postgres service.

Stop after the report. Wait for APPROVED PHASE 3.
```

### Gate Phase 3 (`proof/phase-3/`)

| Bukti | File | Lulus jika |
|---|---|---|
| Gate standar workspace-wide | `typecheck.log`, `lint.log`, `test.log`, `build.log` | Semua exit 0, semua paket muncul |
| Tidak ada test dilewati | `no-skip.log` | grep `.skip/.only/xit` kosong |
| Migrasi bersih | `migrate.log` | `migrate deploy` dari DB kosong exit 0 |
| Indeks parsial | `partial-index.log` | Insert `MatchRequest` WAITING kedua untuk user sama **gagal** dengan unique violation, insert `CANCELLED` kedua berhasil |
| Seed idempoten | `seed.log`, `seed-idempotent.log` | Jalan dua kali, jumlah baris `Course/Module/User` sama |
| Matriks auth (curl) | `auth-matrix.log` | `GET /api/realtime/token` tanpa cookie = 401. Dengan cookie = 200 dan JWT `exp - iat = 300`. `POST /api/demo/login` saat `DEMO_MODE=false` = 403. Email bot = ditolak. Email sembarang = ditolak. Akun demo valid = 200 |
| Token | `token.log` | Round-trip sign/verify lulus. Token kedaluwarsa ditolak. Secret salah ditolak. Token yang diubah 1 karakter ditolak |
| Otorisasi | `authz.log` | Anggota lolos, non-anggota `NOT_A_MEMBER`, anggota non-leader pada aksi leader `FORBIDDEN`, pod tak ada `POD_NOT_FOUND` (DB nyata) |
| Redirect real | `redirect-real.log` | `curl -I /pod`, `/pod/x`, `/pod/x/selesai` tanpa sesi = 307 ke `/masuk` |
| Fake tanpa bypass bocor | `fake-bundle.log` | Build `fake`: tidak ada `next-auth`, `@prisma`, `jose` di bundle klien; `/pod` terbuka tanpa jaringan. Build `real`: `DemoControls` tidak ada (D25) |
| Rahasia tidak bocor | `bundle-secrets.log` | Nilai `AUTH_SECRET`, `REALTIME_JWT_SECRET`, `GEMINI_API_KEY` tidak ditemukan di `.next/static` |
| Validasi env | `env-validation.log` | Secret kosong gagal cepat. `DEMO_MODE=true` di production ditolak tanpa `ALLOW_DEMO_IN_PROD` |
| Login nyata di browser | `auth-demo-*.png`, `auth-google-*.png` | Demo = wajib. Google = bukti atau tulis `UNVERIFIED (no credentials)` |
| Offline | `offline.log` | Login demo dan `/pod` berjalan dengan jaringan diblokir, Postgres lokal |
| CI | `ci-run.txt` | Link atau log run CI hijau untuk branch |
| Diff | `git-diff-stat.txt`, `ladder.md`, `teach-back.md` | Ada |

**Cut-line Phase 3:** Google OAuth boleh `UNVERIFIED` kalau kredensial belum ada. Login demo tidak boleh. Itu jaring pengaman Final Day.

---

## 4. PHASE 4: Server Realtime Inti (room, timer, presence, reconnect)

**Target (PRD):** 8 sampai 9 Des. **Branch:** `phase/4-realtime-core`

### Tujuan
`apps/realtime` menjadi satu-satunya sumber kebenaran waktu dan presensi. `RealRealtimeClient` memenuhi antarmuka yang sama dengan `FakeRealtimeClient`.

### Scope
1. **Handshake:** middleware `io.use` memverifikasi `socket.handshake.auth.token` dengan `verifyRealtimeToken`. Gagal = tolak. `socket.data.userId` hanya dari token (B4). Token kedaluwarsa: klien ambil token baru dan sambung ulang.
2. **Zod di semua event** (`packages/shared`), semua event memakai ack `Ack<T>`.
3. **Event:** `time:ping`, `pod:join`, `pod:leave`, `pod:start`, `timer:control`, `presence:set`, dan siaran `pod:state`, `presence:update`. Nama persis seperti DESIGN B5.
4. **State machine timer** sesuai tabel B6, satu tes per baris transisi. Server menyimpan `phaseEndsAt` (epoch ms), bukan hitungan. `pod:state` hanya dikirim saat transisi, join, reconnect.
5. **Leader:** leader awal = request tertua. Terputus > 10 detik → anggota terhubung dengan `joinedAt` tertua jadi leader.
6. **`focusedSec`:** hanya bertambah di server, saat FOCUS tidak dijeda dan anggota terhubung. Disimpan saat transisi dan saat terputus.
7. **D9:** `pod:leave` menyimpan row `PodMember`, status `DISCONNECTED`. Sweeper mengakhiri pod tanpa anggota terhubung selama `POD_IDLE_MINUTES`.
8. **Pemulihan (NFR-2):** server restart, pod non-`COMPLETED` dipulihkan dari DB (`phase`, `round`, `phaseEndsAt`, `pausedRemainingMs`).
9. **`RealRealtimeClient`** di `apps/web`: implementasi antarmuka `RealtimeClient` yang sama (D19), 5 sampel `time:ping`, offset dari sampel RTT terkecil, ukur ulang tiap 60 detik dan setelah reconnect (B6). Dipilih lewat `NEXT_PUBLIC_REALTIME_MODE`.
10. **Keamanan:** `helmet`, CORS allowlist `WEB_ORIGIN`, rate limit dasar (token bucket di memori) sebagai utilitas yang dipakai fase berikutnya. Bekerja di LAN HTTP tanpa HSTS.
11. **Tambahan C1.6 (a) Recovery rule:** on boot, for a FOCUS/BREAK pod whose persisted `phaseEndsAt` is already in the past, advance phases sequentially, computing each next `phaseEndsAt` from the previous one plus its duration, until a future `phaseEndsAt` or `COMPLETED`. Do not credit `focusedSec` for downtime. Test it.
12. **Tambahan C1.6 (b) Per-pod async mutex:** a per-pod async mutex so timer expiry, PAUSE/RESUME/SKIP/END, and `pod:leave` transitions never interleave. Test with concurrent calls.
13. **Tambahan C1.6 (c) Single-instance guard:** `pg_try_advisory_lock` at boot; a second instance must refuse to start and exit non-zero. Test it.

### Prompt

```text
[paste GLOBAL RULES]

TASK: PHASE 4 (Realtime core). Branch phase/4-realtime-core. Prerequisite: PHASE 3 approved and merged. Read DESIGN B4, B5, B6, B10, DECISIONS D5-D9, D19.

Implement section 4 scope items 1-10 of PHASES_3-9.md. Event names, payloads, and ErrorCodes are exactly DESIGN B5; do not invent events. Use assertPodMember/assertPodLeader from Phase 3 in every pod event.

Hard requirements:
- The G3 contract suite (apps/web/test/realtime-contract.ts) must run against BOTH FakeRealtimeClient and RealRealtimeClient (against a real in-process server + Postgres syncpod_test) and pass. Do not edit the contract to make Real pass; if the contract is wrong, state it with evidence and wait.
- Server time is the only time. Clients render remaining = phaseEndsAt - (Date.now() + offset) every 250 ms.
- No payload contains the acting userId.
- New dependencies: only what the ladder justifies (expected: ws is NOT needed yet; socket.io-client as devDependency for tests; jose already added).

Stop after the report. Wait for APPROVED PHASE 4.
```

### Gate Phase 4 (`proof/phase-4/`)

| Bukti | File | Lulus jika |
|---|---|---|
| Gate standar + no-skip | `typecheck/lint/test/build/no-skip.log` | Workspace-wide hijau |
| Handshake | `handshake.log` | Tanpa token, token kedaluwarsa, token ber-secret salah, token dimodifikasi: semua `connect_error` |
| Transisi timer | `timer-transitions.log` | Satu test per baris tabel B6. Pause/resume menjaga sisa waktu |
| Multi-klien | `multi-client.log` | 4 klien socket, `phaseEndsAt` identik di semua, selisih tampilan konvergen < 50 ms dengan jam disimulasikan |
| Akses | `authz-events.log` | Non-anggota `NOT_A_MEMBER`, non-leader `timer:control` = `FORBIDDEN`, payload invalid = `VALIDATION_FAILED` |
| Leader failover | `leader-failover.log` | Leader putus > 10 detik, leader baru semua klien menerima `pod:state` |
| Reconnect | `reconnect.log` | Putus 8 detik lalu sambung kembali, snapshot benar |
| Restart server | `restart-recovery.log` | Server dimatikan lalu dinyalakan, pod FOCUS/BREAK/PAUSED pulih dari DB |
| Idle sweep | `idle-sweep.log` | `POD_IDLE_MINUTES` diperkecil di test, pod ditutup `COMPLETED` |
| `focusedSec` | `focused-sec.log` | Hanya bertambah saat FOCUS, tidak dijeda, terhubung |
| Kontrak G3 | `contract-fake.log`, `contract-real.log` | Keduanya lulus tanpa perubahan pada file kontrak (`git diff` kosong) |
| Offset jam | `clock-offset.log` | Fungsi offset teruji dengan sampel simulasi |
| Baseline latensi | `latency-baseline.log` | RTT event p50/p95 dari 1 pod × 4 klien (angka mentah; target resmi di Phase 9) |
| Browser nyata | `realtime-2tabs-*.png` | Dua tab browser, timer sinkron |

**Cut-line Phase 4:** tidak ada. Ini jantung produk. Kalau meleset, geser Phase 5 sampai 8, bukan potong Phase 4.

---

## 5. PHASE 5: Matchmaking Nyata

**Target (PRD):** 10 Des. **Branch:** `phase/5-matchmaking`

### Scope
1. **`assemblePods(requests, now)` fungsi murni** di `packages/shared` persis kontrak B7: kelayakan (`windowStart ≤ t`, `windowEnd ≥ t + 25m`), kelompok per `moduleId`, urut `createdAt`, prioritas urgensi sama lalu urutan tiba, tawaran bertiga setelah ≥ 5 menit `graceStartedAt`.
2. **`match:enqueue`** divalidasi zod + aturan D6: modul harus `isLeaf`, jendela ≥ 25 menit, `windowEnd > now`, tidak melewati 23:59 WIB, `windowStart` dijepit ke `now`. Zona waktu `APP_TIMEZONE`, simpan UTC.
3. **Anti ganda:** indeks parsial dari Phase 3 + `ALREADY_MATCHING`. Anggota pod non-`COMPLETED` → `ALREADY_IN_POD` (D9).
4. **Pembentukan pod transaksional:** request → `MATCHED`, `SprintPod` dan `PodMember` dibuat dalam **satu transaksi**. Leader = request tertua. Dua eksekusi matcher bersamaan tidak boleh membuat pod ganda (advisory lock `pg_advisory_xact_lock` atau `FOR UPDATE SKIP LOCKED`).
5. **Matcher berjalan** saat `match:enqueue` dan tiap 5 detik. Siaran `match:update {waitingCount, seats}` dan `match:found {podId}`.
6. **Tawaran bertiga (D7):** state di memori, TTL 60 detik. Semua menerima = pod 3. Ada yang menolak, memperpanjang, atau habis waktu = tawaran batal untuk semua, `graceStartedAt` orang itu di-reset. Request keempat yang kompatibel datang saat tawaran terbuka = batalkan tawaran, bentuk pod 4.
7. **Bot (D8):** tombol "Isi dengan bot" hanya jalan jika `DEMO_MODE=true`, selain itu ditolak. Bot tidak bisa login.
8. `RealRealtimeClient.matchEnqueue/Cancel/FallbackReply` memakai kontrak yang sama.

### Prompt

```text
[paste GLOBAL RULES]

TASK: PHASE 5 (Matchmaking). Branch phase/5-matchmaking. Prerequisite: PHASE 4 approved and merged. Read DESIGN B7, DECISIONS D6, D7, D8, D9.

Implement section 5 scope items 1-8. assemblePods is a PURE function in packages/shared with no I/O and no Date.now() (now is a parameter). Write its tests first (B12 list: 4 compatible = 1 pod, 5 = pod of 4 + 1 left, different modules = no pod, window under 25 min = not eligible, 3-person offer after 5 min).

Hard requirements:
- Pod creation, request status updates, and PodMember rows happen in ONE transaction. Prove with a concurrency test, not a claim.
- Reuse the G3 contract suite for matching behavior against Real client; extend it only by adding cases, never by editing existing ones.
- DEMO_MODE=false must make the bot button/endpoint refuse.

Stop after the report. Wait for APPROVED PHASE 5.
```

### Gate Phase 5 (`proof/phase-5/`)

| Bukti | File | Lulus jika |
|---|---|---|
| Gate standar + no-skip | seperti biasa | Hijau |
| Matcher murni | `matcher-unit.log` | Semua kasus B7/B12 lulus, nol I/O |
| Enqueue D6 | `enqueue-validation.log` | Modul non-leaf, jendela < 25 menit, `windowEnd ≤ now`, lewat 23:59 WIB: `VALIDATION_FAILED`. Jendela mulai di masa lalu dijepit |
| Konkurensi | `matchmaking-concurrency.log` | 8 request modul sama (DB nyata): tepat 2 pod × 4, nol keanggotaan ganda. Diulang 20 kali dengan dua matcher berjalan bersamaan |
| Atomik | `atomicity.log` | Kegagalan di tengah transaksi (disimulasikan): tidak ada request `MATCHED` tanpa `PodMember` |
| Anti ganda | `already-states.log` | `ALREADY_MATCHING`, `ALREADY_IN_POD` dan payload aksi "Kembali ke pod" |
| Tawaran bertiga | `fallback-offer.log` | Semua terima = pod 3. Satu menolak = batal untuk semua. Habis 60 detik = batal. Request keempat saat tawaran terbuka = pod 4 |
| Bot | `bot-gating.log` | `DEMO_MODE=true`: bot bisa mengisi kursi dan berlabel `isSimulated`. `DEMO_MODE=false`: ditolak |
| Browser | `matchmaking-real-*.png` | Dua browser: radar 1/4 sampai 4/4 dan masuk cockpit yang sama |

**Cut-line Phase 5:** tawaran bertiga (D7) boleh jadi fase 5b jika waktu habis. Pod 4 normal tidak boleh dipotong.

---

## 6. PHASE 6: Catatan Bersama (Yjs)

**Target (PRD):** 11 sampai 12 Des. **Branch:** `phase/6-yjs`

### Scope
1. **Spike dulu (D3):** dua klien + satu server, hasil mentah dilaporkan sebelum fitur apa pun. Pin `yjs@13.6.33`, `y-codemirror.next@0.3.6`, `@y/websocket-server@0.1.1`, pnpm `overrides` memaksa satu versi `yjs`. Kalau `@y/websocket-server@0.1.1` tidak berfungsi, jatuh ke pembungkus tipis `y-protocols@1.0.7` + `ws@8.22.2` dan laporkan.
2. **Endpoint** `/yjs/:podId` pada server HTTP yang sama. Autentikasi token saat upgrade, cek keanggotaan, pod bukan `COMPLETED`. Token tidak masuk log.
3. **Satu `Y.Doc` per pod**, `Y.Text` bernama `notes`. Persist `yjsState` debounce 2 detik. Saat `COMPLETED`: `notesSnapshot = ytext.toString()`. Pulihkan dari `yjsState` setelah restart.
4. **Batas ukuran dokumen** (mis. 200 KB, konfigurabel) agar satu klien tidak bisa menghabiskan memori. Melebihi batas = tolak update dan beri tahu klien.
5. **Klien:** `ScratchpadEditor` di mode `real` memakai `y-codemirror.next`, label kursor jarak jauh (nama + warna semantik), status sinkron. Mode `fake` tetap dokumen lokal. Pratinjau tetap `react-markdown` + `rehype-sanitize`.
6. **Titik keputusan (12 Des, B8):** kalau tes konflik belum lolos, turun ke fallback LWW per dokumen dengan `version` dan peringatan konflik, catat sebagai keterbatasan.

### Prompt

```text
[paste GLOBAL RULES]

TASK: PHASE 6 (Yjs notes). Branch phase/6-yjs. Prerequisite: PHASE 5 approved and merged. Read DESIGN B8, B10, DECISIONS D3.

Step 0 is a SPIKE: two clients and one server with the pinned versions, converge on one string. Paste raw output in the report before building features. If it fails, follow the D3 fallback and report.

Then implement section 6 scope items 2-5. Do not add y-indexeddb or any extra persistence layer (not in PRD; ladder says no). Keep Markdown rendering sanitized: <script>, onerror, javascript: must not execute on synced content.

Decision point: if concurrent-edit convergence does not pass by the end of the phase, implement the B8 LWW fallback and document the limitation instead of shipping flaky CRDT.

Stop after the report. Wait for APPROVED PHASE 6.
```

### Gate Phase 6 (`proof/phase-6/`)

| Bukti | File | Lulus jika |
|---|---|---|
| Gate standar + no-skip | seperti biasa | Hijau |
| Spike | `spike.log` | Dua klien konvergen, versi terpasang tercatat, `pnpm why yjs` menunjukkan satu salinan |
| Konvergensi | `yjs-convergence.log` | Dua klien menyisipkan di posisi yang sama bersamaan: dokumen akhir identik dan tidak ada karakter hilang. Ulang 50 kali dengan urutan acak (seed dicatat) |
| Offline lalu merge | `offline-merge.log` | Satu klien offline 20 detik, edit di kedua sisi, merge tanpa kehilangan |
| Persistensi | `persistence.log` | Debounce 2 detik menulis `yjsState`. Restart server, catatan pulih. `COMPLETED` menulis `notesSnapshot` |
| Akses | `yjs-auth.log` | Upgrade tanpa token, token kedaluwarsa, non-anggota, pod `COMPLETED`: semua ditolak |
| Batas ukuran | `size-limit.log` | Update melewati batas ditolak, server tetap hidup |
| Sanitasi | `sanitize-synced.log` | `<script>`, `onerror`, `javascript:` pada konten tersinkron tidak tereksekusi |
| Browser | `notes-2browsers-*.png` | Dua browser dengan kursor jarak jauh berlabel nama |

**Cut-line Phase 6:** fallback LWW B8 adalah jalan keluar resmi pada 12 Des. Itu bukan kegagalan, selama dicatat sebagai keterbatasan.

---

## 7. PHASE 7: Antrean Pertanyaan dan Pemandu Sokratik (Gemini)

**Target (PRD):** 12 sampai 13 Des. **Branch:** `phase/7-socratic`

### Scope
1. **Antrean:** `queue:add` (1 sampai 280 karakter, **maksimal 1 per anggota per pod seumur pod**, `@@unique([podId, authorId])`, D14), `queue:resolve` (penulis atau leader, tidak membebaskan kuota), siaran `queue:update`. `QUESTION_LIMIT` bila melebihi.
2. **`socratic:ask`:** anggota mana pun di pod itu boleh memicu untuk pertanyaan apa pun di pod itu (D5). Validasi `question.podId === podId`. **Idempoten:** jika `aiHint` ada, kembalikan tanpa memanggil model. **Single-flight:** 4 anggota menekan bersamaan = tepat 1 panggilan model, semua menerima hasil.
3. **Rate limit (B9):** 1 per 10 detik per pengguna, 20 per pod per sprint.
4. **Status:** `ASKING_GEMINI` ditentukan server dan **dilepas di semua jalur**, termasuk galat dan timeout.
5. **Panggilan model:** `@google/genai`, `GEMINI_MODEL` dari env (`gemini-3.8-flash`, D15). **Jangan kirim** `temperature`, `top_p`, `top_k`, `candidate_count`. Kontrol latensi dengan thinking level (mulai `low`). JSON terstruktur, timeout 15 detik. Satu smoke call nyata sebelum membangun apa pun di atasnya; pilih jalur `generateContent` jika masih didukung.
6. **Privasi yang jujur:** payload ke model = modul aktif, **8.000 karakter terakhir catatan**, dan teks pertanyaan, sesuai PRD/B9. Teks `copy.ts` yang sekarang ("Catatan pod dikirim ke Gemini saat kamu bertanya") sudah benar dan tidak boleh diubah menjadi klaim sebaliknya. Tidak ada `currentNotes` di payload event (B5); server mengambil catatan dari state Yjs miliknya.
7. **Guardrail (`guardrail.ts`):** tolak blok berpagar, tolak baris dengan ≥ 2 penanda kode, izinkan kode inline satu backtick ≤ 40 karakter. Ulangi sekali dengan instruksi lebih ketat. Gagal lagi: kembalikan `SocraticHint` cadangan generik **tanpa menyimpannya** ke `aiHint` (D12) dan log `GUARDRAIL_BLOCKED` tanpa isi catatan. Sama untuk timeout dan galat.
8. **System prompt** sebagai konstanta di `apps/realtime/src/socratic/system-prompt.ts` persis B9. `GEMINI_MOCK=true` mengembalikan `SocraticHint` deterministik tanpa jaringan.
9. **Suite adversarial 10/10** di `apps/realtime/test/socratic.adversarial.test.ts` (daftar kasus ada di B9).

### Prompt

```text
[paste GLOBAL RULES]

TASK: PHASE 7 (Question queue + Socratic guide). Branch phase/7-socratic. Prerequisite: PHASE 6 approved and merged. Read DESIGN B5, B9, B10, DECISIONS D5, D12, D14, D15.

Implement section 7 scope items 1-9. The Gemini key lives only in apps/realtime env. Never log note content, tokens, or keys.

Hard requirements:
- Verify the model id gemini-3.8-flash and the structured-JSON path against Google's official docs and ONE real smoke call before building. If no API key is available, say so, build against GEMINI_MOCK, and mark real-model items UNVERIFIED.
- Single-flight and idempotency are proven with a spy on the Gemini client: 4 simultaneous socratic:ask = exactly 1 call; a second ask after success = 0 calls.
- Guardrail fallback, timeout, and error results are never written to Question.aiHint (D12).
- ASKING_GEMINI is released on success, guardrail failure, timeout, and error.
- Do not change the privacy line in copy.ts. If code and copy disagree, fix the code or report the disagreement.

Stop after the report. Wait for APPROVED PHASE 7.
```

### Gate Phase 7 (`proof/phase-7/`)

| Bukti | File | Lulus jika |
|---|---|---|
| Gate standar + no-skip | seperti biasa | Hijau |
| Antrean | `queue.log` | Pertanyaan kedua oleh anggota yang sama = `QUESTION_LIMIT`, termasuk setelah di-resolve. Resolve hanya oleh penulis atau leader (lainnya `FORBIDDEN`) |
| Single-flight | `single-flight.log` | 4 `socratic:ask` bersamaan = spy Gemini dipanggil **1×**, keempat klien menerima hasil sama |
| Idempoten | `idempotent.log` | Ask kedua setelah sukses = 0 panggilan |
| Kepemilikan | `ownership.log` | `questionId` dari pod lain = ditolak. Non-anggota = `NOT_A_MEMBER` |
| Rate limit | `rate-limit.log` | Dua ask dalam 10 detik = `RATE_LIMITED`. Pod melewati 20 = `RATE_LIMITED` |
| Pelepasan status | `asking-release.log` | `ASKING_GEMINI` dilepas pada sukses, guardrail gagal, timeout, galat |
| Tidak disimpan | `no-persist-fallback.log` | Setelah guardrail gagal dua kali, `Question.aiHint` tetap `null`, ask berikutnya memanggil model lagi |
| Skema keluaran | `schema.log` | Tepat 3 `guidingQuestions`, `analogy` ada, `docHint` tanpa URL |
| Adversarial | `adversarial.log` | 10/10 kasus B9 lolos terhadap filter, dan terhadap model nyata jika ada kunci |
| Smoke model | `gemini-smoke.log` | 1 panggilan nyata sukses dengan parameter D15, atau `UNVERIFIED (no key)` |
| Latensi | `socratic-latency.log` | p95 atas ≥ 20 panggilan nyata, target ≤ 8 detik (FR-4.1). Angka mentah. Tanpa kunci = `UNVERIFIED` |
| Privasi | `privacy-payload.log` | Payload ke Gemini = modul + ≤ 8.000 karakter catatan + pertanyaan. Tidak ada email, nama, atau token. Cocok dengan teks `copy.ts` |
| Mock offline | `mock-offline.log` | `GEMINI_MOCK=true` dengan jaringan diblokir mengembalikan hint deterministik |
| Browser | `socratic-real-*.png` | Satu pod, satu pertanyaan, hint tampil di 4 klien |

**Cut-line Phase 7:** model nyata boleh `UNVERIFIED` kalau kunci belum ada, dengan `GEMINI_MOCK` sebagai jalur demo dan klaim demo disesuaikan (D32). Single-flight, idempotensi, dan guardrail tidak boleh dipotong.

---

## 8. PHASE 8: Ringkasan dan Endorsement

**Target (PRD):** 14 Des. **Branch:** `phase/8-summary`

### Scope
1. **Finalisasi sesi:** saat `COMPLETED` (selesai alami atau `END`): `notesSnapshot`, `endedAt`, `focusedSec` tersimpan.
2. **`/pod/[podId]/selesai` data nyata:** durasi fokus per anggota, daftar pertanyaan beserta status dan `aiHint`, catatan akhir. Memakai `buildSessionSummaryMarkdown` yang sudah ada di `packages/shared` (D26), bukan fungsi kedua.
3. **Unduh dan salin `.md`** sesuai FR-5.1 (judul modul, tanggal WIB, durasi fokus per anggota, catatan akhir, pertanyaan + status + petunjuk AI). Tes golden file sudah ada, harus tetap hijau.
4. **`endorse:give {podId, toUserId}`:** hanya anggota, hanya pod `COMPLETED`, tidak boleh ke diri sendiri, tidak boleh ke non-anggota, unik `(podId, fromUserId, toUserId)`. Karma dihitung dari jumlah `Endorsement` diterima, bukan kolom.
5. **Tampilan** tetap mengikuti DESIGN A4 Layar 4 dan A7. Tidak ada skor reputasi karangan. Tidak ada `/profil` (D13).

### Prompt

```text
[paste GLOBAL RULES]

TASK: PHASE 8 (Summary and endorsement). Branch phase/8-summary. Prerequisite: PHASE 7 approved and merged. Read PRD Epic 5, DESIGN A4 Layar 4, B3 Endorsement, DECISIONS D13, D26.

Implement section 8 scope items 1-5. Reuse buildSessionSummaryMarkdown from packages/shared; the golden-file test must stay green and unmodified. No profile page, no reputation numbers beyond a count of received endorsements.

Stop after the report. Wait for APPROVED PHASE 8.
```

### Gate Phase 8 (`proof/phase-8/`)

| Bukti | File | Lulus jika |
|---|---|---|
| Gate standar + no-skip | seperti biasa | Hijau |
| Finalisasi | `finalize.log` | `END` dan selesai alami sama-sama menyimpan `notesSnapshot`, `endedAt`, `focusedSec` |
| Ekspor | `summary-export.log` | `.md` dari pod nyata cocok golden file formatnya. Unduh dan salin berjalan |
| Endorsement | `endorse.log` | Pod belum `COMPLETED` = `INVALID_STATE`. Ke diri sendiri = `VALIDATION_FAILED`. Ke non-anggota = `NOT_A_MEMBER`. Duplikat = idempoten, tanpa baris kedua |
| Karma | `karma.log` | Dihitung dari jumlah `Endorsement` diterima |
| Tanpa data karangan | `no-fabricated.log` | grep layar `/selesai` tidak menemukan angka hardcode di mode `real` |
| Browser | `summary-real-*.png` | 375/768/1280 dengan data pod nyata |
| Lighthouse | `lighthouse-summary.json` | a11y ≥ 90 |

**Cut-line Phase 8:** endorsement boleh dipotong terakhir (P1). Ekspor `.md` tidak.

---

## 9. PHASE 9: Hardening, Uji Beban, Latihan Final Day

**Target (PRD):** 15 Des. **Branch:** `phase/9-hardening`. **16 Des = Final, tidak ada fitur baru.**

### Scope
1. **NFR-1:** skrip beban `socket.io-client` 5 pod × 4 klien, mengukur RTT event, laporan p50 dan p95 (target p95 < 200 ms di LAN).
2. **NFR-2:** putus 8 detik, restart server, pod aktif pulih dari DB.
3. **NFR-3, NFR-5:** tangkapan layar 375/768/1280 untuk semua layar mode `real`, Lighthouse a11y ≥ 90, penelusuran keyboard manual.
4. **NFR-4:** `grep` bundle klien tanpa rahasia. Tes 401/403.
5. **NFR-6:** `pnpm build` dan **demo penuh dengan Wi-Fi dimatikan** (Postgres lokal, `GEMINI_MOCK`, `DEMO_MODE`, font self-host).
6. **Checklist keamanan B10:** satu baris bukti untuk setiap butir.
7. **Playwright:** satu smoke test (P1) dari `/masuk` sampai `/selesai`.
8. **Runbook venue Bandung:** README bagian "Final Day": cara menyalakan Postgres lokal, `db:reset` + seed, `.env` untuk LAN, IP LAN di `WEB_ORIGIN`, Windows dan Linux, 5 menit pemulihan jika crash.
9. **Naskah demo** diperbarui: klaim `real` hanya untuk hal yang terbukti.
10. **Latihan penuh dua kali**, direkam waktunya.
11. **Tambahan C1.6 (a) Forced-colors fallback:** `@media (forced-colors: active)` fallback so PodRing arcs and seat dots stay visible (use `CanvasText`/`Highlight`).
12. **Tambahan C1.6 (b) Inert background:** Make the page background inert while the drawer is open.
13. **Tambahan C1.6 (c) Real a11y audit on dynamic states:** Axe or Lighthouse a11y run on the `matched`, `fallback`, `last60s` states, replacing the custom probe.

### Prompt

```text
[paste GLOBAL RULES]

TASK: PHASE 9 (Hardening). Branch phase/9-hardening. Prerequisite: PHASE 8 approved and merged. Read PRD section 6 and 8, DESIGN B10, B12.

Implement section 9 scope items 1-10. No new features. If a check fails, fix the cause or report it; do not relax the target. Update DEMO_SCRIPT.md so every "real" claim has a proof file path next to it.

Stop after the report. Wait for APPROVED PHASE 9.
```

### Gate Phase 9 (`proof/phase-9/`)

| Bukti | File | Lulus jika |
|---|---|---|
| Gate standar + no-skip | seperti biasa | Hijau |
| NFR-1 | `load-test.log`, `scripts/load-test.mjs` | 5 pod × 4 klien, p50 dan p95 mentah, p95 < 200 ms di LAN |
| NFR-2 | `resilience.log` | Putus 8 detik dan restart server, semua pod pulih |
| NFR-3/5 | `screens-*.png`, `lighthouse-*.json`, `keyboard.md` | 3 lebar, a11y ≥ 90, penelusuran keyboard |
| NFR-4 | `secrets-grep.log`, `auth-codes.log` | Nol rahasia di bundle, 401 dan 403 terbukti |
| NFR-6 | `offline-rehearsal.log` | Demo penuh jaringan mati, dari `/masuk` sampai `.md` terunduh |
| Keamanan B10 | `security-checklist.md` | Setiap butir B10 punya satu baris bukti atau `UNVERIFIED` |
| Playwright | `e2e.log` | Satu perjalanan penuh lulus |
| Fresh clone | `fresh-clone.log` | `git clone`, `pnpm install --frozen-lockfile`, `pnpm -r build` di folder baru dengan spasi di path |
| Runbook | `runbook-dryrun.md` | Orang lain di tim mengikuti runbook dari nol, waktunya dicatat |
| Demo | `demo-rehearsal-1.md`, `demo-rehearsal-2.md` | Dua latihan penuh, waktu dan masalah tercatat |

---

## 10. Jadwal realistis dan cut-line

Kalender dari PRD §9 plus kenyataannya:

| Tanggal | Isi | Catatan |
|---|---|---|
| 16 sampai 27 Nov | C0, merge 2C, survei 20 responden, polesan prototipe | Survei adalah "wajib sebelum 30 Nov" (PRD §1). Tanpa data ini, **tidak boleh ada klaim persentase** di proposal dan di landing. |
| 28 sampai 29 Nov | Video 2 menit + proposal 10 halaman | Ikuti `DEMO_SCRIPT.md` dan D32 |
| **30 Nov** | **Kumpul semifinal** | |
| 1 sampai 6 Des | Buffer. Phase 3 boleh mulai | PRD menjadwalkan Phase 3 pada 7 Des. Mulai lebih awal membeli jeda. |
| 7 Des | Phase 3 | |
| 8 sampai 9 Des | Phase 4 | |
| 10 Des | Phase 5 | |
| 11 sampai 12 Des | Phase 6 | Titik keputusan Yjs vs LWW |
| 12 sampai 13 Des | Phase 7 | |
| 14 Des | Phase 8 | |
| 15 Des | Phase 9 | |
| **16 Des** | **Final** | Beku. Tidak ada fitur baru |

**Urutan potong jika waktu habis (dari yang pertama dipotong):**
1. Google OAuth tetap `UNVERIFIED`, demo login jadi jalur utama.
2. Model Gemini nyata: pakai `GEMINI_MOCK`, ubah klaim demo.
3. Yjs: turun ke fallback LWW (B8).
4. Tawaran bertiga D7 (pecah ke fase 5b).
5. Endorsement (P1).

**Tidak boleh dipotong:** auth tanpa bypass di mode `real`, timer server-authoritative, pod 4 orang, single-flight dan guardrail Gemini, ekspor `.md`, demo offline.

**Hal yang bukan pekerjaan agent tapi menentukan nilai:** survei baseline, video, proposal, pitch deck 15 slide, dan latihan pitch. Bagikan ke anggota tim lain selama agent mengerjakan fase.
