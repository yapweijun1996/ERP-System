---
name: typescript-coding
description: "Write, refactor, and debug TypeScript code with a repeatable workflow: set up strict typing, model types cleanly, avoid any, handle nullability, integrate with common tooling (tsconfig, eslint), and verify via build/tests."
version: "1.0"
tags: [workflow, sop, dev, backend, frontend, testing]
---

# Goal
Produce TypeScript code that is correct, readable, and maintainable by using strong typing (prefer inference + explicit public APIs), strict null safety, and reliable verification (typecheck + tests).

# When to Use
- You’re adding a new feature/module in a TypeScript codebase and want consistent typing patterns.
- You’re converting JavaScript to TypeScript, tightening types, or fixing type errors safely.

# Inputs
- Repo context: Node/browser target, module system, TS version, existing lint/test setup.
- Scope: files/functions/components to change and expected behavior.
- Type strictness: existing `tsconfig.json` settings and whether changes are allowed.
- Constraints:
  - Prefer small, safe refactors; don’t change runtime behavior unless requested.
  - Avoid `any`; use it only as a temporary escape hatch with a follow-up fix.

# Output
- Updated TypeScript code (types + implementation) with minimal, justified changes.
- Verification results: `tsc` typecheck (and tests if present).
- Notes on any tradeoffs (e.g., temporary `unknown`/type guards, intentional widening).

# Procedure
1. Identify the environment and constraints.
   - Determine runtime: Node (server/CLI) vs browser vs both.
   - Confirm module target (ESM/CJS), TS strictness, and any path aliases.
2. Type the public surface area first.
   - Define/adjust types for function inputs/outputs, module exports, and component props.
   - Prefer `type` for unions/intersections and `interface` for object shapes that are extended (follow repo conventions).
3. Model data carefully.
   - Use `unknown` for untrusted inputs (API/JSON/env) and narrow with type guards or schema validation patterns already in the repo.
   - Avoid “stringly typed” values; prefer literal unions or enums when it improves correctness.
4. Handle nullability explicitly.
   - Prefer `strictNullChecks` patterns: check for `null`/`undefined` early, return/throw early, and keep the happy path typed.
   - Avoid non-null assertions (`!`) unless you can prove the invariant and it’s stable.
5. Prefer inference and narrow types with control flow.
   - Let TS infer locals; annotate where it clarifies intent or prevents unwanted widening.
   - Use discriminated unions for state machines and UI states (`status: 'idle' | 'loading' | ...`).
6. Fix type errors without weakening safety.
   - If TS complains, first ask: is the code wrong, or is the type wrong?
   - Prefer narrowing (`if`, `switch`, `in`, `typeof`, `instanceof`) over casting.
   - Use type assertions only when you can justify the runtime guarantee.
7. Avoid `any` (use safer alternatives).
   - Use `unknown` + narrowing, generics, or utility types (`Partial`, `Pick`, `Omit`, `Record`).
   - If interfacing with untyped libs, add minimal ambient types or local wrappers (don’t over-model).
8. Use generics only when they reduce duplication.
   - Start with concrete types; introduce generics when you have real reuse or identity relationships (e.g., `map<T, U>`).
9. Verify and iterate.
   - Run typecheck (`tsc`) and fix remaining errors.
   - Run existing tests/lint if available; keep changes minimal.
10. Document tricky typing decisions.
   - If a type guard, assertion, or complex conditional type is used, add a short note in the PR/hand-off (not necessarily inline comments).

# Verification (Acceptance Checks)
- [ ] `tsc` passes with no new errors.
- [ ] No new uses of `any` (or any uses are explicitly justified and isolated).
- [ ] Untrusted inputs are typed as `unknown` and safely narrowed before use.
- [ ] Runtime behavior matches the expected feature behavior (via tests or a manual check).

# Failure Modes & Recovery
- **If types get overly complex**: simplify → prefer explicit, concrete types → reduce conditional types → model only what you need.
- **If you’re tempted to cast (`as`) everywhere**: stop → identify the missing narrowing or incorrect source type → add a type guard or fix the upstream type.
- **If strict mode causes many errors**: scope changes to the smallest module → add targeted fixes → avoid widening repo-wide settings unless requested.
- **If missing info**: ask user “What TS environment is this (Node/React/etc.), and do you want strict typing (and is `strict` enabled in `tsconfig.json`)?"

# Examples
## Example A
**User request:** “Convert this JS utility to TypeScript and make it strict-safe.”
**What you do:** Define input/output types → replace `any` with `unknown` → add narrowing/type guards → run `tsc` and tests.
**Result:** A strict-safe TS module with clear types and passing checks.

## Example B
**User request:** “Fix TypeScript errors in a React form component.”
**What you do:** Type props/state → model form values and validation errors → narrow event targets safely → remove unsafe assertions → verify build/tests.
**Result:** A typed component with fewer runtime edge cases and no TS errors.

# Notes (optional)
- Prefer “parse then trust”: validate external data once at the boundary, then use strong types inside the app.
- Use `satisfies` (TS 4.9+) when you want to validate a value’s shape without changing its inferred type.
