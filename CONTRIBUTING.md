# Panduan Kontribusi SyncPod

Terima kasih sudah berkontribusi pada **SyncPod** (Tim **Cah Kacawww** — ITATS, GDGoC ITB STACK 2026). Sebelum menulis kode atau membuka Pull Request, pastikan memahami aturan teknis repo ini agar prototipe dan Build Period tetap selaras.

---

## 1. Sumber Kebenaran & Prioritas

Sebelum mengubah perilaku atau tampilan, baca secara berurutan:
1. [`Docs/DECISIONS.md`](Docs/DECISIONS.md) (ADR **D1–D32**) — mengikat seluruh proyek.
2. [`Docs/PRD.md`](Docs/PRD.md) — perilaku produk, prioritas (`P0`/`P1`/`P2`), dan daftar Out of Scope (`§4.2`).
3. [`Docs/DESIGN.md`](Docs/DESIGN.md) — design system (Part A) dan kontrak teknis (Part B).

---

## 2. Alur Git & Branch (`D28`)

- **Dilarang commit langsung ke `main`**, `git push --force`, atau melewati git hooks (`--no-verify`).
- Gunakan satu branch per fase atau fitur: `phase/<nama>` (contoh: `phase/2b-screens`) atau `fix/<deskripsi-singkat>`.
- Pakai **Conventional Commits**:
  - `feat(web): ...`
  - `fix(realtime): ...`
  - `docs(readme): ...`
  - `test(shared): ...`
  - `chore(ci): ...`

---

## 3. Prinsip Implementasi

- **Toolchain Terkunci (`D4`):** Node `26.8.1` (`.nvmrc`), pnpm `12.8.1`. Semua dependensi menggunakan **versi eksak** tanpa `^` atau `~`.
- **Kebijakan Dependensi UI (`D20`, `D23`):** Utamakan HTML native (`<details>`, `<summary>`, `<input type="radio">`, `<input type="time">`) dan Tailwind CSS v4. Dilarang menambah `framer-motion`, `react-hook-form`, `next-themes`, `shadcn init`, atau library chart.
- **Tanpa Heks Mentah & Wajib Self-Host Font (`DESIGN A2 & A3`):** Seluruh warna komponen berasal dari CSS token di `apps/web/src/styles/tokens.css`. Dilarang keras memakai `@import` Google Fonts atau `next/font/google`.
- **Teks UI Terpusat (`PRD §4.2`):** Seluruh copy UI berbahasa Indonesia diletakkan di `apps/web/src/copy.ts` (tidak di-hardcode di komponen).
- **Kompatibel Windows & Linux (`D16`):** Skrip `package.json` wajib berjalan di PowerShell (path mengandung spasi didukung) dan bash Linux.

---

## 4. Quality Gate Wajib Sebelum PR

Jalankan seluruh gate dari root repo sebelum mendorong commit final:

```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm -r build
```

Untuk verifikasi mode prototipe standalone (`D18`, `D30`):

```powershell
# Windows PowerShell
$env:NEXT_PUBLIC_REALTIME_MODE = "fake"
$env:NEXT_TELEMETRY_DISABLED = "1"
pnpm --filter @syncpod/web... build
```

Pastikan tidak ada `console.log` token/rahasia dan tidak ada variabel `NEXT_PUBLIC_*` yang membawa kredensial.
