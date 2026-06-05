// Canonical schema barrel — the single source of truth for both modes.
// drizzle.config.ts points here; the app imports tables from here.
export * from './tenancy';
export * from './localization';
export * from './inventory';
export * from './sales';
export * from './finance';
