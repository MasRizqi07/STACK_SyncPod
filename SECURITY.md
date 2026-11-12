# Kebijakan Keamanan SyncPod

Keamanan dan privasi data sprint menjadi bagian inti rancangan SyncPod (`Docs/DESIGN.md` Part B10 & `Docs/PRD.md` NFR-4).

---

## Invarian Keamanan Arsitektur

1. **Identitas di sisi server (`DESIGN B4 & B5`):**
   - Sesi Auth.js disimpan di cookie `HttpOnly`, `SameSite=Lax`, dan `Secure` di lingkungan produksi.
   - Koneksi Socket.IO dan WebSocket Yjs diautentikasi dengan JWT HS256 berumur pendek (5 menit) melalui `/api/realtime/token`.
   - **Payload klien -> server tidak pernah membawa `userId` pelaku** — identitas dibaca eksklusif dari token terverifikasi, disertai pemeriksaan keanggotaan pod (`NOT_A_MEMBER`) dan peran leader (`FORBIDDEN`).
2. **Isolasi rahasia server (`NFR-4`):**
   - `GEMINI_API_KEY`, `AUTH_SECRET`, `REALTIME_JWT_SECRET`, dan `DATABASE_URL` hanya hidup di sisi server.
   - Tidak ada rahasia di bundle klien atau variabel berawalan `NEXT_PUBLIC_*`.
3. **Sanitasi konten kolaboratif (`FR-3.2`):**
   - Pratinjau Markdown catatan bersama disanitasi dengan `react-markdown` + `rehype-sanitize` (menolak `<script>`, event handler HTML, dan skema `javascript:`).
4. **Pagar Anti-Menyontek Sokratik (`FR-4.2`, `DESIGN B9`):**
   - Konten catatan dan pertanyaan dibungkus sebagai data tidak tepercaya (`<session_notes>`, `<question>`).
   - Keluaran AI divalidasi dengan skema JSON Zod dan filter pascarespons agar bebas blok kode solusi.
5. **Mode Demo Terkunci (`D8`, `D10`):**
   - Akun simulasi (`simulasi-*@bot.syncpod.local`) tidak bisa digunakan untuk login. Login demo backend hanya aktif saat `DEMO_MODE=true`.

---

## Melaporkan Kerentanan

Jika menemukan celah keamanan, kebocoran kunci, atau bypass autentikasi/otorisasi:

1. **Jangan** membuat GitHub Issue publik yang memaparkan detail eksploitasi atau kredensial.
2. Hubungi tim pengelola **Tim Cah Kacawww (ITATS)** secara langsung melalui kanal privat tim/repository maintainer dengan rincian:
   - Langkah reproduksi singkat dan komponen terdampak (`apps/web`, `apps/realtime`, `packages/db`, `packages/shared`).
   - Dampak potensial terhadap sesi, isolasi pod, atau guardrail AI.
   - Saran mitigasi jika ada.
