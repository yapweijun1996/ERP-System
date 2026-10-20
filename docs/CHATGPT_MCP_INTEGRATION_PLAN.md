# ChatGPT MCP Integration — Read-Only Plan

Status: proposed, documentation only (2026-09-25). No ChatGPT connection, new MCP tool, OAuth issuer, HR access, order access, deployment, or production pilot is delivered by this plan.

## Goal and first release

Let an ERP user ask ChatGPT questions about permitted ERP data without giving ChatGPT broader access than the same user has in the ERP. The first release is read-only. Example requests are:

- "Find my Company's receipts from this month" and "Show receipt 123."
- "Who on my permitted team is on leave today?" Include the as-of date, timezone, and calendar scope in the answer.
- "Which leave applications are waiting for my decision?" and "Show the details I am allowed to see for application 123."

Order lookup is a follow-on read-only use case. Define whether "my orders" means the user's own sales orders, assigned orders, or Company orders before exposing a tool. Employee setup/management, leave decisions, and any other ERP mutation are outside the first release and require a separate proposal.

## Current source-backed baseline

- `src/api/routes/mcp.ts` exposes `/api/mcp/v1` through Streamable HTTP. Its current six tools are `receipt.search`, `receipt.get`, `receipt_pack.prepare`, `receipt_pack.create`, `receipt_pack.get`, and `receipt_pack.export`. This is a receipt pilot, not general ERP access. The existing catalog includes governed Pack creation, so merely registering this endpoint in ChatGPT would not make the connection read-only; tool exposure must be constrained server-side before a read-only pilot.
- `src/api/mcpAuthorization.ts` defines receipt-only scopes and a local test fixture. `src/api/app.ts` accepts an external MCP authorization adapter but does not turn the fixture into a production OAuth issuer. Production issuer, multi-instance rate limiting, and deployment proof remain separate gates in [STATUS.md](STATUS.md).
- `GET /api/my/approvals` and `GET /api/my/approvals/:requestId` in `src/api/routes/my.ts` derive the actor from the human session and return only actionable leave approvals. They mark leave reason and evidence as redacted. The approval/rejection routes are writes and are out of scope here.
- `GET /api/my/team/calendar` in `src/api/routes/my.ts` derives the actor and Company from the session, requires `employeeTeamRead`, defaults to direct reports, and has additional scope restrictions. Leave Applications and Staff Calendar are distinct sources projected into the calendar; the connector must preserve that boundary.
- Existing `ERP_AGENT_API_KEY` credentials held in an Agent's private environment are for separately governed Agent principals. They must not be treated as the identity of whichever staff member is using ChatGPT.

## Proposed architecture and trust boundary

1. Register the ERP's remote MCP endpoint as a private ChatGPT app/connector only after confirming the intended ChatGPT workspace supports custom MCP apps. Reuse `/api/mcp/v1` and the existing action/domain contracts; do not create a parallel HR or receipt business-rule implementation.
2. Add a production OAuth 2.1/OIDC authorization-code flow with PKCE and the required protected-resource and authorization-server metadata. Validate signature or introspection, issuer, exact resource audience, expiry, revocation, scopes, and the linked ERP user on every call. A shared API key, browser cookie, model instruction, or client-supplied `masterFn`/`companyFn` is not sufficient for staff-specific access.
3. Resolve the OAuth subject to an active ERP user and active Company membership on the server. Derive `masterFn`, `companyFn`, actor, and effective permissions there; recheck them for each tool invocation. The current MCP receipt route maps an Agent principal, so human-delegated identity needs an explicit, reviewed extension rather than silently treating an Agent as a user.
4. Route MCP reads through the same tenant-scoped queries and privacy policy as ERP API reads. Return bounded, structured data with record IDs, status, date/as-of context, and only user-visible fields. Treat receipt text, order notes, and leave descriptions as untrusted data, not instructions to the agent.
5. Expose only tools that cannot mutate state in this release, using a dedicated read-only MCP registration or equivalent server-enforced catalog filtering tied to the authenticated client. Mark tools `readOnlyHint: true` only when the implementation is genuinely read-only. Do not advertise `receipt_pack.create`, leave approve/reject, employee edits, setup commands, or feedback submission in this tool set.

## Proposed read-only tool inventory

| User goal | Proposed tool | Existing source to reuse | Authorization and result boundary |
| --- | --- | --- | --- |
| Identify the connected ERP account | `erp.account.get` | Authenticated ERP identity and membership | Return only display identity, active Company, and granted read scopes; never credentials or raw tokens. |
| Find and inspect receipts | Existing `receipt.search`, `receipt.get` | `src/api/routes/mcp.ts` and receipt action contracts | Preserve Company scope and receipt grants; keep Pack creation unavailable in the read-only ChatGPT profile. |
| See who is on leave today | `leave.team_calendar` | `GET /api/my/team/calendar`; `src/modules/hr/teamCalendar.ts` | Require live team-calendar permission; default to direct reports; no Company-wide result unless ERP already authorizes that scope. Return dates/status, not leave reason or evidence. |
| List items awaiting this user's decision | `leave.my_pending_approvals` | `GET /api/my/approvals`; `src/modules/hr/leaveApproval.ts` | Derive the approver from the linked user; show actionable requests only and cap results. |
| Inspect one pending item | `leave.my_approval_detail` | `GET /api/my/approvals/:requestId` | Recheck current actionability and actor authority. Preserve reason/evidence redaction and avoid revealing whether another Company's ID exists. |
| Query orders (later) | To be specified | Existing order API/domain read path, after product decision | Define "my orders" and its permission matrix first; no generic Company-order exposure by default. |

## Delivery sequence and acceptance gates for a later implementation task

1. Approve the exact user roles, Company/calendar scope, field allowlists, supported ChatGPT workspace, identity provider, and retention/telemetry policy. Decide whether existing receipt Pack write tools need a separate connector/profile so the first ChatGPT release stays strictly read-only.
2. Implement and test the user-delegated OAuth adapter and ERP subject mapping. Prove missing/expired/revoked tokens, wrong audience, removed Company membership, downgraded permission, and cross-Company IDs fail closed. Do not put tokens, employee private details, or provider keys in logs, docs, or browser bundles.
3. Add the three leave read tools through the existing domain queries. Verify the same actor sees the same permitted records and redactions through ERP and MCP. Test direct, expanded, and denied Company calendar scopes, timezone/date boundaries, empty queues, and a request that is no longer actionable.
4. Validate MCP discovery and tool schemas with an MCP client, then exercise the draft ChatGPT app with a small named internal cohort. Check tool selection, grounded answers, no-write behavior, permission changes, latency, rate limits, error handling, and audit attribution. Keep Demo/local proof separate from production proof.
5. Release only after HTTPS/OAuth discovery, production authorization, monitoring, a disable/revocation path, and owner sign-off are verified. Expand to order reads and separately designed write workflows only after this read-only baseline is accepted.

## References

- [OpenAI Docs: Build an MCP server](https://developers.openai.com/plugins/build/mcp-server) — server tools, per-request authorization, read-only annotations, testing, and deployment.
- [OpenAI Docs: Authentication](https://developers.openai.com/plugins/build/auth) — OAuth metadata, PKCE, token validation, and user-delegated access.
- [ERP project logic](PROJECT_LOGIC.md) and [current status](STATUS.md) — implementation truth and remaining release gates.
