# Local Docker audit and safe cleanup — 2026-09-15

## Scope and authority

- **Project:** ERP-System
- **Actor:** Codex root agent
- **Environment:** local Docker Desktop, Asia/Singapore, 2026-09-15
- **Source revision:** `4345f55c7eb081e4d2a914aeb160a7106299623f`
- **Dirty state:** one pre-existing untracked file, `docs/ai-native/evidence/LOCAL-DOCKER-DEMO-2026-09-14.md`; it was preserved.
- **Expected result:** remove only ERP Docker resources proven to be unused, preserve Demo/public access, production data and unrelated Codeloom resources, and document the Demo/production topology.
- **Actual result:** the verified orphan resources and reclaimable build cache were removed; running services and durable volumes remained intact.

## Inventory and decision

| Resource | Evidence | Decision |
| --- | --- | --- |
| `erp-system-demo-1` / `erp-system-demo` | Current repository Demo Compose service; healthy; static Vite/PGlite/IndexedDB bundle | Preserved |
| `erp-system-demo-public-proxy` / `nginx:alpine` | Current public Demo Compose overlay; serves the `/erp/` upstream | Preserved |
| `erp-system-production-api-1` / `erp-system-production-api` | Production Compose service; healthy API; document storage volume attached | Preserved |
| `erp-system-production-calendar-worker-1` / `erp-system-production-calendar-worker` | Production Compose service; calendar/reminder worker is running | Preserved |
| `erp-system-production-db-1` / `postgres:16-alpine` | Production PostgreSQL; healthy; `erp-system-production_pgdata` attached | Preserved |
| `codex-erp-postgres-s5` / `postgres:16-alpine` | Running disposable PostgreSQL test target on host port 55432; anonymous volume attached | Preserved |
| `erp-system-production-web-1` / `erp-system-production-web` | Production Compose web service, stopped cleanly; image remains the restartable production UI artifact. It declares the same host port 18791 currently used by the public Demo proxy. | Preserved |
| `erp-system-production-migrator` | Production Compose `migration` profile; no container currently exists, but it is the reviewed database migration path | Preserved |
| `worker` profile | Production Compose `email` profile; not enabled in the current stack; uses the API image when explicitly enabled | Preserved as an on-demand service definition |
| `erp-system-web:latest` | No container reference and no current Compose/source reference; superseded local web tag | Removed |
| Anonymous volume `bccedb06bcd6d51b6c45b970ec8656eb9f0bc198732942c2742506d517a96394` | Anonymous volume with zero container links; not a production, test, document or Codeloom volume | Removed |
| `clamav/clamav:stable` | No container or Compose reference; one-shot scan tooling can be pulled again when needed | Removed |
| `node:24-alpine`, `node:22-alpine`, `alpine:latest`, `node:20.11.0-alpine` | No container reference and not used by the current Dockerfiles | Removed |
| `codeloom` containers/image and `codeloom-data` | Separate Codeloom project and data volume | Preserved |

## Space and verification evidence

Before cleanup, Docker reported 14 images, 6.423 GB BuildKit cache and 5 local volumes (273.9 MB). After cleanup, Docker reported 8 images, 0 B BuildKit cache and 4 local volumes (216.7 MB). Docker's image totals include shared layers, so the reported values are accounting totals rather than a claim about exact host-byte reclamation.

The following checks passed after each destructive operation:

- `docker ps`: Demo, public proxy, production API, production calendar worker, production DB and disposable PostgreSQL test target remained running; production API and both databases remained healthy.
- `curl http://127.0.0.1:8081/health`: `ok`.
- `curl http://127.0.0.1:18791/erp/`: HTTP 200 and the Demo release manifest.
- `curl https://gmb01.xyz/erp/health`: `ok` through the Cloudflare public route.
- Production API container health: HTTP 200 with `service=erp-system-api`.
- `docker builder prune --filter until=24h --force` reported 2.147 GB reclaimed; the subsequent `docker builder prune --all --force` completed and the final Docker report showed 0 B build cache. No containers, images or volumes were targeted by those commands.
- The exact GOAL count validator passed with 227 done, 6 in progress, 4 todo, 3 blocked, 240 total; 35/48 criteria and 44/60 checkpoints. This operational cleanup does not change capability counts.

No passwords, API keys, provider credentials or connection strings were recorded. No production database or document volume was modified.

## Topology conclusion

The Demo intentionally does not need a separate PostgreSQL container: it is a static browser bundle whose PGlite/IndexedDB state belongs to that browser. Production already separates concerns: Nginx web, Node API, PostgreSQL database, an always-on calendar worker, an optional email worker profile and a profiled migration service. Source updates replace the web/API images; schema changes run the migration service after backup. A second persistent "source code database" container would duplicate state and is not required.

The production stack and the public Demo currently share host port 18791 in their local tunnel arrangement, so the production web container remains stopped while the public Demo proxy owns that port. Starting production web requires a reviewed port/routing change; deleting its image would remove the simple restart path.
