import { defineConfig } from 'drizzle-kit';

// `generate` needs no DB connection (offline DDL from the schema). `migrate` (and any
// future `push`/`studio`) needs one — DATABASE_URL, same env var src/data/db.ts and
// src/server.ts use. The same schema is applied to PGlite (demo) and PostgreSQL
// (production).
export default defineConfig({
  schema: './src/data/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
