import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { S3Client } from '@aws-sdk/client-s3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LocalStorageProvider } from '../src/local';
import { normalizzaChiave } from '../src/percorso';
import { S3StorageProvider } from '../src/s3';

/** Stessa forma dei `nomeHash` reali: YYYY/MM/DD/<uuid>. Valore sintetico. */
const CHIAVE = '2026/09/12/00000000-0000-4000-8000-000000000000';
const CONTENUTO = Buffer.from('%PDF-1.4 contenuto sintetico');

describe('normalizzaChiave', () => {
  it('lascia intatta una chiave già normalizzata', () => {
    expect(normalizzaChiave(CHIAVE)).toBe(CHIAVE);
  });

  it('converte i backslash e collassa gli slash ripetuti', () => {
    expect(normalizzaChiave('2026\\09\\12//abc')).toBe('2026/09/12/abc');
  });

  it('rimuove lo slash iniziale', () => {
    expect(normalizzaChiave('/2026/09/12/abc')).toBe('2026/09/12/abc');
  });

  it('rifiuta il path traversal', () => {
    expect(() => normalizzaChiave('2026/../../etc/passwd')).toThrow();
    expect(() => normalizzaChiave('./abc')).toThrow();
  });

  it('rifiuta chiavi vuote o con byte NUL', () => {
    expect(() => normalizzaChiave('')).toThrow();
    expect(() => normalizzaChiave('   ')).toThrow();
    expect(() => normalizzaChiave('abc\0def')).toThrow();
  });
});

describe('LocalStorageProvider', () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = await mkdtemp(join(tmpdir(), 'citta-storage-'));
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it('scrive e rilegge lo stesso contenuto, creando le directory intermedie', async () => {
    const storage = new LocalStorageProvider(baseDir);
    await storage.save(CHIAVE, CONTENUTO);
    expect(await storage.read(CHIAVE)).toEqual(CONTENUTO);
  });

  it('non permette di uscire dalla directory base', async () => {
    const storage = new LocalStorageProvider(baseDir);
    await expect(storage.save('../fuga', CONTENUTO)).rejects.toThrow();
    await expect(storage.read('../../etc/passwd')).rejects.toThrow();
  });
});

describe('S3StorageProvider', () => {
  /** Client finto: registra gli input dei comandi invece di parlare con S3. */
  function clientFinto() {
    const comandi: Array<Record<string, unknown>> = [];
    const finto = {
      async send(comando: { input: Record<string, unknown> }) {
        comandi.push(comando.input);
        return {
          Body: { transformToByteArray: async () => new Uint8Array(CONTENUTO) },
        };
      },
    };
    return { comandi, client: finto as unknown as S3Client };
  }

  it('usa il percorso relativo come chiave oggetto quando non c è prefisso', async () => {
    const { comandi, client } = clientFinto();
    const storage = new S3StorageProvider({ client, bucket: 'allegati' });

    await storage.save(CHIAVE, CONTENUTO, 'application/pdf');

    expect(comandi[0].Bucket).toBe('allegati');
    expect(comandi[0].Key).toBe(CHIAVE);
    expect(comandi[0].ContentType).toBe('application/pdf');
  });

  it('antepone il prefisso normalizzato', async () => {
    const { comandi, client } = clientFinto();
    const storage = new S3StorageProvider({ client, bucket: 'allegati', prefix: '/prod/' });

    await storage.save(CHIAVE, CONTENUTO);

    expect(comandi[0].Key).toBe(`prod/${CHIAVE}`);
    // Senza contentType esplicito non indoviniamo il tipo: in download viene
    // comunque preso da `allegati.mime_type` in database.
    expect(comandi[0].ContentType).toBe('application/octet-stream');
  });

  it('rilegge il corpo dell oggetto come Buffer', async () => {
    const { client } = clientFinto();
    const storage = new S3StorageProvider({ client, bucket: 'allegati' });

    expect(await storage.read(CHIAVE)).toEqual(CONTENUTO);
  });

  it('blocca il path traversal senza contattare S3', async () => {
    const { comandi, client } = clientFinto();
    const storage = new S3StorageProvider({ client, bucket: 'allegati' });

    await expect(storage.read('../../altro-bucket/segreto')).rejects.toThrow();
    expect(comandi).toHaveLength(0);
  });
});
