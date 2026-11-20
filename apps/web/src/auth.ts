import NextAuth from 'next-auth';
import type { Provider } from 'next-auth/providers';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@syncpod/db';
import {
  isAllowedGoogleSignIn,
  isBotEmail,
  isDemoLoginEmail,
} from '@/lib/auth-policy';
import { getEnv } from '@/env';

const env = getEnv();
const providers: Provider[] = [];

if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    }),
  );
}

if (env.DEMO_MODE === 'true') {
  providers.push(
    Credentials({
      id: 'demo-login',
      name: 'Demo Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
      },
      async authorize(credentials) {
        if (getEnv().DEMO_MODE !== 'true') {
          return null;
        }

        const email = credentials?.email;
        if (typeof email !== 'string') return null;
        const normalized = email.trim().toLowerCase();

        // D8: Bots can NEVER log in
        if (isBotEmail(normalized)) {
          return null;
        }

        // D10: Only seeded demo accounts can sign in
        if (!isDemoLoginEmail(normalized)) {
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
  secret: env.AUTH_SECRET,
  providers,
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        const emailVerified = Boolean(
          (profile as { email_verified?: boolean } | null)?.email_verified,
        );
        if (
          !isAllowedGoogleSignIn({
            email: user.email,
            emailVerified,
            allowedDomainsCsv: getEnv().ALLOWED_EMAIL_DOMAINS,
          })
        ) {
          return false;
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
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
