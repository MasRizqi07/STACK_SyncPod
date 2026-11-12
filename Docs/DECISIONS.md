# DECISIONS: SyncPod (ADR log)

**Date:** 2026-11-11
**Status:** Approved. Resolves every open question and proposed answer in the Phase 0 report.
**Precedence:** For the items listed here, this file overrides `Docs/PRD.md` and `Docs/DESIGN.md`. Everything else in those two files still stands. Save this file as `Docs/DECISIONS.md` (keep the existing `Docs/` casing; do not rename the folder).

If you disagree with a decision, do not silently deviate. State the disagreement with evidence in the Phase 1 report and wait for an answer.

---

## D1. Docs folder and legacy v1.0 files
- Keep `Docs/` as is. Every reference in README and code comments says `Docs/`.
- Move the three v1.0 files in the repo root into `Docs/archive-v1/` (use `git mv` if the repo is under git). Add `Docs/archive-v1/README.md`: "SUPERSEDED by Docs/PRD.md and Docs/DESIGN.md v2.0.0. Do not read or follow."
- Never read the archive again. Do this as the first change of Phase 1, separate from scaffolding.

## D2. Prisma: use 6.19.3, not 7
- Pin `prisma@6.19.3` and `@prisma/client@6.19.3`. Generator stays `prisma-client-js`. `schema.prisma` is `DESIGN.md` B3 verbatim, including `url = env("DATABASE_URL")` in the datasource.
- Reason: Prisma 7 is not just a `url` move. It also requires `provider = "prisma-client"` with a mandatory `output` path, a mandatory driver adapter, ESM across the packages that use it, and manual `.env` loading. None of that was in the Phase 0 estimate. It would break the "schema identical to B3" lock and add moving parts that no acceptance criterion needs. Upgrading is post-hackathon work.
- **Phase 1 gate:** `prisma validate` and `prisma generate` must pass on the full B3 schema under the installed Node. If they fail, report raw output and stop. Switching to Prisma 7 then needs a new written approval.
- The partial unique index stays a raw SQL migration (Phase 3).

## D3. Yjs server packages
- Pin `yjs@13.6.33`, `y-codemirror.next@0.3.6`, `@y/websocket-server@0.1.1` (it must expose `setupWSConnection` and `setPersistence`).
- Add a pnpm `overrides` entry forcing a single `yjs` version across the workspace. Two copies of Yjs cause silent, hard-to-debug failures.
- Install these in Phase 6, not earlier. At the start of Phase 6, run a spike (two clients, one server) before building features. If `@y/websocket-server@0.1.1` does not work, fall back to a thin wrapper over `y-protocols@1.0.7` + `ws@8.22.2`, and report it.

## D4. Toolchain pins
- `typescript@6.0.3` and the `typescript-eslint` version the agent verified. No TypeScript 7 in this repo.
- Use exact versions (no `^`, no `~`) for every dependency. Set `packageManager` (exact pnpm version) and `engines.node` in the root `package.json`. Add `.nvmrc`. Teammates' laptops and the Bandung venue machine must run the same Node.
- No dependency upgrades after Phase 1 unless a gate fails and the upgrade is the fix.

## D5. `socratic:ask` rules
- Any member of the pod may trigger it for any question in that pod. The server verifies the caller is a member and that `question.podId === podId`.
- It is **idempotent**: if the question already has a stored `aiHint`, return it and make no model call. A "regenerate" action is out of scope.
- It is **single-flight**: if a call for the same `questionId` is already running, the second caller waits for the same result instead of starting another call. Four members tapping at once must produce one model call.
- Rate limits from DESIGN B9 still apply per user and per pod.

## D6. Matching windows and time
- Add `APP_TIMEZONE=Asia/Jakarta` to `.env.example`. "Today" means today in that timezone. Store timestamps in UTC.
- `Sekarang (25 mnt)` = `[now, now+25m]`. `1 jam ke depan` = `[now, now+60m]`. `Atur sendiri` = any window with `windowEnd - windowStart >= 25m`, `windowEnd > now`, and `windowEnd` no later than 23:59 today. If `windowStart < now`, clamp it to `now`.
- `match:enqueue` also rejects any module where `isLeaf !== true` (`VALIDATION_FAILED`).

