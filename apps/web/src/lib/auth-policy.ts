import { BOT_EMAIL_SET, DEMO_EMAIL_SET } from '@syncpod/shared';

export function isBotEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  return (
    BOT_EMAIL_SET.has(normalized) ||
    normalized.endsWith('@bot.syncpod.local') ||
    normalized.startsWith('simulasi-')
  );
}

export function isDemoLoginEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  return DEMO_EMAIL_SET.has(normalized);
}

export interface GoogleSignInParams {
  email?: string | null;
  emailVerified?: boolean | null;
  allowedDomainsCsv?: string | null;
}

export function isAllowedGoogleSignIn({
  email,
  emailVerified,
  allowedDomainsCsv,
}: GoogleSignInParams): boolean {
  // Reject if email is not verified
  if (emailVerified !== true) {
    return false;
  }

  if (!email || typeof email !== 'string') {
    return false;
  }

  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf('@');
  if (atIndex <= 0) {
    return false;
  }

  const domain = normalized.slice(atIndex + 1);

  const allowedDomains = allowedDomainsCsv
    ?.split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  // If no allowed domains are configured, allow any verified Google account
  if (!allowedDomains || allowedDomains.length === 0) {
    return true;
  }

  return allowedDomains.includes(domain);
}
