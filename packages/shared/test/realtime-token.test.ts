import { describe, expect, it } from 'vitest';
import {
  REALTIME_TOKEN_TTL_SEC,
  RealtimeTokenError,
  signRealtimeToken,
  verifyRealtimeToken,
} from '../src/realtime-token.js';

const SECRET = 'realtime-jwt-test-secret-32-bytes-ok!!';
const WRONG_SECRET = 'different-jwt-test-secret-32-bytes-no!';

describe('realtime token sign & verify (3.7, DESIGN B4)', () => {
  it('completes round-trip sign and verify with exp - iat = 300s', async () => {
    const nowSec = 1_800_000_000;
    const signed = await signRealtimeToken({
      userId: 'user-demo-1',
      secret: SECRET,
      nowSec,
    });

    expect(signed.token.split('.')).toHaveLength(3);
    expect(signed.exp - signed.iat).toBe(REALTIME_TOKEN_TTL_SEC);
    expect(signed.exp - signed.iat).toBe(300);
    expect(signed.expiresAt).toBe(signed.exp * 1000);

    const verified = await verifyRealtimeToken(signed.token, SECRET, {
      currentDate: new Date((nowSec + 10) * 1000),
    });
    expect(verified).toEqual({
      userId: 'user-demo-1',
      iat: nowSec,
      exp: nowSec + 300,
    });
  });

  it('rejects expired token with TOKEN_EXPIRED', async () => {
    const nowSec = 1_800_000_000;
    const signed = await signRealtimeToken({
      userId: 'user-demo-1',
      secret: SECRET,
      nowSec,
    });

    await expect(
      verifyRealtimeToken(signed.token, SECRET, {
        currentDate: new Date((nowSec + 301) * 1000),
      }),
    ).rejects.toMatchObject({
      name: 'RealtimeTokenError',
      code: 'TOKEN_EXPIRED',
    });
  });

  it('rejects token verified with wrong secret', async () => {
    const nowSec = 1_800_000_000;
    const signed = await signRealtimeToken({
      userId: 'user-demo-1',
      secret: SECRET,
      nowSec,
    });

    await expect(
      verifyRealtimeToken(signed.token, WRONG_SECRET, {
        currentDate: new Date((nowSec + 5) * 1000),
      }),
    ).rejects.toMatchObject({
      name: 'RealtimeTokenError',
      code: 'TOKEN_INVALID',
    });
  });

  it('rejects token tampered by 1 character in payload or signature', async () => {
    const nowSec = 1_800_000_000;
    const signed = await signRealtimeToken({
      userId: 'user-demo-1',
      secret: SECRET,
      nowSec,
    });

    const parts = signed.token.split('.');
    const sig = parts[2]!;
    const flipped = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
    const tampered = `${parts[0]}.${parts[1]}.${flipped}`;

    await expect(
      verifyRealtimeToken(tampered, SECRET, {
        currentDate: new Date((nowSec + 5) * 1000),
      }),
    ).rejects.toBeInstanceOf(RealtimeTokenError);
  });

  it('rejects missing or short secret and empty userId', async () => {
    await expect(
      signRealtimeToken({ userId: '', secret: SECRET }),
    ).rejects.toMatchObject({ code: 'INVALID_USER_ID' });

    await expect(
      signRealtimeToken({ userId: 'user-1', secret: 'short' }),
    ).rejects.toMatchObject({ code: 'INVALID_SECRET' });
  });
});
