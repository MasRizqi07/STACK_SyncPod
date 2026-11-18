import { NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';
import { db } from '@syncpod/db';
import {
  getSessionCookieName,
  isBotEmail,
  isSecureRequest,
  isSeededDemoEmail,
} from '@/lib/auth-rules';

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
  if (isBotEmail(normalized)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Bot accounts cannot log in' } },
      { status: 403 },
    );
  }

  // D10: Only seeded demo accounts can sign in
  if (!isSeededDemoEmail(normalized)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Only seeded demo accounts can log in' } },
      { status: 403 },
    );
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.trim().length < 16) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Auth secret is not configured' } },
      { status: 500 },
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

  const secure = isSecureRequest(request);
  const cookieName = getSessionCookieName(secure);

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
    secure,
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });

  return response;
}
