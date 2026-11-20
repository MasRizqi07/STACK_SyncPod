import { describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

let mockSession: { user?: { id?: string; name?: string; email?: string } } | null = null;
const mockRedirect = vi.fn((url: string) => {
  const err = new Error(`NEXT_REDIRECT:${url}`);
  (err as { digest?: string }).digest = `NEXT_REDIRECT;replace;${url};307;;`;
  throw err;
});

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock('../src/auth', () => ({
  auth: vi.fn(async () => mockSession),
}));

import { requireSession } from '../src/lib/session';

describe('requireSession helper (3.6, D38)', () => {
  it('redirects to /masuk for page context when user has no active session', async () => {
    mockSession = null;
    mockRedirect.mockClear();

    await expect(requireSession('page')).rejects.toThrow('NEXT_REDIRECT:/masuk');
    expect(mockRedirect).toHaveBeenCalledWith('/masuk');
  });

  it('returns user session for page context when user is authenticated', async () => {
    mockSession = {
      user: {
        id: 'user-rizqi-1',
        name: 'Rizqi Pratama',
        email: 'demo-1@demo.syncpod.local',
      },
    };

    const res = await requireSession('page');
    expect(res).toEqual({
      userId: 'user-rizqi-1',
      name: 'Rizqi Pratama',
      email: 'demo-1@demo.syncpod.local',
    });
  });

  it('returns 401 NextResponse with Cache-Control: no-store for api context when unauthenticated', async () => {
    mockSession = null;

    const res = await requireSession('api');
    expect(res).toBeInstanceOf(NextResponse);
    const jsonRes = res as NextResponse;
    expect(jsonRes.status).toBe(401);
    expect(jsonRes.headers.get('Cache-Control')).toBe('no-store');

    const body = await jsonRes.json();
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns user session for api context when authenticated', async () => {
    mockSession = {
      user: {
        id: 'user-rifqi-2',
        name: 'Rifqi Hidayat',
        email: 'demo-2@demo.syncpod.local',
      },
    };

    const res = await requireSession('api');
    expect(res).not.toBeInstanceOf(NextResponse);
    expect(res).toEqual({
      userId: 'user-rifqi-2',
      name: 'Rifqi Hidayat',
      email: 'demo-2@demo.syncpod.local',
    });
  });
});
