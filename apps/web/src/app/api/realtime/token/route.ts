import { NextResponse } from 'next/server';
import { signRealtimeToken } from '@syncpod/shared/realtime-token';
import { auth } from '@/auth';

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      {
        status: 401,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }

  const secret = process.env.REALTIME_JWT_SECRET;
  if (!secret || secret.trim().length < 16) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Realtime token secret is not configured' } },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }

  const { token, expiresAt } = await signRealtimeToken({
    userId,
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
