import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('../web/public/assets/erp-webmcp-adapter.js', import.meta.url)),
  'utf8',
);
const actions = [
  'receipt.search',
  'receipt.get',
  'receipt_pack.prepare',
  'receipt_pack.create',
  'receipt_pack.get',
  'receipt_pack.export',
];

type ToolExecute = (input: unknown, options?: { signal?: AbortSignal }) => unknown;
type TestTool = { name: string; execute: ToolExecute };
type TestAdapter = {
  companyReceipts: ReturnType<typeof vi.fn>;
  companyReceipt: ReturnType<typeof vi.fn>;
  companyReceiptPackPrepare: ReturnType<typeof vi.fn>;
  companyReceiptPackGet: ReturnType<typeof vi.fn>;
  companyReceiptPackPdf: ReturnType<typeof vi.fn>;
};
type TestWindow = {
  DB: {
    user: { userId: number; email: string; permissionKeys: string[] };
    erpSystem: {
      scope: { masterFn: string; companyFn: string };
      modules: Array<{ moduleKey: string; enabled: boolean }>;
    };
  };
  __ERP_CURRENT_ROUTE__: string;
  ErpSystemData: TestAdapter;
  ErpWebMcp: {
    sync(reason: string): Promise<unknown>;
    invalidate(reason: string): void;
    getState(): { registered: string[] };
    hasNativeSupport(): boolean;
  };
};

function harness(supported = true) {
  const registered: Array<{ tool: TestTool; signal: AbortSignal }> = [];
  const modelContext = supported ? {
    async registerTool(tool: TestTool, options: { signal: AbortSignal }) {
      registered.push({ tool, signal: options.signal });
    },
  } : undefined;
  const adapter: TestAdapter = {
    companyReceipts: vi.fn(async (input: unknown) => ({ data: [input], meta: {} })),
    companyReceipt: vi.fn(async (id: number) => ({ data: { id }, meta: {} })),
    companyReceiptPackPrepare: vi.fn(async (input: unknown) => ({ data: input, meta: {} })),
    companyReceiptPackGet: vi.fn(async (id: number) => ({ data: { id }, meta: {} })),
    companyReceiptPackPdf: vi.fn(async (id: number, action: string) => ({ data: { id, action }, meta: {} })),
  };
  const windowObject: Record<string, unknown> = {
    AbortController,
    DB: {
      user: {
        userId: 7,
        email: 'operator@example.test',
        permissionKeys: ['expenses.company_receipts.read_company'],
      },
      erpSystem: {
        scope: { masterFn: 'M1', companyFn: 'C-SG' },
        modules: [{ moduleKey: 'expenses_tax', enabled: true }],
      },
    },
    __ERP_CURRENT_ROUTE__: 'company-receipts',
    document: {
      modelContext,
      body: { classList: { contains: () => false } },
    },
    ErpSystemData: adapter,
    btoa: (value: string) => Buffer.from(value, 'binary').toString('base64'),
  };
  windowObject.window = windowObject;
  runInNewContext(source, windowObject, { filename: 'erp-webmcp-adapter.js' });
  return {
    window: windowObject as unknown as TestWindow,
    registered,
    adapter,
  };
}

describe('WebMCP page adapter lifecycle', () => {
  it('registers only the six pilot tools for the live authorized route', async () => {
    const test = harness();

    await expect(test.window.ErpWebMcp.sync('boot')).resolves.toMatchObject({
      supported: true,
      registered: actions,
    });
    expect(test.registered.map(({ tool }) => tool.name)).toEqual(actions);
    expect(test.window.ErpWebMcp.getState()).toMatchObject({
      reason: 'registered',
      registered: actions,
    });
  });

  it('unregisters and rejects an old tool after navigation', async () => {
    const test = harness();
    await test.window.ErpWebMcp.sync('boot');
    const oldTool = test.registered[0].tool;

    test.window.__ERP_CURRENT_ROUTE__ = 'dashboard';
    test.window.ErpWebMcp.invalidate('navigation');

    await expect(oldTool.execute({ search: 'old context' })).rejects.toMatchObject({
      code: 'webmcp_context_stale',
    });
    expect(test.registered[0].signal.aborted).toBe(true);
    expect(test.adapter.companyReceipts).not.toHaveBeenCalled();
  });

  it('rejects permission revocation before dispatch and retires the registration', async () => {
    const test = harness();
    await test.window.ErpWebMcp.sync('boot');
    const oldTool = test.registered[0].tool;

    test.window.DB.user.permissionKeys = [];

    await expect(oldTool.execute({})).rejects.toMatchObject({ code: 'permission_denied' });
    expect(test.window.ErpWebMcp.getState()).toMatchObject({ registered: [] });
    expect(test.adapter.companyReceipts).not.toHaveBeenCalled();
  });

  it('rejects a Company change using the old registration fingerprint', async () => {
    const test = harness();
    await test.window.ErpWebMcp.sync('boot');
    const oldTool = test.registered[0].tool;

    test.window.DB.erpSystem.scope.companyFn = 'C-MY';

    await expect(oldTool.execute({})).rejects.toMatchObject({ code: 'webmcp_context_stale' });
    expect(test.adapter.companyReceipts).not.toHaveBeenCalled();
  });

  it('honours WebMCP cancellation without dispatching a completed result', async () => {
    const test = harness();
    await test.window.ErpWebMcp.sync('boot');
    const oldTool = test.registered[0].tool;
    const controller = new AbortController();
    test.adapter.companyReceipts.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({ data: [], meta: {} }), 0)),
    );

    const pending = oldTool.execute({}, { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ code: 'webmcp_execution_cancelled' });
  });

  it('encodes binary Pack exports into a native JSON-safe result', async () => {
    const test = harness();
    test.adapter.companyReceiptPackPdf.mockResolvedValueOnce({
      data: { content: new Uint8Array([0, 1, 255]), mimeType: 'application/pdf' },
      meta: { immutableSnapshot: true },
    });
    await test.window.ErpWebMcp.sync('boot');
    const exportTool = test.registered.find(({ tool }) => tool.name === 'receipt_pack.export')?.tool;

    await expect(exportTool?.execute({ packId: 7, action: 'view' })).resolves.toMatchObject({
      data: {
        content: 'AAH/',
        contentEncoding: 'base64',
        byteLength: 3,
        mimeType: 'application/pdf',
      },
    });
  });

  it('is inert when the browser does not expose native document.modelContext', async () => {
    const test = harness(false);

    await expect(test.window.ErpWebMcp.sync('probe')).resolves.toEqual({
      supported: false,
      registered: [],
    });
    expect(test.registered).toHaveLength(0);
    expect(test.window.ErpWebMcp.hasNativeSupport()).toBe(false);
  });
});
