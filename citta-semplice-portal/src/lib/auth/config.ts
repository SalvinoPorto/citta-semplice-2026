import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/db/prisma';
import { verifySsoToken } from './sso-token';

export const { handlers, signIn, signOut, auth } = NextAuth({
  cookies: {
    sessionToken: {
      name: 'portal.session-token',
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production' },
    },
    csrfToken: {
      name: 'portal.csrf-token',
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production' },
    },
    callbackUrl: {
      name: 'portal.callback-url',
      options: { sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production' },
    },
  },
  providers: [
    // ── CIG SSO (SPID / CIE): unico provider ─────────────────────────────
    // The callback route validates the CIG TID, upserts the user, then
    // issues a short-lived signed token that is passed here for final
    // session creation. This avoids any server-side state between the
    // callback and the next-auth session.
    //
    // NB: non aggiungere un provider "codice fiscale + password" per
    // testing. Ne esisteva uno che dichiarava il campo `password` ma non lo
    // verificava mai: bastava un codice fiscale per impersonare qualunque
    // cittadino. L'identità del cittadino si stabilisce solo via SPID/CIE.
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
