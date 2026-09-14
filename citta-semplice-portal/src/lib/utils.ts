// La definizione vive in @citta/form-schema, condivisa con @citta/documenti che
// la usa nei template PDF: qui resta il solo re-export, così i punti d'uso nel
// portale (`@/lib/utils`) continuano a funzionare senza modifiche e la regola
// resta scritta in un posto solo.
export { getCampoValue } from '@citta/form-schema';
