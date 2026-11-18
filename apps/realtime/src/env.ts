import { z } from '@syncpod/shared';

const booleanFlag = z.enum(['true', 'false']).default('false');

export const realtimeEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().trim().min(1, 'DATABASE_URL is required'),
    REALTIME_JWT_SECRET: z
      .string()
      .trim()
      .min(16, 'REALTIME_JWT_SECRET must be at least 16 characters'),
    WEB_ORIGIN: z.string().url('WEB_ORIGIN must be a valid URL').default('http://localhost:3000'),
    REALTIME_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DEMO_MODE: booleanFlag,
    ALLOW_DEMO_IN_PROD: booleanFlag,
    GEMINI_MOCK: z.enum(['true', 'false']).default('true'),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().trim().min(1).default('gemini-3.8-flash'),
    FOCUS_SECONDS: z.coerce.number().int().positive().default(1500),
    BREAK_SECONDS: z.coerce.number().int().positive().default(300),
    MAX_ROUNDS: z.coerce.number().int().positive().default(4),
    POD_IDLE_MINUTES: z.coerce.number().int().positive().default(15),
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
          'DEMO_MODE=true is forbidden when NODE_ENV=production unless ALLOW_DEMO_IN_PROD=true is explicitly set',
      });
    }

    if (env.GEMINI_MOCK !== 'true' && (!env.GEMINI_API_KEY || env.GEMINI_API_KEY.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GEMINI_API_KEY'],
        message: 'GEMINI_API_KEY is required when GEMINI_MOCK is not true',
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
