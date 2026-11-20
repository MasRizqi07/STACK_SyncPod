import { describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import {
  REALTIME_TOKEN_MAX_TTL_SEC,
  REALTIME_TOKEN_TTL_SEC,
  RealtimeTokenError,
  signRealtimeToken,
  verifyRealtimeToken,
} from '../src/server/realtime-token.js';

const VALID_SECRET = 'realtime-jwt-test-secret-32-bytes-ok!!';
const WRONG_SECRET = 'different-jwt-test-secret-32-bytes-no!';

describe('realtime token sign & verify table-driven suite (3.7, D39)', () => {
  const nowSec = 1_800_000_000;
  const key = new TextEncoder().encode(VALID_SECRET);

  it('1. valid round-trip: signs with HS256, 300s TTL, valid sub/iss/aud', async () => {
    const signed = await signRealtimeToken({
      userId: 'user-demo-1',
      secret: VALID_SECRET,
      nowSec,
    });

    expect(signed.token.split('.')).toHaveLength(3);
    expect(signed.exp - signed.iat).toBe(REALTIME_TOKEN_TTL_SEC);
    expect(signed.exp - signed.iat).toBe(300);
    expect(signed.expiresAt).toBe(signed.exp * 1000);

    const verified = await verifyRealtimeToken(signed.token, VALID_SECRET, {
      currentDate: new Date((nowSec + 10) * 1000),
    });
    expect(verified).toEqual({
      userId: 'user-demo-1',
      iat: nowSec,
      exp: nowSec + 300,
    });
  });

  it('2. expired token: rejects when past expiration time + 5s clock tolerance', async () => {
    const signed = await signRealtimeToken({
      userId: 'user-demo-1',
      secret: VALID_SECRET,
      nowSec,
    });

    await expect(
      verifyRealtimeToken(signed.token, VALID_SECRET, {
        currentDate: new Date((nowSec + 306) * 1000), // 306s > 300s + 5s clock tolerance
      }),
    ).rejects.toMatchObject({
      name: 'RealtimeTokenError',
      code: 'TOKEN_EXPIRED',
    });
  });

  it('3. wrong secret: rejects token signed with one secret and verified with another', async () => {
    const signed = await signRealtimeToken({
      userId: 'user-demo-1',
      secret: VALID_SECRET,
      nowSec,
    });

    await expect(
      verifyRealtimeToken(signed.token, WRONG_SECRET, {
        currentDate: new Date((nowSec + 10) * 1000),
      }),
    ).rejects.toMatchObject({
      name: 'RealtimeTokenError',
      code: 'TOKEN_INVALID',
    });
  });

  it('4. alg: none rejected: unsecure JWT is rejected', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: 'user-demo-1',
        iss: 'syncpod-web',
        aud: 'syncpod-realtime',
        iat: nowSec,
        exp: nowSec + 300,
      }),
    ).toString('base64url');
    const unsignedToken = `${header}.${payload}.`;

    await expect(
      verifyRealtimeToken(unsignedToken, VALID_SECRET, {
        currentDate: new Date((nowSec + 10) * 1000),
      }),
    ).rejects.toMatchObject({
      name: 'RealtimeTokenError',
      code: 'TOKEN_INVALID',
    });
  });

  it('5. alg: HS512 rejected: only HS256 is accepted by verifier', async () => {
    const hs512Secret = 'extended-secret-for-hs512-testing-needs-to-be-at-least-64-bytes-long-ok-12345';
    const hs512Key = new TextEncoder().encode(hs512Secret);
    const tokenHs512 = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS512', typ: 'JWT' })
      .setSubject('user-demo-1')
      .setIssuer('syncpod-web')
      .setAudience('syncpod-realtime')
      .setIssuedAt(nowSec)
      .setExpirationTime(nowSec + 300)
      .sign(hs512Key);

    await expect(
      verifyRealtimeToken(tokenHs512, VALID_SECRET, {
        currentDate: new Date((nowSec + 10) * 1000),
      }),
    ).rejects.toMatchObject({
      name: 'RealtimeTokenError',
      code: 'TOKEN_INVALID',
    });
  });

  it('6. wrong audience (aud): rejects tokens minted for different target', async () => {
    const badAudToken = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject('user-demo-1')
      .setIssuer('syncpod-web')
      .setAudience('wrong-service')
      .setIssuedAt(nowSec)
      .setExpirationTime(nowSec + 300)
      .sign(key);

    await expect(
      verifyRealtimeToken(badAudToken, VALID_SECRET, {
        currentDate: new Date((nowSec + 10) * 1000),
      }),
    ).rejects.toMatchObject({
      name: 'RealtimeTokenError',
      code: 'TOKEN_INVALID',
    });
  });

  it('7. wrong issuer (iss): rejects tokens minted by untrusted issuer', async () => {
    const badIssToken = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject('user-demo-1')
      .setIssuer('untrusted-issuer')
      .setAudience('syncpod-realtime')
      .setIssuedAt(nowSec)
      .setExpirationTime(nowSec + 300)
      .sign(key);

    await expect(
      verifyRealtimeToken(badIssToken, VALID_SECRET, {
        currentDate: new Date((nowSec + 10) * 1000),
      }),
    ).rejects.toMatchObject({
      name: 'RealtimeTokenError',
      code: 'TOKEN_INVALID',
    });
  });

  it('8. empty subject (sub): rejects token with empty or whitespace userId', async () => {
    const emptySubToken = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject('')
      .setIssuer('syncpod-web')
      .setAudience('syncpod-realtime')
      .setIssuedAt(nowSec)
      .setExpirationTime(nowSec + 300)
      .sign(key);

    await expect(
      verifyRealtimeToken(emptySubToken, VALID_SECRET, {
        currentDate: new Date((nowSec + 10) * 1000),
      }),
    ).rejects.toMatchObject({
      name: 'RealtimeTokenError',
      code: 'TOKEN_INVALID',
    });
  });

  it('9. tampered payload: rejects token when payload byte is modified', async () => {
    const signed = await signRealtimeToken({
      userId: 'user-demo-1',
      secret: VALID_SECRET,
      nowSec,
    });

    const parts = signed.token.split('.');
    const decodedPayload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8'));
    decodedPayload.sub = 'user-hacker';
    const tamperedPayload = Buffer.from(JSON.stringify(decodedPayload)).toString('base64url');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    await expect(
      verifyRealtimeToken(tamperedToken, VALID_SECRET, {
        currentDate: new Date((nowSec + 10) * 1000),
      }),
    ).rejects.toMatchObject({
      name: 'RealtimeTokenError',
      code: 'TOKEN_INVALID',
    });
  });

  it('10. exp too far: rejects token where exp - iat > 600 seconds (10 minutes)', async () => {
    const tooLongToken = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject('user-demo-1')
      .setIssuer('syncpod-web')
      .setAudience('syncpod-realtime')
      .setIssuedAt(nowSec)
      .setExpirationTime(nowSec + 601) // 601s > 600s
      .sign(key);

    await expect(
      verifyRealtimeToken(tooLongToken, VALID_SECRET, {
        currentDate: new Date((nowSec + 10) * 1000),
      }),
    ).rejects.toMatchObject({
      name: 'RealtimeTokenError',
      code: 'TOKEN_INVALID',
    });
  });

  it('11. secret too short: rejects signing or verifying with secret < 32 chars', async () => {
    await expect(
      signRealtimeToken({ userId: 'user-demo-1', secret: 'short-secret-under-32-chars!' }),
    ).rejects.toMatchObject({
      name: 'RealtimeTokenError',
      code: 'INVALID_SECRET',
    });

    await expect(
      verifyRealtimeToken('some.dummy.token', 'short-secret-under-32-chars!'),
    ).rejects.toMatchObject({
      name: 'RealtimeTokenError',
      code: 'INVALID_SECRET',
    });
  });
});
