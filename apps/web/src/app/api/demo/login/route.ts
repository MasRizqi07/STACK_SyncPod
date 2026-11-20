import { NextResponse } from 'next/server';
import { db } from '@syncpod/db';
import { signIn } from '@/auth';
import { isBotEmail, isDemoLoginEmail } from '@/lib/auth-policy';
import { getEnv } from '@/env';

export async function POST(request: Request) {
  if (getEnv().DEMO_MODE !== 'true') {
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

    return NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'digest' in err &&
      typeof (err as { digest?: unknown }).digest === 'string' &&
      ((err as { digest: string }).digest.startsWith('NEXT_REDIRECT') ||
        (err as { digest: string }).digest.startsWith('NEXT_URL_REDIRECT'))
    ) {
      return NextResponse.json(
        {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { error: { code: 'AUTH_FAILED', message: 'Failed to sign in demo user' } },
      { status: 500 },
    );
  }
}
