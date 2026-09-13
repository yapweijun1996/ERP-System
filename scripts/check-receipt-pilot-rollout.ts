import { runReceiptPilotReleaseProbe } from '../src/pilot/evaluationReleaseProbe';

const result = runReceiptPilotReleaseProbe();

console.log(JSON.stringify({
  baseline: result.baseline,
  candidate: result.candidate,
  rejectedCandidate: {
    accepted: result.rejectedCandidate.accepted,
    code: result.rejectedCandidate.code,
    state: result.rejectedCandidate.state,
  },
  acceptedCandidate: {
    accepted: result.acceptedCandidate.accepted,
    code: result.acceptedCandidate.code,
    state: result.acceptedCandidate.state,
  },
  disabled: result.disabled,
  blockedAfterDisable: {
    accepted: result.blockedAfterDisable.accepted,
    code: result.blockedAfterDisable.code,
    state: result.blockedAfterDisable.state,
  },
}));
