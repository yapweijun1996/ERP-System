# Import & Export

Two completely different needs are often lumped together. Keep them separate.

| Need | Audience | Scale | Tool |
| --- | --- | --- | --- |
| **A. Data import/export** | End users | Small (one module, a selection) | CSV / Excel in-app |
| **B. Database backup/restore** | Admins / DevOps | 100–800 GB | Physical backup, not the app |

---

## A. User-level import/export (CSV / Excel)

For business users moving *bounded* data — e.g. import a product list, export this
month's invoices.

### Export
- Streamed, never "load all into memory then send". At scale, stream rows to CSV with a
  server cursor.
- Always bounded by a filter (date range, status, company) — no "export everything".
- Format: CSV (universal) and/or XLSX.

### Import
- Validate every row before insert; report row-level errors.
- Batch inserts inside a transaction; chunk large files (e.g. 1–5k rows per batch).
- Idempotency: use a natural key or upsert (`ON CONFLICT`) so re-running an import
  doesn't duplicate.
- Large imports run as a **background job**, not a blocking request.

### Demo mode
In the PGlite demo, export = download a JSON/CSV file from the browser; import = upload a
file parsed into PGlite. Same UI, no server round-trip.

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

### Physical backup — the real strategy at scale
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
