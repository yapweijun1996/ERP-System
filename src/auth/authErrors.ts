// Shared error type for src/auth/lifecycle.ts and src/auth/adminLifecycle.ts.
// Deliberately dependency-free (no node:crypto, no schema, no drizzle) so both a
// Node-only file and a browser-bundle-safe file can throw/catch the same class
// without either one dragging the other's dependency graph along.
export class AuthLifecycleError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}
