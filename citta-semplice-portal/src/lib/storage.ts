// L'implementazione vive in @citta/storage (condivisa con l'office): qui resta
// solo il re-export, per coerenza con `@/lib/db/prisma` e per non spargere
// l'import del package nei singoli punti di chiamata.
export { getStorage, type StorageProvider } from '@citta/storage';
