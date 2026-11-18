export function isBotEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return (
    normalized.endsWith('@bot.syncpod.local') ||
    normalized.startsWith('simulasi-')
  );
}

export function isSeededDemoEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return /^demo-[1-4]@demo\.syncpod\.local$/.test(normalized);
}

export function isAllowedEmailDomain(
  email: string | null | undefined,
  allowedDomainsCsv: string | undefined,
): boolean {
  const allowedDomains = allowedDomainsCsv
    ?.split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  if (!allowedDomains || allowedDomains.length === 0) {
    return true;
  }

  const normalized = email?.trim().toLowerCase() ?? '';
  const atIndex = normalized.lastIndexOf('@');
  if (atIndex <= 0) {
    return false;
  }

  const domain = normalized.slice(atIndex + 1);
  return allowedDomains.includes(domain);
}

export function isSecureRequest(request: Request): boolean {
  const forwardedProto = request.headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim()
    .toLowerCase();
  if (forwardedProto === 'https') {
    return true;
  }
  if (forwardedProto === 'http') {
    return false;
  }
  try {
    return new URL(request.url).protocol === 'https:';
  } catch {
    return false;
  }
}

export function getSessionCookieName(secure: boolean): string {
  return secure ? '__Secure-authjs.session-token' : 'authjs.session-token';
}
