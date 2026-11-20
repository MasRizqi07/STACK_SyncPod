import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';

export const REALTIME_TOKEN_TTL_SEC = 300;
export const REALTIME_TOKEN_MAX_TTL_SEC = 600; // 10 minutes max (D39)
export const REALTIME_TOKEN_ISSUER = 'syncpod-web';
export const REALTIME_TOKEN_AUDIENCE = 'syncpod-realtime';
export const MIN_SECRET_LENGTH = 32;

export type RealtimeTokenErrorCode =
  | 'INVALID_SECRET'
  | 'INVALID_USER_ID'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID';

export class RealtimeTokenError extends Error {
  readonly code: RealtimeTokenErrorCode;

  constructor(code: RealtimeTokenErrorCode, message: string) {
    super(message);
    this.name = 'RealtimeTokenError';
    this.code = code;
  }
}

interface TextEncoderCtor {
  new (): { encode(input: string): Uint8Array };
}

function assertServerOnly(): void {
  const g = globalThis as Record<string, unknown>;
  if (typeof g.window !== 'undefined') {
    throw new Error('realtime-token module is server-only and cannot be used in browser code');
  }
}

function encodeSecret(secret: string): Uint8Array {
  if (typeof secret !== 'string' || secret.trim().length < MIN_SECRET_LENGTH) {
    throw new RealtimeTokenError(
      'INVALID_SECRET',
      `REALTIME_JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters`,
    );
  }
  const Encoder = (globalThis as unknown as { TextEncoder: TextEncoderCtor }).TextEncoder;
  return new Encoder().encode(secret);
}

export interface SignRealtimeTokenOptions {
  userId: string;
  secret: string;
  nowSec?: number;
  ttlSec?: number;
}

export interface SignedRealtimeToken {
  token: string;
  iat: number;
  exp: number;
  expiresAt: number;
}

export async function signRealtimeToken(
  userIdOrOptions: string | SignRealtimeTokenOptions,
  maybeSecret?: string,
): Promise<SignedRealtimeToken> {
  assertServerOnly();

  let userId: string;
  let secret: string;
  let nowSec: number | undefined;
  let ttlSec: number | undefined;

  if (typeof userIdOrOptions === 'object' && userIdOrOptions !== null) {
    userId = userIdOrOptions.userId;
    secret = userIdOrOptions.secret;
    nowSec = userIdOrOptions.nowSec;
    ttlSec = userIdOrOptions.ttlSec;
  } else {
    userId = userIdOrOptions;
    secret = maybeSecret!;
  }

  const trimmedUserId = userId?.trim();
  if (!trimmedUserId) {
    throw new RealtimeTokenError('INVALID_USER_ID', 'userId is required to sign realtime token');
  }

  const key = encodeSecret(secret);
  const iat = nowSec ?? Math.floor(Date.now() / 1000);
  const ttl = ttlSec ?? REALTIME_TOKEN_TTL_SEC;
  const exp = iat + ttl;

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(trimmedUserId)
    .setIssuer(REALTIME_TOKEN_ISSUER)
    .setAudience(REALTIME_TOKEN_AUDIENCE)
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(key);

  return {
    token,
    iat,
    exp,
    expiresAt: exp * 1000,
  };
}

export interface VerifiedRealtimeToken {
  userId: string;
  iat: number;
  exp: number;
}

export interface VerifyRealtimeTokenOptions {
  currentDate?: Date;
}

export async function verifyRealtimeToken(
  token: string,
  secret: string,
  options?: VerifyRealtimeTokenOptions,
): Promise<VerifiedRealtimeToken> {
  assertServerOnly();

  if (typeof token !== 'string' || token.trim().length === 0) {
    throw new RealtimeTokenError('TOKEN_INVALID', 'Realtime token is missing or empty');
  }

  const key = encodeSecret(secret);

  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
      issuer: REALTIME_TOKEN_ISSUER,
      audience: REALTIME_TOKEN_AUDIENCE,
      clockTolerance: 5, // clock tolerance <= 5s (D39)
      currentDate: options?.currentDate,
    });

    if (
      typeof payload.sub !== 'string' ||
      payload.sub.trim().length === 0 ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number'
    ) {
      throw new RealtimeTokenError('TOKEN_INVALID', 'Realtime token claims are malformed');
    }

    // D39: reject token if exp - iat > 10 minutes (600 seconds)
    if (payload.exp - payload.iat > REALTIME_TOKEN_MAX_TTL_SEC) {
      throw new RealtimeTokenError(
        'TOKEN_INVALID',
        'Realtime token lifetime exceeds maximum allowed duration (10 minutes)',
      );
    }

    return {
      userId: payload.sub,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch (err) {
    if (err instanceof RealtimeTokenError) {
      throw err;
    }
    if (err instanceof joseErrors.JWTExpired) {
      throw new RealtimeTokenError('TOKEN_EXPIRED', 'Realtime token has expired');
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new RealtimeTokenError('TOKEN_INVALID', `Realtime token verification failed: ${msg}`);
  }
}
