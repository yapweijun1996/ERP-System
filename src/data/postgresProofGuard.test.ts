import { describe, expect, it } from 'vitest';
import {
  assertPostgresProofDatabaseEmpty,
  PostgresProofDatabaseNotEmptyError,
} from './postgresProofGuard';

describe('PostgreSQL proof database guard', () => {
  it('allows a database with no user tables', () => {
    expect(() => assertPostgresProofDatabaseEmpty({
      databaseName: 'erp_proof',
      relationCount: 0,
      relationNames: [],
    })).not.toThrow();
  });

  it('fails closed with a clear, bounded inventory before migration or seed', () => {
    const inventory = {
      databaseName: 'erp_uat',
      relationCount: 7,
      relationNames: [
        'public.app_user',
        'public.company',
        'public.customer',
        'public.employee',
        'public.master',
        'public.product',
        'public.supplier',
      ],
    };
    expect(() => assertPostgresProofDatabaseEmpty(inventory)).toThrowError(
      PostgresProofDatabaseNotEmptyError,
    );
    expect(() => assertPostgresProofDatabaseEmpty(inventory)).toThrow(
      'PostgreSQL proof refused database "erp_uat": found 7 user table(s) '
      + '(public.app_user, public.company, public.customer, public.employee, public.master, …). '
      + 'Use a new empty disposable database. No migrations or seed data were written.',
    );
  });
});
