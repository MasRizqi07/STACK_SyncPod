import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export interface SessionUser {
  userId: string;
  name: string;
  email?: string | null;
}

export async function requireSession(context: 'page'): Promise<SessionUser>;
export async function requireSession(context: 'api'): Promise<SessionUser | NextResponse>;
export async function requireSession(
  context: 'page' | 'api' = 'page',
): Promise<SessionUser | NextResponse> {
  const session = await auth();
  const user = session?.user;
  const userId = user?.id;

  if (!user || !userId) {
    if (context === 'page') {
      redirect('/masuk');
    }
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return {
    userId,
    name: user.name || 'Mahasiswa',
    email: user.email,
  };
}
