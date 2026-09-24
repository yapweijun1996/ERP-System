#!/usr/bin/env node

import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  verifyRelease,
  ReleaseVerificationError,
  parseCliArgs,
} from '../src/release/verifyRelease.mjs';

export { verifyRelease, ReleaseVerificationError };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseCliArgs(process.argv.slice(2));
    if (options.help) {
      console.log('Usage: node scripts/verify-release.mjs <origin> --expected-revision <commit>');
    } else {
      console.log(JSON.stringify(await verifyRelease(options)));
    }
  } catch (error) {
    const code = error instanceof ReleaseVerificationError ? error.code : 'verification_error';
    const message = error instanceof Error ? error.message : 'Release verification failed.';
    console.log(JSON.stringify({ status: 'failed', code, message }));
    process.exitCode = 1;
  }
}
