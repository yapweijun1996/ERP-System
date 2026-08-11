import { describe, expect, it } from 'vitest';
import { moduleKeyForBespokeApiPath } from './moduleEntitlement';

describe('bespoke API module mapping', () => {
  it('maps protected business APIs without selling baseline services', () => {
    expect(moduleKeyForBespokeApiPath('/api/hr/calendar/holidays')).toBe('hr');
    expect(moduleKeyForBespokeApiPath('/api/integration/connectors')).toBe('integration');
    expect(moduleKeyForBespokeApiPath('/api/finance/reports/profit-loss')).toBe('finance');
    expect(moduleKeyForBespokeApiPath('/api/reporting/jobs/1')).toBe('bi');
    expect(moduleKeyForBespokeApiPath('/api/my/leave-requests')).toBe('hr');
    expect(moduleKeyForBespokeApiPath('/api/admin/users')).toBeNull();
    expect(moduleKeyForBespokeApiPath('/api/dashboard')).toBeNull();
    expect(moduleKeyForBespokeApiPath('/api/account/activity')).toBeNull();
  });
});
