import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const runtimeSource = readFileSync('web/public/assets/i18n.js', 'utf8');

interface RuntimeApi {
  getLang(): string;
  getLocale(): string;
  t(key: string, params?: Record<string, unknown>): string;
  setLang(code: string): Promise<boolean>;
  formatDate(value: string): string;
  i18nLegacy(packs: Record<string, Record<string, string>>): Record<string, string>;
}

function runtime(options: {
  stored?: string;
  fetchPack?: (code: string) => Promise<Record<string, unknown>>;
} = {}) {
  const storage = new Map<string, string>();
  if (options.stored) storage.set('aria-lang', options.stored);
  const events: Array<{ type: string; detail?: unknown }> = [];
  const root = {
    querySelectorAll: () => [],
  };
  const document = {
    currentScript: { src: 'http://erp.test/assets/i18n.js' },
    documentElement: { setAttribute: vi.fn() },
    querySelector: () => null,
    querySelectorAll: () => [],
    createTreeWalker: () => ({ nextNode: () => false, currentNode: null }),
  };
  const fetchMock = vi.fn(async (url: URL) => {
    const code = url.pathname.split('/').pop()?.replace('.json', '') || '';
    try {
      const pack = await (options.fetchPack?.(code) ?? Promise.resolve({ greeting: `hello-${code}` }));
      return { ok: true, status: 200, json: async () => pack };
    } catch {
      return { ok: false, status: 503, json: async () => ({}) };
    }
  });
  class TestEvent {
    type: string;
    detail?: unknown;
    constructor(type: string, init?: { detail?: unknown }) {
      this.type = type;
      this.detail = init?.detail;
    }
  }
  const windowObject: Record<string, unknown> = {
    __ERP_I18N_EN__: Object.freeze({
      greeting: 'Hello {name}',
      items: { one: '{count} item', other: '{count} items' },
      'error.unknown': 'Something went wrong.',
    }),
    dispatchEvent: (event: TestEvent) => { events.push(event); return true; },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  const context = vm.createContext({
    window: windowObject,
    document,
    location: { href: 'http://erp.test/' },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
    fetch: fetchMock,
    CustomEvent: TestEvent,
    NodeFilter: { SHOW_TEXT: 4, FILTER_REJECT: 2, FILTER_ACCEPT: 1 },
    Node: class {},
    URL,
    Intl,
    Object,
    Array,
    Map,
    Set,
    Promise,
    Number,
    String,
    Date,
    RegExp,
    JSON,
    console,
    setTimeout,
    clearTimeout,
    root,
  });
  vm.runInContext(runtimeSource, context);
  return { api: windowObject as unknown as RuntimeApi, storage, events, fetchMock };
}

describe('browser i18n runtime', () => {
  it('uses the fixed English locale, interpolation and plural rules', () => {
    const { api } = runtime();
    expect(api.getLang()).toBe('en');
    expect(api.getLocale()).toBe('en-SG');
    expect(api.t('greeting', { name: 'Dana' })).toBe('Hello Dana');
    expect(api.t('greeting', { name: '<Dana & team>' })).toBe('Hello &lt;Dana &amp; team&gt;');
    expect(api.t('items', { count: 1 })).toBe('1 item');
    expect(api.t('items', { count: 3 })).toBe('3 items');
  });

  it('deduplicates locale loads and switches atomically', async () => {
    let resolvePack: (pack: Record<string, unknown>) => void = () => undefined;
    const pending = new Promise<Record<string, unknown>>((resolve) => { resolvePack = resolve; });
    const { api, storage, events, fetchMock } = runtime({ fetchPack: () => pending });
    const first = api.setLang('ms') as Promise<boolean>;
    const second = api.setLang('ms') as Promise<boolean>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(api.getLang()).toBe('en');
    resolvePack({ greeting: 'Hai {name}', items: { other: '{count} item' } });
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(api.getLang()).toBe('ms');
    expect(storage.get('aria-lang')).toBe('ms');
    expect(events.some((event) => event.type === 'erp:localechange')).toBe(true);
  });

  it('keeps the active language and preference when loading fails', async () => {
    const { api, storage } = runtime({ fetchPack: async () => { throw new Error('offline'); } });
    await expect(api.setLang('ja')).resolves.toBe(false);
    expect(api.getLang()).toBe('en');
    expect(storage.has('aria-lang')).toBe(false);
  });

  it('merges registered screen copy without suppressing the lazy locale request', async () => {
    const { api, fetchMock } = runtime({
      fetchPack: async () => ({ greeting: 'Hai {name}' }),
    });
    expect(api.i18nLegacy({ en: { title: 'Settings' }, ms: { title: 'Tetapan' } }).title).toBe('Settings');
    await expect(api.setLang('ms')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(api.i18nLegacy({ en: { title: 'Settings' }, ms: { title: 'Tetapan' } }).title).toBe('Tetapan');
  });

  it('rejects markup and preserves date-only calendar values', async () => {
    const { api } = runtime({ fetchPack: async () => ({ unsafe: '<b>bad</b>' }) });
    await expect(api.setLang('vi')).resolves.toBe(false);
    const formatted = api.formatDate('2026-01-02') as string;
    expect(formatted).toContain('2026');
    expect(formatted).toMatch(/2/);
  });
});
