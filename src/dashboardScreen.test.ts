import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../web/public/assets/screens-ops.js', import.meta.url), 'utf8');

function render(activeModules: string[], metrics: Record<string, number | null>) {
  const root = { innerHTML: '', querySelectorAll: () => [] as never[] };
  const context = {
    SCREENS: {} as Record<string, (target: typeof root) => void>,
    DB: {
      user: { name: 'Company Owner' },
      company: { name: 'Test Company', branch: 'HQ', period: 'Live', currency: 'MYR' },
      dashboardMetrics: metrics,
      approvals: [],
    },
    ROUTE_MODULE: {},
    approvalVisibleToUser: () => false,
    approvalRouteForUser: () => '',
    routeAllowed: () => false,
    userHasAnyPermission: () => true,
    moduleState: (module: string) => ({ active: activeModules.includes(module), visible: activeModules.includes(module) }),
    t: (key: string) => key,
    esc: (value: string) => value,
    ic: () => '',
    crumbs: () => '',
    num: (value: number) => String(value),
    money: (value: number | null) => value == null ? '—' : `RM${Math.abs(value).toFixed(2)}`,
  };
  runInNewContext(source, context);
  context.SCREENS.dashboard(root);
  return root.innerHTML;
}

describe('dashboard monetary KPI ownership', () => {
  it('hides sales and finance amounts when their modules are disabled', () => {
    const html = render([], { openOrderValue: 10, cash: 20, mtdSales: 30 });
    expect(html).not.toContain('dash.kpi.openorder');
    expect(html).not.toContain('dash.kpi.cash');
    expect(html).not.toContain('dash.kpi.mtd');
  });

  it('shows enabled module amounts and does not turn missing cash into zero', () => {
    const html = render(['sales', 'finance'], { openOrderValue: 10, cash: null, mtdSales: 30 });
    expect(html).toContain('dash.kpi.openorder');
    expect(html).toContain('RM10.00');
    expect(html).toContain('dash.kpi.cash');
    expect(html).toContain('<b class="tnum">—</b>');
    expect(html).toContain('dash.kpi.mtd');
    expect(html).toContain('RM30.00');
  });
});
