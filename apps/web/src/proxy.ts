import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getSessionCookieName, isSecureRequest } from '@/lib/auth-rules';

export async function proxy(request: NextRequest) {
  // D18: In fake prototype mode, no auth or network check occurs
  if (process.env.NEXT_PUBLIC_REALTIME_MODE === 'fake') {
    return NextResponse.next();
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.redirect(new URL('/masuk', request.url), 307);
  }

  const secure = isSecureRequest(request);
  const cookieName = getSessionCookieName(secure);

  let token: Awaited<ReturnType<typeof getToken>> = null;
  try {
    token = await getToken({
      req: request,
      secret,
      secureCookie: secure,
      cookieName,
    });
  } catch {
    token = null;
  }

  if (!token || typeof token.sub !== 'string' || token.sub.length === 0) {
    return NextResponse.redirect(new URL('/masuk', request.url), 307);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/pod', '/pod/:path*'],
};
