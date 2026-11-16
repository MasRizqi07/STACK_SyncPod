import NextAuth from 'next-auth';
import type { Provider } from 'next-auth/providers';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@syncpod/db';

const providers: Provider[] = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  );
}

if (process.env.DEMO_MODE === 'true') {
  providers.push(
    Credentials({
      id: 'demo-login',
      name: 'Demo Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
      },
      async authorize(credentials) {
        if (process.env.DEMO_MODE !== 'true') {
          return null;
        }

        const email = credentials?.email;
        if (typeof email !== 'string') return null;
        const normalized = email.trim().toLowerCase();

        // D8: Bots can NEVER log in
        if (
          normalized.endsWith('@bot.syncpod.local') ||
          normalized.startsWith('simulasi-')
        ) {
          return null;
        }

        // D10: Only seeded demo accounts can sign in
        if (!/^demo-[1-4]@demo\.syncpod\.local$/.test(normalized)) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: normalized },
        });

        if (!user) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  providers,
  session: {
    strategy: 'jwt',
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === 'production'
          ? '__Secure-authjs.session-token'
          : 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const allowedDomains = process.env.ALLOWED_EMAIL_DOMAINS?.split(',')
          .map((d) => d.trim().toLowerCase())
          .filter(Boolean);

        if (allowedDomains && allowedDomains.length > 0) {
          const email = user.email?.toLowerCase() || '';
          const domain = email.split('@')[1];
          if (!domain || !allowedDomains.includes(domain)) {
            return false;
          }
        }
      }

      if (user.email) {
        await db.user.upsert({
          where: { email: user.email.toLowerCase() },
          update: {
            name: user.name || 'Mahasiswa',
            image: user.image || null,
          },
          create: {
            email: user.email.toLowerCase(),
            name: user.name || 'Mahasiswa',
            image: user.image || null,
          },
        });
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const dbUser = await db.user.findUnique({
          where: { email: user.email.toLowerCase() },
        });
        if (dbUser) {
          token.sub = dbUser.id;
          token.id = dbUser.id;
          token.name = dbUser.name;
          token.universityName = dbUser.universityName;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        (session.user as { universityName?: string }).universityName =
          token.universityName as string | undefined;
      }
      return session;
    },
  },
});
