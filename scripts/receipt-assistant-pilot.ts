import { createInterface } from 'node:readline/promises';
import { pilotPolicy, runReceiptPilot, PilotFailure } from '../src/pilot/receiptPilot';

try {
  const args = process.argv.slice(2);
  if (args.some((arg) => !['--fixture', '--live', '--my'].includes(arg)) || (args.includes('--fixture') && args.includes('--live'))) throw new Error('pilot_arguments_invalid');
  const policy = pilotPolicy(args.includes('--live') ? 'live' : 'fixture', args.includes('--my') ? 'C-MY' : 'C-SG', process.env, Boolean(process.stdin.isTTY && process.stdout.isTTY));
  const result = await runReceiptPilot(policy, async (review) => {
    if (policy.mode === 'fixture') return review.selectionDigest;
    process.stdout.write(JSON.stringify(review, null, 2) + '\n');
    const terminal = createInterface({ input: process.stdin, output: process.stdout });
    try { return await terminal.question('Review the exact synthetic selection above. Type its full selectionDigest to approve, or anything else to cancel: '); }
    finally { terminal.close(); }
  });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} catch (error) {
  // No raw provider, session, credential, database or transport details in CLI output.
  if (error instanceof PilotFailure) process.stderr.write(JSON.stringify({ code: error.code, outputDirectory: error.outputDirectory }) + '\n');
  process.stderr.write('Receipt pilot did not complete. Check explicit authorization, configuration and exact confirmation. No live success is claimed.\n');
  process.exitCode = 1;
}
