# Demo Mode (PGlite + IndexedDB)

The demo is the version deployed to GitHub Pages. It has **no backend server** — the
database runs entirely in the browser.

## 1. How it works

```
React UI → shared business logic → Drizzle → PGlite (Postgres WASM) → IndexedDB
```

- [PGlite](https://pglite.dev) is real PostgreSQL compiled to WebAssembly (~3 MB gzipped).
- It persists to the browser's **IndexedDB**, so data survives page reloads.
- On first load, the app **seeds mock data** (sample products, customers, orders) so the
  ERP looks alive immediately.

Because PGlite *is* Postgres, the demo runs the **same SQL, schema, and migrations** as
production. No second query dialect.

## 2. Build & run

```bash
npm run build:demo     # VITE_DATA_MODE=demo → dist/
npm run preview        # serve dist/ locally
```

The build inlines the demo data adapter and the seed dataset. No `DATABASE_URL`, no API.

## 3. Mock data

- Seed lives in `src/data/seed/` as plain data + insert statements.
- Seeded once per browser (guarded by a `seeded` flag in IndexedDB).
- "Reset demo" button clears IndexedDB and re-seeds.
- Keep the dataset **small** — a few hundred to a few thousand rows. The demo proves the
  UI and flows, not scale.

## 4. What the demo is NOT

| Misconception | Reality |
| --- | --- |
| "IndexedDB is the ERP database" | No. IndexedDB holds *demo mock data only*. Production is PostgreSQL. |
| "It can handle the client's 800 GB" | No. Browser storage is capped (hundreds of MB realistically). The 800 GB lives in production PostgreSQL. |
| "Demo performance reflects production" | No. Never benchmark scale against the demo. See [SCALABILITY.md](SCALABILITY.md#9-what-the-demo-must-not-inherit). |
| "Demo data is shared between users" | No. Each visitor has their own IndexedDB; nothing is sent to a server. |

## 5. Known limits

- **Storage quota:** IndexedDB is subject to per-origin browser quotas. Keep seed data
  small; the demo is a showcase, not a data store.
- **Single user:** no concurrency, no real auth — the demo user is a fixed sample account.
- **No server-only transactions:** flows that require server guarantees in production
  (advisory locks) run as ordinary client transactions in the demo. Correct for one user;
  not a multi-user guarantee.
- **PGlite feature coverage:** confirm any extension/function the schema needs is
  supported by the PGlite build (e.g. `pgvector` is supported; verify niche functions).
  If a required feature is missing, that query path needs a demo-specific fallback. This
  is the gating check noted in [ARCHITECTURE.md](ARCHITECTURE.md#3-why-pglite-not-dexie).

## 6. Why this is safe to make public

The demo bundle contains **only mock data** and client code. No credentials, no
connection strings, no customer data ever reach `dist/`. The production API and database
are a completely separate deploy target.
