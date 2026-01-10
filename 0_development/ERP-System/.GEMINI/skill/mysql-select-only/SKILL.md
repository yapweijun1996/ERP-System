---
name: mysql-select-only
description: "Investigate and analyze MySQL data safely using SELECT-only queries: connect with mysql client, inspect schema via information_schema, profile queries with EXPLAIN, and produce reproducible read-only reports without modifying data or schema."
version: "1.0"
tags: [workflow, sop, mysql, backend, dev, testing]
---

# Goal
Answer questions about MySQL data and query performance using a safe, repeatable, **SELECT-only** workflow that avoids changing data/schema, produces reproducible results, and documents assumptions.

# When to Use
- You need to understand a MySQL database (tables, columns, relationships) without making changes.
- You need to debug a data issue by querying and summarizing results safely.
- You need to profile a slow query and propose improvements (without applying changes).

# Inputs
- Connection info (no secrets stored): host/port/database/user and how you authenticate.
- Target scope: schema/database, tables, time range, and the business question you’re answering.
- Environment: dev/staging/prod and any read-only replica availability.
- Constraints:
  - Default to **SELECT-only** (no writes; no schema changes).
  - Avoid heavy scans on production unless approved (filters/limits first).
  - Do not paste credentials/tokens into notes; redact if provided.

# Output
- A query pack (copy/paste SQL) that answers the question.
- A short report: findings, counts/aggregates, and any anomalies.
- Optional performance notes: `EXPLAIN` outputs and indexing/join/order-by hypotheses (no changes applied).

# Procedure
1. Confirm environment and safety posture.
   - Confirm whether you’re on prod, a replica, staging, or local.
   - If on prod, prefer minimal-impact queries (filters, small `LIMIT`) before broader scans.
2. Connect with the MySQL client (`mysql`) and set safe defaults.
   - Connect using your org’s approved method (SSO/IAM/password prompt; don’t store secrets).
   - Set session-level safety (read-only, timeouts). Use the ones supported by your MySQL version:
     - `SET SESSION sql_safe_updates = 1;` (helps prevent accidental wide updates, even though you’re SELECT-only)
     - `SET SESSION max_execution_time = 30000;` (milliseconds; available in many MySQL versions)
   - Use a consistent time zone if needed: `SET time_zone = '+00:00';` (or document local)
3. Orient in the database (read-only introspection).
   - List databases: `SHOW DATABASES;`
   - Select database: `USE <db>;`
   - List tables: `SHOW TABLES;`
   - Describe table: `DESCRIBE <table>;` or `SHOW CREATE TABLE <table>\\G`
   - Find columns by name (catalog query):
     - Query `information_schema.columns` for likely matches.
4. Understand relationships and constraints.
   - Identify primary keys, unique keys, and indexes (`SHOW INDEX FROM <table>;`).
   - Identify foreign keys via `information_schema.key_column_usage` (note: MySQL relationships may not be enforced depending on engine/settings).
   - Map join paths explicitly (what joins on what keys) before writing complex queries.
5. Build the answer iteratively (safe query construction).
   - Start with a narrow `SELECT` and a small `LIMIT`.
   - Add filters (time range, tenant/customer id) early to bound results.
   - Add aggregations next (`COUNT`, `SUM`, `GROUP BY`) and verify totals at each step.
   - Use CTEs for readability if supported (MySQL 8+); otherwise use derived tables.
   - Prefer explicit column lists over `SELECT *` in final queries.
6. Validate assumptions.
   - Check for NULLs, duplicates, and unexpected cardinality.
   - Sanity-check joins: compare row counts before/after joins to detect fan-out.
   - Sample rows deterministically where possible (ordered by stable key).
7. Performance profiling (read-only).
   - Use `EXPLAIN` on the exact query to inspect access paths, row estimates, and index use.
   - Treat `EXPLAIN ANALYZE` (MySQL 8.0.18+) as potentially expensive because it executes the query; use only with approval on prod.
   - Form recommendations only (no changes applied): index candidates, predicate pushdown, join order, avoiding functions on indexed columns.
8. Produce a reproducible “query pack” deliverable.
   - Include: context header (host/db), each query’s purpose, and expected result shape.
   - Include parameters as placeholders (e.g., `:tenant_id`, `:start_ts`, `:end_ts`).
9. Export results (optional).
   - Prefer client-side export (safe):
     - `mysql --batch --raw --silent -e "<SQL>" <db> > out.tsv`
   - Avoid `SELECT ... INTO OUTFILE` unless explicitly approved (it writes to the DB server filesystem).

# Verification (Acceptance Checks)
- [ ] All SQL is SELECT-only (no writes; no schema changes).
- [ ] Queries include bounding filters/limits appropriate for the environment.
- [ ] Results include at least one sanity check (counts, null checks, join fan-out check).
- [ ] If performance notes are included, `EXPLAIN` output is captured and tied to a concrete hypothesis.

# Failure Modes & Recovery
- **If you don’t know where the data lives**: search `information_schema.columns` for likely column names → list candidate tables → sample with `LIMIT`.
- **If joins explode row counts**: verify join keys → add join predicates → aggregate before joining → use DISTINCT only if justified.
- **If queries are too slow**: add tighter filters → remove wide selects → add `LIMIT` → use `EXPLAIN` to understand the plan.
- **If production risk is high**: move to a read replica/staging snapshot → repeat with broader scans.
- **If missing info**: ask user “Which database/environment is this (prod/staging/local), what’s the question to answer, and which tables might be involved?”

# Examples
## Example A
**User request:** “Find daily signup counts for the last 30 days, broken down by plan.”
**What you do:** Identify relevant tables → define time filter → aggregate by day + plan → add sanity checks → export if needed.
**Result:** A SELECT-only query pack and a small summary table of results.

## Example B
**User request:** “This query is slow—why?”
**What you do:** Capture the query → run `EXPLAIN` → identify scan/sort/join bottleneck → propose index or rewrite options as recommendations (no changes applied).
**Result:** `EXPLAIN` output + actionable hypotheses and next steps.

# Notes (optional)
- Prefer running heavy analysis on replicas; even SELECTs can be expensive.
- Avoid `SELECT *` in final deliverables; it’s slower, brittle, and harder to review.
