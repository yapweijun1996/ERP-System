import {
  runReceiptPilotEvaluation,
  type ReceiptPilotGateResult,
  type ReceiptPilotGateVersions,
} from './evaluationGate';

export interface ReceiptPilotReleaseState {
  readonly enabled: boolean;
  readonly generation: number;
  readonly activeVersions: ReceiptPilotGateVersions;
}

export interface ReceiptPilotRolloutDecision {
  readonly accepted: boolean;
  readonly code: 'accepted' | 'receipt_pilot_evaluation_gate_failed' | 'receipt_pilot_release_disabled';
  readonly state: ReceiptPilotReleaseState;
  readonly gate: ReceiptPilotGateResult | null;
}

export interface ReceiptPilotReleaseProbeResult {
  readonly baseline: ReceiptPilotReleaseState;
  readonly candidate: ReceiptPilotGateVersions;
  readonly rejectedCandidate: ReceiptPilotRolloutDecision;
  readonly acceptedCandidate: ReceiptPilotRolloutDecision;
  readonly disabled: ReceiptPilotReleaseState;
  readonly blockedAfterDisable: ReceiptPilotRolloutDecision;
}

function stateFromGate(gate: ReceiptPilotGateResult, generation: number): ReceiptPilotReleaseState {
  return {
    enabled: true,
    generation,
    activeVersions: {
      fixtureVersion: gate.fixtureVersion,
      modelVersion: gate.modelVersion,
      promptVersion: gate.promptVersion,
      toolVersion: gate.toolVersion,
    },
  };
}

function failureCode(error: unknown): 'receipt_pilot_evaluation_gate_failed' {
  if (error instanceof Error && error.message.startsWith('receipt_pilot_evaluation_gate_failed:')) {
    return 'receipt_pilot_evaluation_gate_failed';
  }
  throw error;
}

/**
 * Run a candidate through the same deterministic gate used by CI. A rejected
 * candidate returns the current state so it cannot replace the active version.
 */
export function attemptReceiptPilotRollout(
  current: ReceiptPilotReleaseState,
  candidate: ReceiptPilotGateVersions,
  options: { readonly broken?: boolean } = {},
): ReceiptPilotRolloutDecision {
  if (!current.enabled) {
    return {
      accepted: false,
      code: 'receipt_pilot_release_disabled',
      state: current,
      gate: null,
    };
  }
  try {
    const gate = runReceiptPilotEvaluation({ broken: options.broken, versions: candidate });
    return {
      accepted: true,
      code: 'accepted',
      state: stateFromGate(gate, current.generation + 1),
      gate,
    };
  } catch (error) {
    failureCode(error);
    return {
      accepted: false,
      code: 'receipt_pilot_evaluation_gate_failed',
      state: current,
      gate: null,
    };
  }
}

export function emergencyDisableReceiptPilot(current: ReceiptPilotReleaseState): ReceiptPilotReleaseState {
  return { ...current, enabled: false, generation: current.generation + 1 };
}

/**
 * Local release-probe scenario for CI: a broken candidate is rejected, a valid
 * candidate can advance, and emergency disable blocks subsequent rollout.
 */
export function runReceiptPilotReleaseProbe(): ReceiptPilotReleaseProbeResult {
  const baselineGate = runReceiptPilotEvaluation();
  const baseline = stateFromGate(baselineGate, 1);
  const candidate: ReceiptPilotGateVersions = {
    ...baseline.activeVersions,
    promptVersion: `${baseline.activeVersions.promptVersion}:candidate`,
  };
  const rejectedCandidate = attemptReceiptPilotRollout(baseline, candidate, { broken: true });
  if (rejectedCandidate.accepted || rejectedCandidate.state !== baseline) {
    throw new Error('receipt_pilot_rollout_rejection_failed');
  }
  const acceptedCandidate = attemptReceiptPilotRollout(baseline, candidate);
  if (!acceptedCandidate.accepted || acceptedCandidate.state.activeVersions.promptVersion !== candidate.promptVersion) {
    throw new Error('receipt_pilot_rollout_acceptance_failed');
  }
  const disabled = emergencyDisableReceiptPilot(acceptedCandidate.state);
  const blockedAfterDisable = attemptReceiptPilotRollout(disabled, baseline.activeVersions);
  if (disabled.enabled || blockedAfterDisable.accepted || blockedAfterDisable.code !== 'receipt_pilot_release_disabled') {
    throw new Error('receipt_pilot_emergency_disable_failed');
  }
  return { baseline, candidate, rejectedCandidate, acceptedCandidate, disabled, blockedAfterDisable };
}
