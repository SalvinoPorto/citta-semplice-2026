// Il client vive in @citta/db: qui resta solo il re-export, così gli import
// esistenti (`@/lib/db/prisma`) continuano a funzionare senza modifiche.
export { prisma, prisma as default } from '@citta/db';
