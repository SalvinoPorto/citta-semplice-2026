import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';

export interface StorageProvider {
  save(relativePath: string, data: Buffer): Promise<void>;
  read(relativePath: string): Promise<Buffer>;
}

class LocalStorageProvider implements StorageProvider {
  constructor(private baseDir: string) {}

  async save(relativePath: string, data: Buffer): Promise<void> {
    const fullPath = join(this.baseDir, relativePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, data);
  }

  async read(relativePath: string): Promise<Buffer> {
    return readFile(join(this.baseDir, relativePath));
  }
}

let _storage: StorageProvider | null = null;

// Returns the configured storage provider (singleton per process).
// Swap LocalStorageProvider for S3StorageProvider here when scaling out.
export function getStorage(): StorageProvider {
  if (!_storage) {
    _storage = new LocalStorageProvider(process.env.UPLOAD_DIR ?? '/data/uploads');
  }
  return _storage;
}
