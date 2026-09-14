// L'implementazione vive in @citta/documenti, condivisa con l'office: il
// drenatore (/api/cron/protocollazione) deve poter rigenerare la ricevuta dopo
// aver rettificato il protocollo col numero vero dell'ente, e prima questo
// codice era raggiungibile solo dal portale.
//
// Qui resta il solo re-export, come per `@/lib/db/prisma` e `@/lib/storage`:
// i punti d'uso continuano a importare da
// `@/lib/services/documenti/DocumentiService` senza modifiche, e la definizione
// resta scritta in un posto solo.
export * from '@citta/documenti';
