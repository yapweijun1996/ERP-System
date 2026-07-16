// Standalone seed entry point (TASK-012 / Makefile `make seed`, `docker compose exec
// api npm run seed`). Unlike src/demo.ts (which seeds AND runs the full assertion +
// concurrency proof suite, intended for CI/manual verification), this does exactly one
// thing: seed the SG + MY demo companies into PostgreSQL via DATABASE_URL. seedDemo()
// itself is plain inserts (no ON CONFLICT) and throws on a second run, so this guards
// with isSeeded() first — safe to run `make seed` / `docker compose exec api npm run
// seed` more than once.
import { createPostgresDb } from './data/db';
import { seedDemo, isSeeded } from './data/seed';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[erp-system-seed] DATABASE_URL is required. Example:');
  console.error('  DATABASE_URL=postgres://user:pass@localhost:5432/erp npm run seed');
  process.exit(1);
}

const db = await createPostgresDb(url);
if (await isSeeded(db)) {
  console.log('[erp-system-seed] Already seeded (master row exists) — nothing to do.');
} else {
  await seedDemo(db);
  console.log('[erp-system-seed] Seed complete (Acme SG + Acme MY).');
}
process.exit(0);
