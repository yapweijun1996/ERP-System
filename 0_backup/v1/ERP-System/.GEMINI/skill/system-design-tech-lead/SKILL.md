---
name: system-design-tech-lead
description: "Design production-ready software systems with a senior Tech Lead workflow: clarify goals and constraints, define APIs and data models, choose architecture and storage, plan reliability/security/observability, estimate scale and cost, document tradeoffs, and produce an implementable design doc."
version: "1.0"
tags: [workflow, sop, backend, dev, docs, testing]
---

# Goal
Turn a vague system/product requirement into an implementable system design (architecture + interfaces + data + reliability/security/ops) with explicit tradeoffs, risks, and a clear delivery plan.

# When to Use
- You need to design a new system/service or a major redesign of an existing system.
- You need to write a design doc for alignment with stakeholders and engineering.
- You need an interview-style system design answer that still feels production-grounded.

# Inputs
- Problem statement: what users need and what success looks like.
- Non-functional requirements: latency, throughput, availability, durability, data retention, compliance.
- Constraints: timeline, team size, budget, existing stack, cloud/provider limits, “must use” systems.
- Scale signals: expected QPS, read/write ratios, payload sizes, growth projections, peak patterns.
- Data constraints: correctness needs, consistency model, privacy/PII boundaries.
- Constraints:
  - Prefer the simplest design that meets requirements; defer complexity behind clear triggers.
  - Do not store secrets in the design doc; reference secret management patterns.

# Output
- A concise design doc (or structured response) containing:
  - Goals/non-goals and assumptions
  - High-level architecture diagram (described in text) and key components
  - APIs and contracts (request/response, error handling)
  - Data model and storage choices (with reasoning)
  - Reliability plan (SLOs, scaling, backpressure, failure handling)
  - Security/privacy plan (authN/Z, PII, auditing)
  - Observability plan (logs/metrics/traces) and runbooks
  - Tradeoffs, risks, alternatives, and rollout/migration plan

# Procedure
1. Clarify the problem (don’t design yet).
   - Restate the problem in 1–2 sentences in user language.
   - Define success metrics and primary user journeys.
   - List explicit non-goals to prevent scope creep.
2. Ask the “tech lead triage” questions (capture assumptions).
   - Who are the users and what’s the critical path?
   - What are the scale targets (QPS, data size, peak factor, growth)?
   - What are the latency/availability requirements and error budget?
   - What data is sensitive (PII/PCI/PHI) and what compliance applies?
   - What’s the existing ecosystem (databases, queues, auth, observability)?
3. Define the system boundaries.
   - Identify upstream/downstream dependencies and integration points.
   - Decide what lives inside the system vs external services.
   - Define trust boundaries (public internet, internal network, third-party).
4. Design the API and contracts first (stability comes from interfaces).
   - Define core APIs (REST/gRPC/events) with request/response shapes.
   - Specify idempotency rules, pagination, retries, and error taxonomy.
   - Define versioning strategy and backward compatibility requirements.
5. Model the data and invariants.
   - Identify entities, relationships, and access patterns (read/write paths).
   - Define invariants (e.g., “order total must match sum of line items”) and where they’re enforced.
   - Choose consistency requirements per operation (strong vs eventual, read-your-writes).
6. Choose architecture with a “simple → scalable” ladder.
   - Start with a baseline architecture (single service + DB) unless scale forces otherwise.
   - Add components only for justified needs: cache, queue/stream, search, CDN, separate read model.
   - Make scaling strategies explicit: vertical, horizontal, sharding/partitioning, async processing.
7. Design for reliability (assume everything fails).
   - Define SLOs/SLIs for the critical path.
   - Add timeouts, retries with jitter, circuit breakers, and bulkheads where appropriate.
   - Plan backpressure (queue limits, shedding, rate limits) and graceful degradation.
   - Identify single points of failure and how they’re removed/mitigated.
8. Security and privacy by default.
   - AuthN/AuthZ model (service-to-service + user auth), least privilege.
   - Data protection: encryption in transit/at rest, secret management, key rotation.
   - PII boundaries: data minimization, retention, deletion, audit logs.
   - Threat model the top 3 risks (e.g., data exfiltration, privilege escalation, replay).
9. Observability and operations.
   - Logs: structured, correlation/request id, redaction of sensitive fields.
   - Metrics: golden signals (latency, traffic, errors, saturation) + business KPIs.
   - Tracing: distributed traces across critical path.
   - Runbooks: top incidents, on-call actions, dashboards, and alert thresholds.
10. Cost and capacity planning.
   - Identify primary cost drivers (compute, storage, egress, managed services).
   - Provide rough sizing assumptions and a cost-risk statement (“what makes cost blow up”).
11. Tradeoffs and alternatives.
   - List 2–3 plausible alternative designs and why they were not chosen.
   - Call out irreversible decisions vs easily changeable ones.
   - Define “complexity triggers” (when to introduce sharding, CQRS, streams, etc.).
12. Delivery plan and rollout/migration.
   - Break into milestones with measurable outcomes.
   - Plan data migration strategy (dual-write, backfill, verification, cutover, rollback).
   - Define feature flags, canaries, and rollback procedures.

# Verification (Acceptance Checks)
- [ ] Goals, non-goals, assumptions, and constraints are explicit and agreed.
- [ ] APIs/contracts include error handling, idempotency, and versioning approach.
- [ ] Data model includes invariants and access patterns that match requirements.
- [ ] Reliability plan includes SLOs and at least 5 concrete failure scenarios with mitigations.
- [ ] Security/privacy plan covers auth, encryption, secrets, and PII handling.
- [ ] Observability plan includes logs/metrics/traces and at least 3 key dashboards/alerts.
- [ ] Tradeoffs/alternatives are documented and “complexity triggers” are defined.
- [ ] Rollout/migration includes verification and rollback steps.

# Failure Modes & Recovery
- **If requirements are too vague**: ask user “What is the single critical user action, and what are the top 3 success metrics?”
- **If the design is getting too complex**: revert to the simplest viable baseline → add complexity only tied to a requirement/scale trigger.
- **If scaling assumptions are missing**: provide a range-based estimate (low/medium/high) → show how the architecture changes at each tier.
- **If correctness vs availability is unclear**: decide per operation → document the consistency model and user-visible effects.
- **If operational readiness is ignored**: add SLOs + dashboards + runbooks → re-run acceptance checks.

# Examples
## Example A
**User request:** “Design a URL shortener like bit.ly.”
**What you do:** Clarify scale + latency → define `POST /links` and `GET /{code}` contracts → choose key-generation and storage model → add caching/CDN → define abuse protection and rate limits → outline SLOs/alerts and multi-region considerations.
**Result:** A design doc with API, data model, caching strategy, reliability/security, and rollout plan.

## Example B
**User request:** “Design an event-driven order processing system.”
**What you do:** Define invariants (payment vs inventory vs fulfillment) → choose events/commands and idempotency keys → design outbox/consumer retries → define DLQ and replay strategy → add observability and runbooks.
**Result:** A production-grounded event architecture with clear failure handling and operational plan.

# Notes (optional)
- Prefer designing around invariants and interfaces; internal implementation can evolve.
- Write down “what breaks first” and “how we know” (signals) before you ship.
