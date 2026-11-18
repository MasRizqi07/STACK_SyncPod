import { z } from '@syncpod/shared';

const booleanFlag = z.enum(['true', 'false']).default('false');

export const webEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    NEXT_PUBLIC_REALTIME_MODE: z.enum(['fake', 'real']).default('real'),
    NEXT_PUBLIC_REALTIME_URL: z.string().url().default('http://localhost:4000'),
    DEMO_MODE: booleanFlag,
    ALLOW_DEMO_IN_PROD: booleanFlag,
    DATABASE_URL: z.string().optional(),
    AUTH_SECRET: z.string().optional(),
    REALTIME_JWT_SECRET: z.string().optional(),
    AUTH_GOOGLE_ID: z.string().optional(),
    AUTH_GOOGLE_SECRET: z.string().optional(),
    ALLOWED_EMAIL_DOMAINS: z.string().optional(),
    APP_TIMEZONE: z.string().min(1).default('Asia/Jakarta'),
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

    if (env.NEXT_PUBLIC_REALTIME_MODE !== 'fake') {
      if (!env.DATABASE_URL || env.DATABASE_URL.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['DATABASE_URL'],
          message: 'DATABASE_URL is required in real mode',
        });
      }
      if (!env.AUTH_SECRET || env.AUTH_SECRET.trim().length < 16) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['AUTH_SECRET'],
          message: 'AUTH_SECRET must be at least 16 characters in real mode',
        });
      }
      if (!env.REALTIME_JWT_SECRET || env.REALTIME_JWT_SECRET.trim().length < 16) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['REALTIME_JWT_SECRET'],
          message: 'REALTIME_JWT_SECRET must be at least 16 characters in real mode',
        });
      }
    }
  });

export type WebEnv = z.infer<typeof webEnvSchema>;

export function validateWebEnv(raw: Record<string, string | undefined> = process.env): WebEnv {
  const result = webEnvSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid web environment configuration: ${details}`);
  }
  return result.data;
}
