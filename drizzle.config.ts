import { defineConfig } from 'drizzle-kit';

// Generates SQL DDL from the schema offline (no DB connection needed for `generate`).
// The same schema is applied to PGlite (demo) and PostgreSQL (production).
export default defineConfig({
  schema: './src/data/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
});
