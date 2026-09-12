import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../web/public/assets/screens-hr.js', import.meta.url), 'utf8');

interface ReceiptListOptions {
  primaryAction: { onClick(): void } | null;
  toolbarActions: Array<{ label: string }>;
  toolbarContent: string;
}

async function render(response: unknown) {
  const listPage = vi.fn();
  const fileClick = vi.fn();
  const context = {
    SCREENS: {} as Record<string, (root: unknown) => Promise<void>>,
    window: {
      ErpSystemData: { my: { context: async () => response, receipts: async () => ({ data: [] }) } },
      ErpReceiptDrafts: { list: async () => [] },
    },
    transactionListPage: listPage,
    getLang: () => 'en',
    i18nLegacy: (packs: { en: Record<string, string> }) => packs.en,
    esc: (value: string) => value,
  };
  runInNewContext(source, context);
  await context.SCREENS['my-receipts']({ querySelector: () => ({ click: fileClick }) });
  return { options: listPage.mock.calls[0][1] as ReceiptListOptions, fileClick };
}

describe('My Receipts capability response envelope', () => {
  it('exposes capture and upload for the adapter-authorized employee', async () => {
    const { options, fileClick } = await render({
      data: { capabilities: { receipts: { available: true, writable: true } } },
      meta: { actorDerived: true },
    });
    expect(options.primaryAction).not.toBeNull();
    expect(options.toolbarActions).toHaveLength(2);
    expect(options.toolbarContent).toContain('data-receipt-file');
    options.primaryAction?.onClick();
    expect(fileClick).toHaveBeenCalledOnce();
  });

  it.each([false, undefined])('hides upload when data grants no write capability (%s)', async (writable) => {
    const { options } = await render({
      data: { capabilities: { receipts: { available: true, writable } } },
      capabilities: { receipts: { writable: true } },
    });
    expect(options.primaryAction).toBeNull();
    expect(options.toolbarActions).toEqual([]);
    expect(options.toolbarContent).toBe('');
  });
});
