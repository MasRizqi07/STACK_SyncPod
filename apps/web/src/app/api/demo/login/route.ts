import { NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';
import { db } from '@syncpod/db';

export async function POST(request: Request) {
  if (process.env.DEMO_MODE !== 'true') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Demo mode is disabled' } },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_FAILED', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const email = (body as { email?: unknown })?.email;
  if (typeof email !== 'string') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_FAILED', message: 'Email is required' } },
      { status: 400 },
    );
  }

  const normalized = email.trim().toLowerCase();

  // D8: Bots can NEVER log in
  if (
    normalized.endsWith('@bot.syncpod.local') ||
    normalized.startsWith('simulasi-')
  ) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Bot accounts cannot log in' } },
      { status: 403 },
    );
  }

  // D10: Only seeded demo accounts can sign in
  if (!/^demo-[1-4]@demo\.syncpod\.local$/.test(normalized)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Only seeded demo accounts can log in' } },
      { status: 403 },
    );
  }

  const user = await db.user.findUnique({
    where: { email: normalized },
  });

  if (!user) {
    return NextResponse.json(
      { error: { code: 'USER_NOT_FOUND', message: 'User not found in database' } },
      { status: 404 },
    );
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const cookieName = isProduction
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token';

  const secret = process.env.AUTH_SECRET || 'syncpod-dev-secret-auth-32bytes-syncpod!!';

  const token = await encode({
    token: {
      sub: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      universityName: user.universityName,
      picture: user.image,
    },
    secret,
    salt: cookieName,
    maxAge: 30 * 24 * 60 * 60,
  });

  const response = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      universityName: user.universityName,
    },
  });

  response.cookies.set({
    name: cookieName,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });

  return response;
}
