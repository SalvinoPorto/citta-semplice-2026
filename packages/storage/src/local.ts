import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { normalizzaChiave } from './percorso';
import type { StorageProvider } from './types';

/**
 * Storage su filesystem: va bene in sviluppo e con una sola istanza in
 * esecuzione. Con più replica dietro un bilanciatore NON è utilizzabile —
 * la replica che scrive non è quella che poi serve il download.
 */
export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly baseDir: string) {}

  async save(percorsoRelativo: string, dati: Buffer): Promise<void> {
    const percorsoAssoluto = join(this.baseDir, normalizzaChiave(percorsoRelativo));
    await mkdir(dirname(percorsoAssoluto), { recursive: true });
    await writeFile(percorsoAssoluto, dati);
  }

  async read(percorsoRelativo: string): Promise<Buffer<ArrayBuffer>> {
    return readFile(join(this.baseDir, normalizzaChiave(percorsoRelativo)));
  }
}