## D7. Fallback offer (three members)
- Keep the open-offer state in memory in `apps/realtime` with a 60-second TTL. Keep the `match:fallback-reply` contract from DESIGN B5 unchanged.
- All three accept → pod of 3. Any decline, any "extend", or timeout → the offer is cancelled for everyone, and the `graceStartedAt` of the person who declined, extended, or timed out is reset to `now`. The others keep their timers.
- A compatible fourth request arriving while an offer is open → cancel the offer and form a pod of 4.

## D8. Simulated members (bots)
- Seed 3 bot users with emails `simulasi-1@bot.syncpod.local` to `simulasi-3@bot.syncpod.local`. `isSimulated` is derived server-side from that email domain. The B3 schema does not change.
- Bots can **never** log in: the credentials provider and demo login must reject bot emails.
- All bot behavior (the "Isi dengan bot" button, auto-accepting, simulated presence) exists only when `DEMO_MODE=true` and is refused otherwise. Bots are always labeled "Simulasi" in the UI.

## D9. `pod:leave`, active pods, idle pods
- `pod:leave` leaves the Socket.IO room, saves `focusedSec`, sets status `DISCONNECTED`, and moves the `LEADER` role if the leader left. The `PodMember` row is kept. The user can rejoin through `/pod/[podId]` until the pod is `COMPLETED`.
- A user who is a member of a pod that is not `COMPLETED` cannot enqueue. Return the new error code `ALREADY_IN_POD`, and the UI offers "Kembali ke pod". Add the code to `ErrorCode` in `packages/shared`.
- If a non-`COMPLETED` pod has zero connected members for `POD_IDLE_MINUTES` (default 15), the server ends it (`COMPLETED`, snapshot saved). This prevents zombie pods and orphaned timers. Add the variable to `.env.example`.

## D10. Demo login route
- Use `POST /api/demo/login`, **not** `/api/auth/demo` (it sits under the Auth.js catch-all `/api/auth/[...nextauth]` and is confusing).
- Behavior: if `DEMO_MODE !== 'true'` → 403 immediately. Otherwise only the seeded demo accounts can sign in, never arbitrary emails and never bot emails. Register the Auth.js credentials provider only when `DEMO_MODE === 'true'`.

