import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

describe('static Demo startup boundary', () => {
  it('does not install a demo adapter or sample authentication in API mode', () => {
    const window = { erpDataMode: () => 'api' };
    runInNewContext(readFileSync('web/public/assets/erp-system-data-adapter.js', 'utf8'), { window, DB: {} });
    expect(window).not.toHaveProperty('ErpSystemData');
    expect(window).not.toHaveProperty('ErpSystemDemo');
    expect(window).not.toHaveProperty('__ERP_DEMO_PROGRESS__');
  });
});
