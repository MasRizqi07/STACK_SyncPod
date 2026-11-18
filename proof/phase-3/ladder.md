# LADDER CHECK: Phase 3 Dependencies (Tasks 3.1–3.10)

Documenting all newly introduced dependencies in Phase 3 per GLOBAL RULE 6 and DECISIONS D17/D23.

---

## 1. `next-auth@5.0.0-beta.32` (Task 3.4)

- **Workspace Target:** `apps/web` (dependencies)
- **Version:** `5.0.0-beta.32` (locked verbatim per DECISIONS D17)
- **LADDER Rung:** Top-tier Authentication & Session Protocol
- **What it replaces:** Custom hand-rolled OAuth 2.0 PKCE flow, state/nonce cookie management, and JWE session encryption.
- **Why native/existing code cannot do it:** Secure Google OAuth integration requires cryptographic state verification, PKCE challenge negotiation, provider token exchange, and encrypted HttpOnly cookie management compliant with OWASP standards. Auth.js v5 beta-32 provides standard integration with Next.js 16 App Router.

---

## 2. `tsx@4.23.15` (Task 3.3)

- **Workspace Target:** `packages/db` (devDependencies)
- **Version:** `4.23.15` (exact version, no ^ or ~)
- **LADDER Rung:** Developer Tooling / TypeScript Execution
- **What it replaces:** Pre-compiling TypeScript files to `dist/` before running seed scripts (`tsc -p ... && node dist/seed.js`).
- **Why native/existing code cannot do it:** `pnpm db:seed` must execute `src/seed.ts` directly and idempotently in both development and CI without polluting the build artifact directory or requiring prior workspace compilation.

---

## 3. `jose@6.2.17` (Task 3.7)

- **Workspace Target:** `packages/shared` (dependencies; already present in workspace lockfile via `next-auth`, pinned exact)
- **Version:** `6.2.17` (exact version, no ^ or ~)
- **LADDER Rung:** Standard Cryptographic JWT Library (RFC 7515 / RFC 7519)
- **What it replaces:** Hand-rolled HMAC-SHA256 base64url JWT signing, constant-time signature verification, and claim expiry/audience/issuer validation.
- **Why native/existing code cannot do it:** Hand-rolling JWT signing and verification is error-prone (algorithm confusion, timing attacks, clock skew handling). `jose` is zero-dependency, standards-compliant, and explicitly approved in `Docs/DESIGN.md` B4 and `Docs/PHASES_3-9.md` §3. Isolated strictly inside the server-only subpath `@syncpod/shared/realtime-token` so it never enters client bundles.
