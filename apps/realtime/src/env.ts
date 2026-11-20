import { z } from '@syncpod/shared';

const booleanFlag = z.enum(['true', 'false']).default('false');

export const realtimeEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().trim().min(1, 'DATABASE_URL is required'),
    REALTIME_JWT_SECRET: z
      .string()
      .trim()
      .min(32, 'REALTIME_JWT_SECRET must be at least 32 characters'),
    WEB_ORIGIN: z.string().url('WEB_ORIGIN must be a valid URL').default('http://localhost:3000'),
    REALTIME_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DEMO_MODE: booleanFlag,
    ALLOW_DEMO_IN_PROD: booleanFlag,
    APP_TIMEZONE: z.string().trim().min(1).default('Asia/Jakarta'),
  })
  .superRefine((env, ctx) => {
    if (
      env.DEMO_MODE === 'true' &&
      env.NODE_ENV === 'production' &&
      env.ALLOW_DEMO_IN_PROD !== 'true'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DEMO_MODE'],
        message:
          'DEMO_MODE=true is forbidden in production unless ALLOW_DEMO_IN_PROD=true is explicitly set',
      });
    }
  });

export type RealtimeEnv = z.infer<typeof realtimeEnvSchema>;

export function validateRealtimeEnv(
  raw: Record<string, string | undefined> = process.env,
): RealtimeEnv {
  const result = realtimeEnvSchema.safeParse({
    ...raw,
    REALTIME_PORT: raw.REALTIME_PORT ?? raw.PORT,
  });
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid realtime environment configuration: ${details}`);
  }
  return result.data;
}

let memoizedRealtimeEnv: RealtimeEnv | null = null;

export function getEnv(): RealtimeEnv {
  if (!memoizedRealtimeEnv) {
    memoizedRealtimeEnv = validateRealtimeEnv();
  }
  return memoizedRealtimeEnv;
}

export function resetEnvCache(): void {
  memoizedRealtimeEnv = null;
}
