import { config } from "dotenv";
import path from "node:path";
import { defineConfig } from "prisma/config";

// `dotenv/config` legge `.env` da `process.cwd()`. Va bene per `office`/`portal`,
// dove ogni script gira dalla propria cartella, ma non per @citta/db: gli script
// `db:*` vengono invocati con `npm run db:migrate -w @citta/db`, la cui cwd resta
// la radice del monorepo (o comunque non è garantita essere questa cartella).
// Puntiamo quindi esplicitamente a packages/db/.env (vedi .env.example), invece
// di affidarci alla cwd del processo chiamante.
config({ path: path.resolve(import.meta.dirname, ".env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
