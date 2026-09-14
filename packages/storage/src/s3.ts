import { GetObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';

import { normalizzaChiave } from './percorso';
import type { StorageProvider } from './types';

export type S3StorageOptions = {
  client: S3Client;
  bucket: string;
  /** Prefisso comune a tutte le chiavi, per condividere un bucket fra ambienti. */
  prefix?: string;
};

/**
 * Storage su object storage S3-compatibile (AWS S3, Garage, storage di cloud
 * qualificato). È il provider che rende le applicazioni replicabili: lo stato
 * dei file esce dal pod.
 */
export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;

  constructor({ client, bucket, prefix }: S3StorageOptions) {
    this.client = client;
    this.bucket = bucket;
    // Normalizziamo anche il prefisso, così `S3_PREFIX=/prod/` e `prod`
    // producono la stessa chiave finale.
    this.prefix = prefix && prefix.trim() !== '' ? normalizzaChiave(prefix) : '';
  }

  private chiave(percorsoRelativo: string): string {
    const chiave = normalizzaChiave(percorsoRelativo);
    return this.prefix ? `${this.prefix}/${chiave}` : chiave;
  }

  async save(percorsoRelativo: string, dati: Buffer, contentType?: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.chiave(percorsoRelativo),
        Body: dati,
        ContentLength: dati.length,
        ContentType: contentType ?? 'application/octet-stream',
      }),
    );
  }

  async read(percorsoRelativo: string): Promise<Buffer<ArrayBuffer>> {
    const chiave = this.chiave(percorsoRelativo);
    const risposta = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: chiave }),
    );
    if (!risposta.Body) {
      throw new Error(`Oggetto senza contenuto: ${chiave}`);
    }
    return Buffer.from(await risposta.Body.transformToByteArray());
  }
}
