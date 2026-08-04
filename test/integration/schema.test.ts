import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { resolve } from 'node:path';
import { avviaPostgres, fermaPostgres, applicaSchema, type UrlDatabase } from './postgres';

let url: UrlDatabase;

beforeAll(async () => {
  url = await avviaPostgres();
  applicaSchema(url, resolve(process.cwd(), 'prisma/schema.prisma'));

  // Il vincolo CHECK istanze_stato_esclusivo_chk e volutamente fuori dal
  // modello dichiarativo Prisma (vedi il commento "Vincolo non modellabile in
  // Prisma" in citta-semplice-office/prisma/migrations/0_init/migration.sql
  // righe 608-612): `db push` sincronizza solo cio che e in schema.prisma,
  // quindi non lo crea. Lo applichiamo qui, localmente a questo test di
  // caratterizzazione, cosi `applicaSchema` resta generico per i piani 2/3/4
  // (che sostituiranno proprio questo vincolo con StatoIstanza).
  const setup = new Client({ connectionString: url });
  await setup.connect();
  try {
    await setup.query(
      `ALTER TABLE "istanze" ADD CONSTRAINT "istanze_stato_esclusivo_chk" CHECK (("conclusa"::int + "respinta"::int + "in_bozza"::int) <= 1)`,
    );
  } finally {
    await setup.end();
  }
}, 120_000);

afterAll(async () => {
  await fermaPostgres();
});

describe('schema Prisma', () => {
  it('si applica a un database vuoto e crea le tabelle del dominio', async () => {
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      const { rows } = await client.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
      );
      const tabelle = rows.map((r) => r.table_name);
      expect(tabelle).toContain('istanze');
      expect(tabelle).toContain('servizi');
      expect(tabelle).toContain('workflows');
      expect(tabelle).toContain('fasi');
      expect(tabelle).toContain('steps');
    } finally {
      await client.end();
    }
  });

  it('impedisce a una istanza di essere insieme conclusa e respinta', async () => {
    // Caratterizza il vincolo CHECK che il piano 2 sostituira con StatoIstanza.
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      const { rows } = await client.query<{ conname: string }>(
        `SELECT conname FROM pg_constraint WHERE conrelid = 'istanze'::regclass AND contype = 'c'`,
      );
      expect(rows.map((r) => r.conname)).toContain('istanze_stato_esclusivo_chk');
    } finally {
      await client.end();
    }
  });
});
