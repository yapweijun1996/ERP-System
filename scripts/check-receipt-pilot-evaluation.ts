import { runReceiptPilotEvaluation } from '../src/pilot/evaluationGate';

const broken = process.argv.includes('--broken');
try {
  const result = runReceiptPilotEvaluation({ broken });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'receipt_pilot_evaluation_gate_failed'}\n`);
  process.exitCode = 1;
}
