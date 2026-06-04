# Scalability — Designed for 100 GB to 800 GB

> **Hard constraint:** client production databases are **100 GB today, growing toward
> 800 GB**. Every decision below assumes that scale. A query pattern that is fine on
> 1 GB can take down an 800 GB table. This document is the rulebook.

This applies **only to production PostgreSQL**. The demo (PGlite/IndexedDB) holds a few
thousand mock rows and never approaches this scale — do not conflate the two.

---

## 1. The cardinal rules (non-negotiable)

| Rule | Why |
| --- | --- |
| **No `SELECT *`** | At 800 GB, fetching unused columns wastes I/O and breaks index-only scans. Select explicit columns. |
| **No `OFFSET` pagination** | `OFFSET 1000000` scans and discards a million rows every page. Use **keyset (cursor) pagination**. |
| **No unbounded queries** | Every list endpoint has a hard `LIMIT`. No "fetch all orders". |
| **Index before you ship** | Any column used in `WHERE`, `JOIN`, or `ORDER BY` on a large table must be indexed. Verify with `EXPLAIN (ANALYZE, BUFFERS)`. |
| **Scope by `master_fn` + `company_fn` first** | The multi-tenant filter is the most selective predicate — it must be the leading columns of composite indexes. |

---

## 2. Keyset pagination (the OFFSET replacement)

❌ **Never:**
```sql
SELECT id, doc_no, total FROM sales_order
ORDER BY created_at DESC
OFFSET 500000 LIMIT 50;          -- scans 500050 rows
```

✅ **Always** — page by the last seen key:
```sql
SELECT id, doc_no, total, created_at
FROM sales_order
WHERE master_fn = $1 AND company_fn = $2
  AND (created_at, id) < ($3, $4)   -- last row from previous page
ORDER BY created_at DESC, id DESC
LIMIT 50;                            -- scans 50 rows, any page depth
```

Index to support it:
```sql
CREATE INDEX idx_so_tenant_created
  ON sales_order (master_fn, company_fn, created_at DESC, id DESC);
```

Keyset pagination is **O(page size)** regardless of how deep the user pages — the only
viable approach at 800 GB.

---

## 3. Partitioning the big tables

A few tables dominate ERP volume: transaction lines, ledger entries, audit log, stock
movements. At 100 GB+ these are partitioned, usually by **range on date** (monthly or
yearly), sometimes sub-partitioned by `company_fn`.

```sql
CREATE TABLE gl_entry (
    id          bigint GENERATED ALWAYS AS IDENTITY,
    master_fn   text NOT NULL,
    company_fn  text NOT NULL,
    posted_at   timestamptz NOT NULL,
    account_id  bigint NOT NULL,
    amount      numeric(18,2) NOT NULL
) PARTITION BY RANGE (posted_at);

CREATE TABLE gl_entry_2026 PARTITION OF gl_entry
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
```

Benefits at scale:
- **Partition pruning** — date-ranged queries touch only relevant partitions.
- **Cheap archival** — drop/detach an old partition instead of a mass `DELETE`.
- **Smaller indexes** — per-partition indexes stay in memory.

Use a partition-management tool (e.g. `pg_partman`) to auto-create future partitions.

---

## 4. Indexing strategy

- **Composite, tenant-leading:** `(master_fn, company_fn, <filter>, <sort>)`.
- **Partial indexes** for hot subsets: `WHERE status = 'open'` — index only open orders,
  not the full closed history.
- **Covering indexes** (`INCLUDE`) to enable index-only scans for hot read paths.
- **BRIN** indexes for naturally ordered append-only columns (e.g. `posted_at` on the
  ledger) — tiny footprint on huge tables.
- **Audit, don't guess:** `EXPLAIN (ANALYZE, BUFFERS)` every hot query against a
  production-sized dataset. Watch for `Seq Scan` on large tables and high `OFFSET` shared
  buffer reads.

Over-indexing hurts writes and bloats the DB — index the queries you actually run, then
prune unused indexes (`pg_stat_user_indexes`).

---

## 5. Connection pooling

Node + PostgreSQL must **never** open one connection per request. At scale:

- App-level pool (`pg.Pool`) with a sane `max`.
- **PgBouncer** in front of PostgreSQL in transaction-pooling mode for high concurrency.
- Keep transactions short — a long-held transaction at 800 GB blocks autovacuum and
  bloats the table.

See [DEPLOYMENT.md](DEPLOYMENT.md#2-postgresql-tuning-100800-gb) for `postgresql.conf` settings.

---

## 6. Vacuum & bloat management

At 800 GB, autovacuum tuning is survival, not optimization:

- Raise `autovacuum_vacuum_cost_limit`; lower `autovacuum_vacuum_scale_factor` on big
  tables so vacuum runs *before* bloat explodes.
- Monitor dead tuples (`pg_stat_user_tables.n_dead_tup`).
- Avoid mass `UPDATE`/`DELETE` — they generate dead tuples by the million. Prefer
  partition detach for bulk removal.

---

## 7. Read scaling

When reporting load grows:

- **Read replicas** (streaming replication) serve heavy reports and dashboards; the
  primary handles writes.
- Route read-only report queries to a replica via a separate connection string.
- Consider **materialized views** for expensive aggregate reports, refreshed on a
  schedule (`REFRESH MATERIALIZED VIEW CONCURRENTLY`).

---

## 8. Archival lifecycle

800 GB is mostly cold history. Strategy:

1. Hot data (current + previous year) on the primary, fully indexed.
2. Cold partitions detached and moved to cheaper storage or an archive schema.
3. Reports that need history query the archive explicitly, not the hot path.

This keeps the **working set** small even as total size grows.

---

## 9. What the demo must NOT inherit

The PGlite demo deliberately ignores all of the above (no partitioning, small dataset).
That is fine — **the demo proves the UI and flows, not the scale.** Never benchmark or
size-test against the demo. Scale verification happens only against production-sized
PostgreSQL. See [DEMO_MODE.md](DEMO_MODE.md).

---

## 10. Checklist before any large-table feature ships

- [ ] No `SELECT *`; explicit columns only.
- [ ] Pagination is keyset, not `OFFSET`.
- [ ] Every `WHERE`/`JOIN`/`ORDER BY` column is indexed, tenant-leading.
- [ ] `EXPLAIN (ANALYZE, BUFFERS)` checked against a 100 GB+ sample — no seq scans on big tables.
- [ ] Bulk delete uses partition detach, not `DELETE`.
- [ ] Transaction scope is short; no long-held locks.
- [ ] Heavy report routed to replica / materialized view where applicable.
