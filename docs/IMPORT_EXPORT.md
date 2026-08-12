# Import & Export

Two completely different needs are often lumped together. Keep them separate.

| Need | Audience | Scale | Tool |
| --- | --- | --- | --- |
| **A. Data import/export** | End users | Small (one module, a selection) | CSV / Excel in-app |
| **B. Database backup/restore** | Admins / DevOps | 100–800 GB | Physical backup, not the app |

Current boundary (2026-08-12): several deliberately bounded imports and artifact exports
are implemented; there is no universal import/export framework or streaming large-file
service.
TASK-192 recorded custom dumps, archive validation and one isolated restore rehearsal for
the then-small deployment/reset checkpoint. The repository does not yet prove encrypted
retention, physical backup, WAL/PITR, a timed 100–800 GB restore or declared RPO/RTO;
those remain TASK-201, so the large-scale strategy below is a requirement rather than a
deployed capability.

---

## A. User-level import/export (CSV / Excel)

For business users moving *bounded* data — e.g. import a product list, export this
month's invoices.

### Target rules for new large exports

- Stream with a server cursor when the declared bound can exceed safe process memory.
- Always bind export authority and scope to a Company plus explicit filters; do not add
  an unbounded "export everything" action.
- Generate CSV/XLSX/PDF through a governed synchronous or background artifact boundary
  appropriate to the declared maximum.

### Target rules for new large imports
- Validate every row before insert; report row-level errors.
- Batch inserts inside a transaction; chunk large files (e.g. 1–5k rows per batch).
- Idempotency: use a natural key or upsert (`ON CONFLICT`) so re-running an import
  doesn't duplicate.
- Large imports run as a **background job**, not a blocking request.

### Current implementation matrix

| Flow | Formats and bound | Current semantics |
| --- | --- | --- |
| Customer staging/import (EPIC-046/TASK-082) | CSV; 250 rows; `code,name,industry` | Row decisions/errors, audited idempotent update-or-skip transaction in Demo/API |
| Company onboarding import | CSV/XLSX; 10 MB; 25,000 rows; 10 target types | Preflight plus atomic commit through the setup domain |
| Corporate-card statement import | CSV/XLSX; 5 MB; 1,000 rows | Strict schema, content hash/import-key replay control and transaction matching |
| Reporting artifacts | Profit & Loss XLSX/PDF | Leased background jobs produce governed stored artifacts |
| Reimbursement payment output | Bank CSV | Bounded batch artifact generated from authorized payout facts |
| Tax Evidence outputs | CSV/XLSX plus the governed pack formats | Frozen snapshot/artifact workflow with integrity and access controls |

Some current bounded generators intentionally build a complete Buffer, and current
bounded imports use synchronous transactions. Streaming cursors, chunking and generic
background import are requirements for a future high-volume flow, not present universal
behavior.

### Demo mode
In the PGlite demo, customer import parses CSV in the browser but sends normalized rows
through the shared TypeScript command used by PostgreSQL. Each other flow must document
its own Demo/API capability; the matrix above does not imply that every server artifact
worker exists in a static browser.

---

## B. Admin-level database backup & restore

This is **not** done through the application at 100–800 GB. The app-driven `pg_dump`
approach that works at 1 GB takes hours and locks resources at 800 GB.

### Logical backup — `pg_dump` / `pg_restore`
- Fine for **small databases or single-table extracts**.
- At 800 GB: impractical as a full backup (very slow, large output). Use only for
  targeted exports (one schema, one table).
- Use directory format + parallel jobs when you do use it:
  ```bash
  pg_dump -Fd -j 4 -f /backup/erp erp
  pg_restore -d erp -j 4 /backup/erp
  ```

### Physical backup — required target strategy at scale
- **`pg_basebackup`** or filesystem/volume **snapshots** for full-cluster backup.
- **WAL archiving** for **point-in-time recovery (PITR)** — restore to any moment, not
  just the last nightly dump.
- Tools: `pgBackRest` or `barman` automate base backup + WAL retention + parallel restore
  and are the standard for large PostgreSQL.

```text
Daily:   pg_basebackup (or pgBackRest backup)
Continuous: archive WAL segments
Restore: base backup + replay WAL to target time (PITR)
```

### Migration / data transfer between servers
- For moving an 800 GB database between hosts, prefer **physical replication** or
  `pgBackRest` restore over `pg_dump | psql`.
- For one-off bulk loads, `COPY` (not row-by-row `INSERT`) — orders of magnitude faster.

---

## Rule of thumb

> If a user clicks a button, it's **CSV/Excel of a bounded selection** (section A).
> If DevOps protects the whole 800 GB cluster, it's **physical backup + WAL/PITR**
> (section B). Never route a full-database backup through the application.

See also [SCALABILITY.md](SCALABILITY.md) for why mass operations must avoid `OFFSET`,
`SELECT *`, and big `DELETE`s.
