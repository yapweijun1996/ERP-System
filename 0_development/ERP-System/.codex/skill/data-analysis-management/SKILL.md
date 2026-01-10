---
name: data-analysis-management
description: "Run data analysis work as a senior data analysis manager: clarify business questions, define metrics and data contracts, ensure data quality, choose analysis methods, produce reproducible insights, communicate decisions, and operationalize reporting with governance."
version: "1.0"
tags: [workflow, sop, docs, dev, testing]
---

# Goal
Deliver trustworthy, decision-ready analysis and reporting: clear questions, consistent metric definitions, validated data, reproducible methods, and actionable recommendations with an execution/measurement loop.

# When to Use
- You need to answer a business question with data (growth, churn, revenue, operations, product).
- You need to establish metric governance, reporting standards, and analysis workflows for a team.
- You need to review/approve analyses and ensure quality before stakeholders act on them.

# Inputs
- Business question: decision to make, urgency, and what action depends on the result.
- Context: users/segments, product changes, seasonality, and known constraints.
- Data sources: warehouse/DB tables, events, CRM, financial systems, spreadsheets.
- Metric definitions: existing definitions (if any), known inconsistencies, and desired granularity.
- Constraints:
  - Do not invent numbers; label assumptions and show how to validate.
  - Default to **read-only / SELECT-only** when querying databases unless explicitly asked to write/change schema.
  - Do not store secrets in analysis artifacts; reference secret managers for credentials.

# Output
- A decision memo (or analysis doc) containing:
  - Question, context, and decision options
  - Metric definitions and cohort/segment definitions
  - Data sources, query logic (or method), and assumptions
  - Results with uncertainty/limitations and recommended action
  - Follow-up measurement plan and owners
- Optional: a reproducible query/notebook + a dashboard/report spec with governance rules.

# Procedure
1. Clarify the decision and success criteria.
   - Write: “We need to decide <A vs B> because <context>. We’ll choose based on <metric(s)> by <date>.”
   - Define what “good enough” evidence looks like (confidence level, directional vs precise).
2. Define metrics and scope (lock definitions early).
   - Define the primary KPI and 3–5 supporting metrics.
   - Specify: numerator/denominator, filters, time window, timezone, and grain (daily/user/account).
   - Write explicit cohort and segment rules (new vs returning, paid vs free, region, plan).
3. Validate data availability and data contracts.
   - Identify source-of-truth tables/events and owners.
   - Check schema and semantics (what each field means; what can be null).
   - Confirm join keys and relationship cardinality (1:1, 1:N) to avoid fan-out.
4. Run data quality checks before analysis.
   - Completeness: missing days, missing events, null rates.
   - Consistency: duplicates, unexpected spikes/drops, referential integrity anomalies.
   - Freshness: last updated timestamp; lag expectations.
   - If quality is poor, stop and fix/flag before proceeding (or bound the analysis).
5. Choose the analysis approach (fit method to question).
   - Descriptive: trends, cohorts, segmentation, funnel analysis.
   - Diagnostic: decomposition, correlation checks, root-cause slices.
   - Causal: experiment analysis (A/B), quasi-experimental methods (only if justified and understood).
   - Forecasting: simple baselines first; state uncertainty and assumptions.
6. Build analysis iteratively (reproducible by default).
   - Start with small, bounded queries (filters/limits); confirm counts and join behavior.
   - Use stable definitions and keep a “query pack” or notebook with parameters.
   - Add sanity checks: totals, distinct counts, and reconciliation to known reports where possible.
7. Interpret results with rigor.
   - Separate signal vs noise: seasonality, small sample effects, confounders.
   - Provide confidence intervals or sensitivity checks when appropriate.
   - Call out limitations clearly (coverage gaps, proxy metrics, attribution ambiguity).
8. Communicate for decisions (not for data people).
   - Lead with: recommendation + expected impact + risks.
   - Show the minimum charts/tables needed; add appendices for details.
   - Define “what we will do next” and “how we will know it worked.”
9. Operationalize (when the question repeats).
   - Turn recurring analyses into a governed dashboard/report.
   - Version metric definitions; document owners and change process.
   - Set refresh cadence, alert thresholds, and data lineage notes.
10. Run the team operating rhythm (manager mode).
   - Weekly: review KPI anomalies, data incidents, and experiment results.
   - Monthly/quarterly: metric governance review, backlogged definitions cleanup, stakeholder alignment.

# Verification (Acceptance Checks)
- [ ] The business decision and success criteria are explicit and agreed.
- [ ] Metric definitions (including filters, grain, timezone) are documented and consistent.
- [ ] Data quality checks were performed and issues are recorded or bounded.
- [ ] Analysis is reproducible (queries/notebook, parameters, and assumptions saved).
- [ ] Recommendation includes risks, limitations, and a follow-up measurement plan.
- [ ] If turned into reporting, ownership and change governance are defined.

# Failure Modes & Recovery
- **If stakeholders keep changing the question**: restate the decision → lock scope/metrics → create a backlog for follow-up questions.
- **If numbers don’t match “known reports”**: reconcile definitions → check join fan-out → check timezones/windows → document the delta source.
- **If data quality is unreliable**: pause analysis → open a data incident → implement a quality check → re-run with corrected data.
- **If correlation is mistaken for causation**: reframe to descriptive/diagnostic → propose an experiment or better identification strategy.
- **If missing info**: ask user “What decision are we making, what is the primary KPI, and what data source(s) should we trust for it?”

# Examples
## Example A
**User request:** “Why did conversion drop last week?”
**What you do:** Lock metric definition → run quality checks → slice by channel/device/region → inspect funnel steps → identify top contributor segments → recommend mitigation + measurement.
**Result:** A decision memo with root-cause slices and a prioritized action plan.

## Example B
**User request:** “Define and standardize ‘active user’ across teams.”
**What you do:** Gather current definitions → propose a canonical definition + variants → document contracts and events → build a reference query → create governance (owner, change control).
**Result:** A shared metric spec and reproducible query used by dashboards and analyses.

# Notes (optional)
- Great analysis is a product: definitions, quality, and trust matter as much as charts.
- Prefer simple methods with clear assumptions over complex models that are hard to explain or maintain.
