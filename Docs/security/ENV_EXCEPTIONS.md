# Environment Variable Exceptions Allowlist (D40)

Under decision D40 and Phase 3B security policy, all server runtime environment variable reads across `apps/web/src` and `apps/realtime/src` must pass through the memoized, schema-validated `getEnv()` function rather than reading `process.env` directly.

The ONLY approved exceptions for direct `process.env.*` reads are listed below with their architectural justifications:

| File Path | Direct Read | Justification |
|---|---|---|
| `apps/web/src/env.ts` | `process.env` | Central Zod schema parsing and fail-fast validation entry point. |
| `apps/realtime/src/env.ts` | `process.env` | Central Zod schema parsing and fail-fast validation entry point. |
| `apps/web/src/instrumentation.ts` | `process.env.NEXT_RUNTIME`, `process.env.NEXT_PHASE` | Low-level Next.js lifecycle hooks evaluated by the Next.js runtime before application modules are loaded. |
| `apps/web/src/proxy.ts` | `process.env.NEXT_PUBLIC_REALTIME_MODE` | Allows instantaneous early exit in prototype fake mode without importing heavy validation or auth modules. |
| `apps/web/src/proxy.ts` | `process.env.AUTH_SECRET` | Next.js proxy runs in Node.js runtime before request dispatch; reads secret directly for `getToken`. |
| `apps/web/src/features/realtime/config.ts` | `process.env.NEXT_PUBLIC_REALTIME_MODE` | Next.js requires literal `process.env.NEXT_PUBLIC_*` member expressions for build-time static inlining in client bundles. |
| `apps/web/src/app/masuk/page.tsx` | `process.env.NEXT_PUBLIC_REALTIME_MODE` | Next.js literal for build-time branch inlining between prototype and real modes. |
| `apps/web/src/app/pod/page.tsx` | `process.env.NEXT_PUBLIC_REALTIME_MODE` | Next.js literal for build-time branch inlining between prototype and real modes. |

All other reads must strictly invoke `getEnv()`.
