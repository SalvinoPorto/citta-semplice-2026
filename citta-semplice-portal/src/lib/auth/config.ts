import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/db/prisma';
import { verifySsoToken } from './sso-token';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    // ── Provider 1: codice fiscale + password (backoffice / testing) ──────
    CredentialsProvider({
      id: 'credentials',
      name: 'Credenziali',
      credentials: {
        codiceFiscale: { label: 'Codice Fiscale', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.codiceFiscale) return null;

        const utente = await prisma.utente.findUnique({
          where: { codiceFiscale: String(credentials.codiceFiscale).toUpperCase() },
        });

        if (!utente) return null;

        return {
          id: String(utente.id),
          name: `${utente.nome} ${utente.cognome}`,
          email: utente.email ?? undefined,
          codiceFiscale: utente.codiceFiscale,
        };
      },
    }),

    // ── Provider 2: CIG SSO (SPID / CIE) ─────────────────────────────────
    // The callback route validates the CIG TID, upserts the user, then
    // issues a short-lived signed token that is passed here for final
    // session creation. This avoids any server-side state between the
    // callback and the next-auth session.
    CredentialsProvider({
      id: 'cig-sso',
      name: 'SPID / CIE',
      credentials: {
        ssoToken: { label: 'SSO Token', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.ssoToken) return null;

        const codiceFiscale = verifySsoToken(String(credentials.ssoToken));
        if (!codiceFiscale) return null;

        const utente = await prisma.utente.findUnique({
          where: { codiceFiscale },
        });

        if (!utente) return null;

        return {
          id: String(utente.id),
          name: `${utente.nome} ${utente.cognome}`,
          email: utente.email ?? undefined,
          codiceFiscale: utente.codiceFiscale,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.codiceFiscale = (user as { codiceFiscale?: string }).codiceFiscale;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { codiceFiscale?: string }).codiceFiscale =
          token.codiceFiscale as string;
      }
      return session;
    },
  },

  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: parseInt(process.env.JWT_EXPIRATION_HOURS ?? '1', 10) * 3600,
  },
});
