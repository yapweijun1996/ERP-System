---
name: cfml-lucee
description: "Build, run, debug, and deploy CFML applications on the Lucee engine, including recommended local dev setups (CommandBox or Docker), project structure, Application.cfc configuration, datasources, logging, and troubleshooting."
version: "1.0"
tags: [workflow, sop, backend, dev, cfml, lucee]
---

# Goal
Provide a repeatable, low-friction workflow to develop CFML apps on Lucee locally (start server, configure app + datasources, debug issues), then package/deploy safely with basic performance and security hygiene.

# When to Use
- You’re starting or inheriting a Lucee/CFML codebase and need a standard way to run it locally and troubleshoot.
- You need a consistent checklist for app configuration (Application.cfc, mappings, datasources, logging) and deployment.

# Inputs
- Codebase location: repo path and entry URL (if known).
- Runtime choice: CommandBox (preferred) or Docker/Tomcat/WAR.
- Environment needs: DB type/host, required Java version, required Lucee version.
- Constraints:
  - Do not store secrets in the repo; use `.env`, server config, or secret manager.
  - Prefer minimal changes to make the app run; avoid large refactors unless requested.

# Output
- A local-run recipe (exact commands + URLs + where logs live).
- A config checklist (Application.cfc, mappings, datasources, env vars).
- A troubleshooting playbook for common Lucee startup/runtime errors.
- A deployment outline (what artifact, what config, what to verify).

# Procedure
1. Identify the app shape and entrypoints.
   - Locate `Application.cfc` (or `Application.cfml`) and the web root (often `wwwroot/`, `web/`, or repo root).
   - Find key routes/pages (e.g., `index.cfm`, `index.cfml`, handler frameworks) and any framework markers (FW/1, ColdBox, etc.).
2. Choose a local runtime (recommended order).
   - Prefer **CommandBox** for fastest iteration (embedded server + easy Lucee version pinning).
   - Use **Docker** if the app depends on system packages or needs parity with production.
   - Use **WAR/Tomcat** only if the org already standardizes on it.
3. Run locally with CommandBox (preferred path).
   - If the repo already has a server config (commonly `server.json`), use it as the source of truth.
   - Start the server from the web root: `box server start`.
   - Record the base URL, port, and Lucee version actually running.
4. Run locally with Docker (alternative path).
   - Use an existing `Dockerfile`/`docker-compose.yml` if present.
   - Ensure volumes mount the web root and logs are accessible.
   - Record container ports, base URL, and how to view logs.
5. Confirm `Application.cfc` essentials.
   - Verify `this.name` is stable (session/app scope isolation).
   - Verify session settings if needed (`this.sessionManagement`, timeouts).
   - Verify mappings (`this.mappings`) for any shared libraries.
   - Verify per-environment config pattern (e.g., environment variables → `Application.cfc` reads them).
6. Configure datasources safely.
   - Prefer defining datasources outside code (CommandBox server config, Lucee admin, or container env).
   - If the app expects a named DSN, confirm the expected datasource name(s).
   - Test connectivity with a minimal health page or a tiny query in a safe dev-only endpoint.
7. Establish a debugging and logging workflow.
   - Find where Lucee writes logs (web context/server context).
   - Enable/request stack traces appropriately for local dev (never for production).
   - Use structured logging patterns in app logs (include request id, user id if applicable).
8. Validate key runtime behaviors.
   - Page renders without error.
   - Sessions/cookies behave as expected.
   - DB reads work for at least one representative query.
   - Scheduled tasks / background jobs are disabled or controlled in local dev unless needed.
9. Testing strategy (pick what exists; don’t invent frameworks).
   - If the repo uses TestBox, document how to run it and what URLs/commands execute tests.
   - If no tests exist, add a minimal “smoke test” checklist instead of introducing a new test framework.
10. Deployment outline.
   - Identify the target runtime (Lucee on Tomcat, standalone servlet container, or managed hosting).
   - Identify the artifact (source deploy, WAR, container image).
   - List required environment variables/secrets and where they are set.
   - Verify post-deploy checks: homepage, login flow, DB connectivity, email/SMS integrations, scheduled jobs, and logs.

# Verification (Acceptance Checks)
- [ ] You can start the app locally and load a known URL without a 500 error.
- [ ] Logs are locatable and you can see a new entry after a request.
- [ ] At least one DB-backed page or a minimal query succeeds using the configured datasource.
- [ ] Deployment target + artifact type + required config are explicitly documented.

# Failure Modes & Recovery
- **If the server won’t start (port in use)**: change the port in server/Docker config → retry start.
- **If you see “template not found”**: confirm the web root/docroot is correct → adjust CommandBox `webroot`/Docker volume.
- **If you see Java/Lucee incompatibility errors**: confirm required Java version → switch JDK or pin a compatible Lucee version.
- **If datasource errors occur (missing DSN/credentials)**: confirm expected datasource name(s) → configure DSN in server/Lucee admin/env vars → retry minimal query.
- **If you get blank pages or suppressed errors**: enable local dev error output/logging → reproduce and capture the stack trace.
- **If missing info**: ask user “Are you using CommandBox or Docker, and do you have a specific Lucee version + database type to support?”

# Examples
## Example A
**User request:** “I have a Lucee CFML repo. How do I run it locally and connect Postgres?”
**What you do:** Locate web root + `Application.cfc` → prefer CommandBox → start server → configure Postgres datasource in server config/Lucee admin → verify a minimal query and log output.
**Result:** A local-run recipe with the base URL, datasource name, and where logs live.

## Example B
**User request:** “We deploy Lucee on Tomcat. What do I need to package and verify?”
**What you do:** Identify whether you deploy source or WAR → list required env vars and DSNs → document log locations → produce a post-deploy checklist (routes + integrations + job controls).
**Result:** A deployment outline and acceptance checklist tailored to the existing runtime.

# Notes (optional)
- Avoid committing `WEB-INF/lucee/` runtime-generated state unless your team explicitly version-controls it.
- Prefer environment variables for secrets; never embed DB passwords or API keys in `Application.cfc`.