## D11. `PodSnapshot`
- Add `phaseDurationSec: number` (the full length of the current phase, from the pod's `focusDurationSec` or `breakDurationSec`). Update the shared zod schema and types. This is a non-breaking addition.

## D12. Guardrail fallback is not persisted
- If the post-response filter blocks twice, return the generic fallback `SocraticHint` to the clients but **do not** write it to `Question.aiHint`. The same applies to timeouts and errors. Only validated model output is stored. Otherwise D5's idempotency would lock a useless generic hint onto the question forever.
- Log `GUARDRAIL_BLOCKED` without note content.

## D13. Profile (FR-1.2)
- Deferred (P1). Keep `studyProgram` and `semester` nullable in the schema. No profile UI until told.

## D14. Question limit
- One question per member per pod, ever. `@@unique([podId, authorId])` is the rule. Marking a question resolved does not free the slot. Do not describe this as "one active question".

## D15. Gemini notes for Phase 7
- Model id `gemini-3.8-flash` was checked against Google's official docs on 2026-11-11 (GA). Keep it in `GEMINI_MODEL`; do not hardcode.
- For this model generation, do not send `temperature`, `top_p`, `top_k`, or `candidate_count`. Control latency with the thinking level (`low`, `medium`, `high`; `minimal` is unsupported). Start with `low`, measure, and only raise it if the Socratic quality needs it.
- Google's docs now also describe a newer Interactions API. Use whichever structured-JSON path the installed `@google/genai` version supports and documents. Prefer `generateContent` if still supported, since DESIGN B9 is written around it. Verify with one real smoke call before building on it.
- Phase 7 gate adds: measured p95 latency of `socratic:ask` over at least 20 real calls (target ≤ 8 s, PRD FR-4.1), raw numbers pasted. If no API key is available, say so and mark that item UNVERIFIED.

## D16. Windows and paths
- The repo lives at a path containing a space (`D:\MY CODE\...`). Every npm script and config must work there and on Windows PowerShell: no bash-only syntax, no unquoted path variables. Final-day machines may be Windows or Linux.
- Set `NEXT_TELEMETRY_DISABLED=1` in the offline-build check.

## D17. Auth.js is still a beta line
- `next-auth@5.0.0-beta.32` stays (locked). In Phase 3, prove the full Google and demo login flow in a real browser, with a screenshot, before building anything on top. If it breaks with Next 16, report it with raw output. Do not swap auth libraries without approval.

---

## Phase 1: amended deliverables and gate

Everything in the Phase 0 plan stands, plus:

1. D1 archive move first, as its own change.
2. Root `package.json` with `packageManager`, `engines.node`, `.nvmrc`; `.gitignore` covering `node_modules`, `.env*` (except `.env.example`), `.next`, build output, and generated files.
3. `packages/db`: `schema.prisma` exactly per B3 with `prisma-client-js` and `url = env("DATABASE_URL")`. No migrations yet.
4. `packages/shared`: add `ALREADY_IN_POD` to `ErrorCode`, add `phaseDurationSec` to `PodSnapshot`.
5. `.env.example` additionally contains `APP_TIMEZONE`, `POD_IDLE_MINUTES`, `NEXT_TELEMETRY_DISABLED`.

**Raw proof required in the Phase 1 report** (missing item → status UNVERIFIED):
- `pnpm list -r --depth 0` output matching the version table, or each difference explained.
- `node -v`, `pnpm -v`, and the `packageManager` / `engines` fields.
- `prisma validate` and `prisma generate` output (D2 gate).
- `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test`, `pnpm -r build`, verbatim.
- `curl` of `/health` returning 200.
- `pnpm build` with the network actually disabled. State how you disabled it.
- A grep showing no `fonts.googleapis.com` and no `next/font/google`.
- `git status` and `git check-ignore -v .env` proving `.env` is not tracked.
- The listing of `Docs/` after the D1 move.
- LADDER CHECK listing every dependency added and the rung that justified it.

---

D18. Prototype mode. NEXT_PUBLIC_REALTIME_MODE=fake|real (default real). In fake mode the Masuk screen is a mock that routes to /pod without Auth.js, and the app makes no network calls except static assets, so apps/web can be deployed as a standalone prototype for the semifinal judges. In real mode no bypass may exist. The Phase 3 gate must prove /pod redirects to /masuk without a session when the flag is not "fake".
D19. Fake adapter. One RealtimeClient interface whose methods map 1:1 to the DESIGN B5 events (so Phase 4 implements the same interface), plus a fake in-memory implementation. The fake must be deterministic: seeded timers, no unseeded randomness, all timings in constants (demo: focus 60 s, break 20 s, matching 1/4 to 4/4 on a fixed schedule) so the 2-minute video can be re-recorded identically. Simulated members are labeled "Simulasi".
D20. Allowed new dependencies in Phase 2 (only when imported): codemirror, @codemirror/lang-markdown, @codemirror/state, @codemirror/view (local document only, no Yjs yet), react-markdown, rehype-sanitize, remark-gfm, lucide-react. Not allowed: framer-motion or any animation library (DESIGN A6 is CSS-only), any chart library, any state library unless justified on the ladder.

---

- **D21. Tidak ada penghitung "28 mahasiswa sedang sprint".** Banner itu hanya ada di wireframe v1, bukan di requirement PRD mana pun, dan di mode fake akan menjadi bukti sosial palsu. Hapus dari DESIGN A4 (tulis di DECISIONS bahwa ia dibatalkan).
- **D22. Native dulu untuk kontrol form.** `ModulePicker` = daftar bersarang `<details>/<summary>` dengan daun berupa `<input type="radio" name="module">` yang dibungkus `<label>`. Chip urgensi dan jendela waktu = radio native yang diberi gaya. Waktu kustom = dua `<input type="time">`. Pencarian modul: saat ada teks, tampilkan daun yang cocok dengan breadcrumb ("Struktur Data › Graph › Traversal dan Dijkstra"), buka induknya, umumkan jumlah hasil lewat `aria-live="polite"`, dan sediakan empty state dengan aksi "Hapus pencarian".
- **D23. Kebijakan dependency UI.** Dilarang: `shadcn init`, `next-themes`, `react-hook-form` dan resolver-nya, `class-variance-authority`, `framer-motion`, library chart. Radix hanya sebagai paket tunggal (`@radix-ui/react-*`) bila native tidak bisa memenuhi a11y, dengan justifikasi tangga di rencana. Ekspektasi untuk 2b: nol dependency UI baru. Satu-satunya devDependency baru yang diizinkan: `cross-env` (D30).
- **D24. Skenario fake.** `?scenario=happy` (default) dan `?scenario=fallback`. Dibaca sekali saat klien dibuat, nilai tak dikenal jatuh ke `happy`. `fallback`: pencocokan berhenti di 3 dari 4, masa tunggu singkat (konstanta, mis. 8 detik), muncul tawaran bertiga dengan hitung mundur 60 detik, lalu perilaku D7 (semua terima = pod 3 orang, ada yang menolak atau habis waktu = tawaran batal).
- **D25. `DemoControls`.** Hanya dirender jika mode `fake` **dan** `?demo=1`. Panel ringkas berjudul "Kontrol demo (simulasi)": Putus koneksi 8 detik, Loncat ke 60 detik terakhir, Lewati ke istirahat, Akhiri sprint, Reset. Satu berkas. Tidak ikut ter-bundle di build `real` (dibuktikan M2).
- **D26. Sumber tunggal di `packages/shared`.** Fixture syllabus (M8) dan fungsi murni `buildSessionSummaryMarkdown(summary): string` untuk FR-5.1 (judul modul, tanggal WIB, durasi fokus per anggota, catatan akhir, pertanyaan beserta status dan petunjuk AI). Dipakai fake sekarang dan klien nyata di Phase 8. Ada tes golden file.
- **D27. Pemetaan error ke teks.** Satu `errorCopy: Record<ErrorCode, { message: string; action?: ... }>` yang exhaustive, sehingga menambah `ErrorCode` memecah typecheck. UI tidak pernah menampilkan pesan mentah dari server. `ALREADY_IN_POD` menampilkan aksi "Kembali ke pod". Tes komponen memeriksa setiap kode.
- **D28. Kebijakan git.** Satu branch per fase (`phase/<nama>`), tidak ada commit langsung ke `main`, tidak ada force push, tidak ada `--no-verify`. CI wajib hijau. User yang merge setelah `APPROVED PHASE 2B`.
- **D29. Kontinuitas radar ke timer.** Satu percobaan dengan View Transitions API (cek dukungan di dokumentasi Next yang terpasang, mis. opsi `viewTransition`), elemen `PodRing` diberi `view-transition-name`. Jika butuh lebih dari perubahan kecil yang berdiri sendiri, atau tidak berfungsi di Chromium, **pakai cross-fade 200 ms** dan catat di laporan. Hormati `prefers-reduced-motion` (tanpa transisi).
- **D30. Deploy prototipe.** Skrip `build:prototype` di root memakai `cross-env NEXT_PUBLIC_REALTIME_MODE=fake pnpm --filter @syncpod/web... build` (jalan di PowerShell dan Linux, sesuai D16). README memuat bagian "Deploy prototipe (Vercel)" dengan pengaturan persis: root directory, install command `pnpm install --frozen-lockfile`, build command, env `NEXT_PUBLIC_REALTIME_MODE=fake`. Jalankan perintah itu secara lokal dan lampirkan log.
- **D31. Laporan fase menambah `TEACH-BACK` dan `git diff --stat`.** Tiga pertanyaan penguji (bukan jawabannya), satu analogi, dan satu bagian "Apa yang rapuh".
- **D32. Kejujuran prototipe.** Di mode fake, semua layar menampilkan penanda kecil tetap "Prototipe: data simulasi" yang tidak menutup kontrol. Anggota simulasi tetap berlabel "Simulasi" (D8). Naskah demo menyatakan secara eksplisit bahwa ini prototipe dan backend realtime dibangun pada Build Period.

