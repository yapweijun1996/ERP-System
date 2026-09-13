import { describe, expect, it } from 'vitest';
import {
  runReceiptPilotReleaseProbe,
  attemptReceiptPilotRollout,
  type ReceiptPilotReleaseState,
} from './evaluationReleaseProbe';

describe('Receipt Pilot rollout and emergency-disable probe', () => {
  it('rejects a broken candidate, accepts a valid candidate, and blocks rollout after disable', () => {
    const result = runReceiptPilotReleaseProbe();

    expect(result.baseline).toMatchObject({ enabled: true, generation: 1 });
    expect(result.rejectedCandidate).toMatchObject({
      accepted: false,
      code: 'receipt_pilot_evaluation_gate_failed',
      state: result.baseline,
    });
    expect(result.acceptedCandidate).toMatchObject({
      accepted: true,
      code: 'accepted',
      state: {
        enabled: true,
        generation: 2,
        activeVersions: { promptVersion: result.candidate.promptVersion },
      },
    });
    expect(result.disabled).toMatchObject({ enabled: false, generation: 3 });
    expect(result.blockedAfterDisable).toMatchObject({
      accepted: false,
      code: 'receipt_pilot_release_disabled',
      state: result.disabled,
      gate: null,
    });
  });

  it('does not accept malformed version metadata', () => {
    const state: ReceiptPilotReleaseState = runReceiptPilotReleaseProbe().baseline;
    expect(() => attemptReceiptPilotRollout(state, {
      ...state.activeVersions,
      promptVersion: 'invalid candidate',
    })).toThrow('receipt_pilot_evaluation_version_invalid');
  });
});
