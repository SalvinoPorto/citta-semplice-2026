import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import prisma from '@/lib/db/prisma';

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        userName: { label: 'Utente', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.userName || !credentials?.password) {
          throw new Error('Utente e password sono obbligatori');
        }

        const operatore = await prisma.operatore.findUnique({
          where: { userName: credentials.userName as string },
          include: {
            ruoli: {
              include: {
                ruolo: true,
              },
            },
          },
        });

        if (!operatore || !operatore.attivo) {
          throw new Error('Credenziali non valide');
        }

        const isPasswordValid = await compare(
          credentials.password as string,
          operatore.password
        );

        if (!isPasswordValid) {
          throw new Error('Credenziali non valide');
        }

        return {
          id: operatore.id.toString(),
          userName: operatore.userName,
          email: operatore.email,
          name: `${operatore.nome} ${operatore.cognome}`,
          nome: operatore.nome,
          cognome: operatore.cognome,
          ruoli: operatore.ruoli.map((r) => r.ruolo.nome),
          entiIds: [],
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 2 * 60 * 60, // 2 hours
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.nome = user.nome;
        token.cognome = user.cognome;
        token.ruoli = user.ruoli;
        token.entiIds = user.entiIds;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.nome = token.nome as string;
        session.user.cognome = token.cognome as string;
        session.user.ruoli = token.ruoli as string[];
        session.user.entiIds = token.entiIds as number[];
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = !nextUrl.pathname.startsWith('/login');
      const isApiAuth = nextUrl.pathname.startsWith('/api/auth');
      const isApiCron = nextUrl.pathname.startsWith('/api/cron');
      const isApiHealth = nextUrl.pathname.startsWith('/api/health');

      // Allow auth API, cron, and health endpoints
      if (isApiAuth || isApiCron || isApiHealth) {
        return true;
      }

      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false; // Redirect to login
      } else if (isLoggedIn) {
        return Response.redirect(new URL('/', nextUrl));
      }
      return true;
    },
  },
  debug: process.env.NODE_ENV === 'development',
};
