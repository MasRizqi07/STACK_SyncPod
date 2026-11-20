import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  // D18: In fake prototype mode, no auth or network check occurs, and Auth.js is never imported
  // Literal member expression required by Next.js for build-time static inlining
  if (process.env.NEXT_PUBLIC_REALTIME_MODE === 'fake') {
    return NextResponse.next();
  }

  const { getToken } = await import('next-auth/jwt');
  const secret = process.env.AUTH_SECRET;
  const { pathname } = request.nextUrl;

  let token: Awaited<ReturnType<typeof getToken>> = null;
  if (secret) {
    try {
      token = await getToken({
        req: request,
        secret,
      });
    } catch {
      token = null;
    }
  }

  const isAuthenticated = Boolean(
    token && typeof token.sub === 'string' && token.sub.trim().length > 0,
  );

  // Authenticated users visiting /masuk are redirected to /pod (307)
  if (pathname === '/masuk') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/pod', request.url), 307);
    }
    return NextResponse.next();
  }

  // Realtime API endpoints require authentication (return 401 JSON)
  if (pathname.startsWith('/api/realtime')) {
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
        {
          status: 401,
          headers: { 'Cache-Control': 'no-store' },
        },
      );
    }
    return NextResponse.next();
  }

  // Protected pod pages: redirect unauthenticated requests to /masuk (307)
  if (pathname === '/pod' || pathname.startsWith('/pod/')) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/masuk', request.url), 307);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/pod', '/pod/:path*', '/api/realtime/:path*', '/masuk'],
};
