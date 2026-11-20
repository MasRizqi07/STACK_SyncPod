import { NextResponse } from 'next/server';
import { signRealtimeToken } from '@syncpod/shared/server';
import { requireSession } from '@/lib/session';
import { getEnv } from '@/env';

export async function GET() {
  // D38 defense-in-depth: route handler requires authenticated session
  const sessionOrRes = await requireSession('api');
  if (sessionOrRes instanceof NextResponse) {
    return sessionOrRes;
  }

  const secret = getEnv().REALTIME_JWT_SECRET;
  if (!secret || secret.trim().length < 32) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Realtime token secret is not configured' } },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }

  const { token, expiresAt } = await signRealtimeToken({
    userId: sessionOrRes.userId,
    secret,
  });

  return NextResponse.json(
    { token, expiresAt },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
