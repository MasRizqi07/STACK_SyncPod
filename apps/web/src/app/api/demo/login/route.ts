import { NextResponse } from 'next/server';
import { db } from '@syncpod/db';
import { signIn } from '@/auth';
import { isBotEmail, isDemoLoginEmail } from '@/lib/auth-policy';

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
  if (!isDemoLoginEmail(normalized)) {
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

  try {
    await signIn('demo-login', {
      email: normalized,
      redirect: false,
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        universityName: user.universityName,
      },
    });
  } catch (error) {
    console.error('[demo/login] signIn error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Sign in failed',
        },
      },
      { status: 500 },
    );
  }
}
