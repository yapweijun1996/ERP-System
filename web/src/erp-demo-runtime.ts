declare global {
  interface Window {
    ErpDemoRuntime?: unknown;
    __resolveErpDemoRuntime?: (runtime: unknown) => void;
    __rejectErpDemoRuntime?: (error: unknown) => void;
    erpDataMode?: () => 'demo' | 'api';
  }
}

async function installRuntime() {
  const buildDataMode = import.meta.env.VITE_DATA_MODE === 'api' ? 'api' : 'demo';
  if (buildDataMode !== 'demo' || window.erpDataMode?.() !== 'demo') {
    window.__resolveErpDemoRuntime?.(null);
    return;
  }
  try {
    const { erpDemoRuntime } = await import('./erp-demo-runtime-impl');
    window.ErpDemoRuntime = erpDemoRuntime;
    window.__resolveErpDemoRuntime?.(erpDemoRuntime);
  } catch (error) {
    window.__rejectErpDemoRuntime?.(error);
  }
}

void installRuntime();

export {};
