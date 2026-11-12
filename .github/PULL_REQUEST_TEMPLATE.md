## Ringkasan Perubahan

<!-- Jelaskan secara singkat perubahan yang dilakukan, fase/tugas terkait (misal T1/M8 atau Phase 3), dan alasan teknisnya. -->

## Rujukan Spesifikasi

- Mengacu pada: `Docs/DECISIONS.md` (`D...`), `Docs/PRD.md` (`FR-...`), `Docs/DESIGN.md` (`A.../B...`).
- Memenuhi aturan scope (tanpa fitur *Out of Scope* PRD §4.2).

## Checklist Quality Gate

- [ ] `pnpm -r typecheck` lulus (0 error)
- [ ] `pnpm -r lint` lulus (0 error)
- [ ] `pnpm -r test` lulus seluruh suite
- [ ] `pnpm -r build` lulus
- [ ] Build prototipe (`NEXT_PUBLIC_REALTIME_MODE=fake`) lulus dan bebas request CDN/Google Fonts eksternal
- [ ] Warna komponen memakai CSS tokens dari `apps/web/src/styles/tokens.css` (nol heks mentah)
- [ ] String UI baru diletakkan di `apps/web/src/copy.ts` dan anggota simulasi berlabel `"Simulasi"`
- [ ] Tidak ada rahasia di env `NEXT_PUBLIC_*`, log, atau commit

## Bukti / Tangkapan Layar (jika mengubah UI)

<!-- Lampirkan path bukti di `proof/` atau tangkapan layar pada 375px, 768px, dan 1280px. -->
