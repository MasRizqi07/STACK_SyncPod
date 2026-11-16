# LADDER CHECK: Phase 3A Dependencies

Documenting all newly introduced dependencies in Phase 3A per GLOBAL RULE 6 and DECISIONS D17/D23.

---

## 1. `next-auth@5.0.0-beta.32`

- **Workspace Target:** `apps/web` (dependencies)
- **Version:** `5.0.0-beta.32` (locked verbatim per DECISIONS D17)
- **LADDER Rung:** Top-tier Authentication & Session Protocol
- **What it replaces:** Custom hand-rolled OAuth 2.0 PKCE flow, state/nonce cookie management, and JWE session encryption.
- **Why native/existing code cannot do it:** Secure Google OAuth integration requires cryptographic state verification, PKCE challenge negotiation, provider token exchange, and encrypted HttpOnly cookie management compliant with OWASP standards. Auth.js v5 beta-32 provides standard integration with Next.js App Router.

---

## 2. `tsx@4.23.15`

- **Workspace Target:** `packages/db` (devDependencies)
- **Version:** `4.23.15` (exact version, no ^ or ~)
- **LADDER Rung:** Developer Tooling / TypeScript Execution
- **What it replaces:** Pre-compiling TypeScript files to `dist/` before running seed scripts (`tsc -p ... && node dist/seed.js`).
- **Why native/existing code cannot do it:** `pnpm db:seed` must execute `src/seed.ts` directly and idempotently in both development and CI without polluting the build artifact directory or requiring prior workspace compilation.
