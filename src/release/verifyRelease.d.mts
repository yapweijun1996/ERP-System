export interface VerifiedRelease {
  status: 'verified';
  origin: string;
  expectedRevision: string;
  revision: string;
  fileCount: number;
  setupStatusKeys: string[];
  checks: Record<string, boolean>;
}

export class ReleaseVerificationError extends Error {
  code: string;
}

export function verifyRelease(options: {
  origin: string;
  expectedRevision: string;
  fetchImpl?: typeof fetch;
}): Promise<VerifiedRelease>;

export function parseCliArgs(
  args: string[],
  environment?: NodeJS.ProcessEnv,
): { help: true } | { origin: string; expectedRevision: string };
