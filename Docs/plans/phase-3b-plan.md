# Phase 3B Implementation Plan: Guards, Realtime Token, Authz, Env & Secret Hygiene

**Date:** 2026-11-20  
**Branch:** `phase/3b-guards` (from `phase/3-db-auth`)  
**Status:** DRAFT (Awaiting `APPROVED PLAN 3B`)

---

## 1. Verified Next.js 16.4.6 Facts
- **File Convention:** `proxy.ts` (or `proxy.js`) placed in `src/` at the same level as `app/`. The convention `middleware.ts` is explicitly deprecated in Next.js 16 and renamed to `proxy.ts` with named export `export function proxy(request: NextRequest)`.  
  *Source:* `node_modules/.pnpm/next@16.4.6_@babel+core@7.2_f27095349a29a0421a3cd850cd826b33/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`
- **Runtime:** Proxy in Next.js 16 defaults to the **Node.js runtime** (`v16.0.0: Middleware is deprecated and renamed to Proxy. Proxy defaults to the Node.js runtime`).
- **Matcher:** Defined via `export const config = { matcher: ['/pod', '/pod/:path*', '/api/realtime/:path*'] }`. Regex negative matchers are supported for asset exclusions.
- **Environment Inlining:** `process.env.NEXT_PUBLIC_*` is statically inlined into JavaScript client bundles at build time if written as literal member expressions (`process.env.NEXT_PUBLIC_VAR`). On the server/proxy, runtime environment variables remain dynamic.  
  *Source:* `.../next/dist/docs/01-app/02-guides/environment-variables.md`

---

## 2. Decision Points
- **DP1: Location of Token Signer and Verifier**
  - *Option A:* Export from `@syncpod/shared/server` via dedicated subpath `./server` in `packages/shared/package.json`. Isolates `jose` entirely to server imports; client bundles importing `@syncpod/shared` (types, syllabus, demo accounts) never pull `jose`.
  - *Option B:* Export directly from root `@syncpod/shared`. Client builds might accidentally reference `jose` or fail bundle audits.
  - *Recommendation:* **Option A**. Zero client bundle pollution, strict architectural separation.
- **DP2: Rendering `/pod` in Real Mode Prior to Phase 4**
  - *Option A:* Minimalist Realtime Placeholder Shell in `apps/web/src/app/pod/page.tsx` when `NEXT_PUBLIC_REALTIME_MODE === 'real'`. Displays user header (`session.user.name`), "Keluar" button (`signOut` with CSRF), and status badge "Realtime belum tersedia (Build Period Phase 4)". Copy centralized in `apps/web/src/copy.ts`.
  - *Option B:* Redirect real-mode `/pod` visits to a static `/offline` page.
  - *Recommendation:* **Option A**. Preserves route structure and fulfills FR-1.1 authorization requirements while preventing fake-client leak into real mode.

---

## 3. Tasks Breakdown (T1..T5)

| ID | Task & Scope | Pre-written Tests | Verification Command | Expected Outcome |
|---|---|---|---|---|
| **T1** | **3.6 Route Protection & Fake Isolation:** `session.ts` (`requireSession`), `safeCallbackPath` (`callback-url.ts`), `proxy.ts`, real `/pod` shell, `copy.ts`, fake bundle audit script. | `test/session.test.ts`, `test/callback-path.test.ts` (≥12 cases + mutation) | `node scripts/proof-run.mjs phase-3b redirect-real -- ...`<br>`node scripts/proof-run.mjs phase-3b fake-bundle -- node scripts/check-fake-bundle.mjs` | Unauthed 307 to `/masuk`, authed 200, `/api/realtime/**` 401. Zero auth/db/jose strings in fake bundle. |
| **T2** | **3.7 Realtime Token (D39):** `signRealtimeToken` & `verifyRealtimeToken` in `@syncpod/shared/server`, `GET /api/realtime/token`. | `packages/shared/test/realtime-token.test.ts` (≥10 cases + mutation) | `node scripts/proof-run.mjs phase-3b token -- ...` | HS256, 300s TTL, valid claims, reject alg:none, tampered, or expired. |
| **T3** | **3.8 Pod Data-Layer Authorization:** `packages/db/src/authz.ts` (`assertPodMember`, `assertPodLeader`), `AuthzError`. | `packages/db/test/authz.test.ts` (real DB `syncpod_test`) | `node scripts/proof-run.mjs phase-3b authz -- pnpm --filter @syncpod/db test` | Passes member/leader checks, throws `NOT_A_MEMBER`, `POD_NOT_FOUND`, `FORBIDDEN`. |
| **T4** | **3.9 Mode-Aware Env Validation (D40):** Zod schemas in `apps/web/src/env.ts` and `apps/realtime/src/env.ts` evaluated lazily via `getEnv()`. | `apps/web/test/env.test.ts`, `apps/realtime/test/env.test.ts` | `node scripts/proof-run.mjs phase-3b env-validation -- node scripts/test-env-matrix.mjs` | Fails fast in real mode, fake mode needs zero secrets. Sentinel values never printed. |
| **T5** | **3.10 Secret Hygiene & Closeout:** `scripts/check-bundle-secrets.mjs`, `scripts/check-env-reads.mjs`, update `CLAIMS_AND_EVIDENCE.md`. | Script test suites | `node scripts/proof-run.mjs phase-3b bundle-secrets -- ...`<br>`node scripts/check-proof-logs.mjs proof/phase-3b` | Zero secrets/tokens in client bundle, zero unapproved `process.env` reads, honest claims. |

---

## 4. Spec Self-Review
- **Placeholders:** Zero placeholders; exact paths, modules, and error codes defined.
- **Contradictions:** Fully aligned with D1–D40 (no `next-auth` in fake bundle, `REALTIME_JWT_SECRET` distinct from `AUTH_SECRET`, D38 defense-in-depth).
- **Scope Creep Guard:** Socket.IO server, WebSocket client, matchmaking logic, Yjs, and Gemini remain strictly excluded (Phase 4+).
- **Clarity:** Distinct separation between server subpath and shared client types.
