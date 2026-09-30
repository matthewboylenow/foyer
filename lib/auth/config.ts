import NextAuth from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { users, accounts, sessions, verificationTokens } from '@/lib/db/schema';
import { verifyOtp } from './otp';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_ENTRA_ID ?? '',
      clientSecret: process.env.AUTH_ENTRA_SECRET ?? '',
      issuer: process.env.AUTH_ENTRA_TENANT
        ? `https://login.microsoftonline.com/${process.env.AUTH_ENTRA_TENANT}/v2.0`
        : undefined,
    }),
    Credentials({
      id: 'email-otp',
      name: 'Email OTP',
      credentials: {
        email: { label: 'Email', type: 'email' },
        code: { label: 'Code', type: 'text' },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? '').toLowerCase().trim();
        const code = String(credentials?.code ?? '').trim();
        if (!email || !code) return null;

        const result = await verifyOtp(email, code);
        if (!result.ok) return null;

        // Find or create the user
        let user = await db.query.users.findFirst({
          where: eq(users.email, email),
        });

        if (!user) {
          const [created] = await db
            .insert(users)
            .values({ id: crypto.randomUUID(), email, name: email.split('@')[0] })
            .returning();
          user = created;
        }

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  // Credentials (email OTP) sign-in only works with JWT sessions — Auth.js
  // never writes a database session for a Credentials login, so with
  // strategy 'database' the code verified and then nothing happened. The
  // adapter stays for the Entra ID provider's account linking.
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token?.id) session.user.id = String(token.id);
      return session;
    },
  },
});
