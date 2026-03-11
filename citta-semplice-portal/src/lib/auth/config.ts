import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/db/prisma';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    CredentialsProvider({
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
        (session.user as { codiceFiscale?: string }).codiceFiscale = token.codiceFiscale as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
});
