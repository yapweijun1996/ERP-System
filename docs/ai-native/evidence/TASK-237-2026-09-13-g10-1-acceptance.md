# TASK-237 G10.1 acceptance evidence — frozen Receipt Pilot evaluation set

- Date: 2026-09-13 (Asia/Singapore)
- Current revision: `b695a833ace3983149dd3728bbb1124fd010b250`
- Case-set source revision: `860d19fb4e19255e9e1f8665d2f7150ece789f69`
- Environment: local repository, Node/Vitest, symbolic isolated fixture metadata
- Evidence class: source and deterministic fixture; no provider, production, CI rollout or human-pilot claim
- Actor: Codex engineering run in the shared ERP-System worktree
- Working-tree boundary: unrelated tracked and untracked changes were preserved and are not part of this acceptance record.

## Expected result

Version a Receipt Pilot evaluation set with happy paths, invalid input, prompt
injection, unauthorized data access, stale approval, revocation and retry
scenarios, with an independent oracle that evaluates protected postconditions.

## Actual result

- `VALID_RECEIPT_PILOT_CASES` contains exactly 30 distinct cases covering P01–P16,
  both `C-SG` and `C-MY`, all five supported locales, empty and boundary dates,
  mixed currency, own/company access, reviewed selection, cancellation,
  destination safety and restart/retry dimensions.
- `NEGATIVE_RECEIPT_PILOT_CASES` contains 9 cases covering invalid input, prompt
  injection, unauthorized data, stale approval, revoked access and retry/replay,
  plus wrong receipt ID, duplicate Pack and false-success oracle mutations.
- Fixture, model, prompt and tool versions are explicit constants in
  [evaluationCases.ts](../../../src/pilot/evaluationCases.ts).
- `evaluateReceiptPilotCase` independently checks Company scope, exact receipt-key
  sets, unauthorized rows, Pack identity/count and persisted postconditions; model
  narrative text is not used as proof.

## Verification

| Command | Expected | Actual |
| --- | --- | --- |
| `npx vitest run src/pilot/evaluationCases.test.ts --reporter=dot` | Frozen set and oracle mutations pass | 1 file / 8 tests passed |
| `npm run check:receipt-pilot-evaluation` | Canonical fixture gate passes | 30/30 valid, 9/9 negative, zero deterministic safety failures and zero false-success results |
| `node --check scripts/audit-screens.mjs` | Current candidate scripts parse | Passed |

The S1 packet remains checked. This evidence promotes only **G10.1**; it does
not promote G10.3/G10.4 or TASK-237, and it does not convert Demo/Codex OCR into
real-provider or production evidence.
