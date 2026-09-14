import { S3Client } from '@aws-sdk/client-s3';

import { LocalStorageProvider } from './local';
import { S3StorageProvider } from './s3';
import type { StorageProvider } from './types';

export type { StorageProvider } from './types';
export { LocalStorageProvider } from './local';
export { S3StorageProvider, type S3StorageOptions } from './s3';
export { normalizzaChiave } from './percorso';

/**
 * `getStorage()` resta sincrona (come la versione che viveva in
 * citta-semplice-office/src/lib/storage.ts) per non toccare gli otto punti di
 * chiamata esistenti. Il costo è che l'SDK S3 viene caricato anche con driver
 * `local`: è codice server-side, quindi si paga una volta all'avvio del
 * processo e mai nel bundle client.
 */
let cache: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  cache ??= creaStorage();
  return cache;
}

/** Solo per i test: svuota il singleton così si può cambiare env fra i casi. */
export function azzeraStorageCache(): void {
  cache = null;
}

function creaStorage(): StorageProvider {
  const driver = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase();

  if (driver === 's3') {
    return creaS3();
  }
  if (driver !== 'local') {
    throw new Error(
      `STORAGE_DRIVER non valido: "${driver}". Valori ammessi: "local", "s3".`,
    );
  }
  if (process.env.NODE_ENV === 'production') {
    // Non è un errore: un'installazione a singola istanza col volume montato è
    // legittima. Ma con più replica i download fallirebbero a intermittenza —
    // sintomo difficile da diagnosticare, quindi lo diciamo all'avvio.
    console.warn(
      '[storage] STORAGE_DRIVER=local in produzione: gli allegati restano sul ' +
        'filesystem del singolo processo. Non replicabile orizzontalmente.',
    );
  }
  return new LocalStorageProvider(process.env.UPLOAD_DIR ?? '/data/uploads');
}

function creaS3(): StorageProvider {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error('STORAGE_DRIVER=s3 richiede S3_BUCKET');
  }

  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  // Garage e la maggior parte degli storage S3-compatibili on-premise non
  // servono il virtual-hosted style (bucket come sottodominio): quando c'è un
  // endpoint esplicito il path style è il default sensato.
  const forcePathStyle =
    (process.env.S3_FORCE_PATH_STYLE ?? (endpoint ? 'true' : 'false')) === 'true';

  const client = new S3Client({
    // S3 richiede una region anche quando l'implementazione la ignora. Garage
    // invece la verifica: va allineata a s3_region del suo garage.toml.
    region: process.env.S3_REGION ?? 'us-east-1',
    forcePathStyle,
    ...(endpoint ? { endpoint } : {}),
    // Senza credenziali esplicite l'SDK usa la catena di default (service
    // account IRSA, instance profile): è il caso normale su Kubernetes.
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
  });

  return new S3StorageProvider({ client, bucket, prefix: process.env.S3_PREFIX });
}
