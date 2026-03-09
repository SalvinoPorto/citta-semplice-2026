import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    id: string;
    email: string;
    name: string;
    nome: string;
    cognome: string;
    ruoli: string[];
  }

  interface Session {
    user: User & {
      id: string;
      nome: string;
      cognome: string;
      ruoli: string[];
      entiIds: number[];
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    nome: string;
    cognome: string;
    ruoli: string[];
    entiIds: number[];
  }
}
