// L'implementazione vive in @citta/storage (condivisa con il portal): qui resta
// solo il re-export, così gli import esistenti (`@/lib/storage`) continuano a
// funzionare senza modifiche.
export { getStorage, type StorageProvider } from '@citta/storage';
