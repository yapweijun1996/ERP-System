import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

export function AppSplash({
  appName = 'Nexus ERP',
  subtitle = '系统启动中',
  message = '正在恢复登录状态...',
  timeoutMs = 3000,
  timeoutHint = '网络较慢，点击重新加载。',
  reloadLabel = '重新加载',
  onReload,
}: {
  appName?: string;
  subtitle?: string;
  message?: string;
  timeoutMs?: number;
  timeoutHint?: string;
  reloadLabel?: string;
  onReload?: () => void;
}) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return;
    const t = window.setTimeout(() => setTimedOut(true), timeoutMs);
    return () => window.clearTimeout(t);
  }, [timeoutMs]);

  const handleReload = () => {
    if (onReload) return onReload();
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-semibold">
            ERP
          </div>
          <div className="flex-1">
            <div className="text-slate-900 font-semibold leading-tight">{appName}</div>
            <div className="text-slate-500 text-sm leading-tight">{subtitle}</div>
          </div>
          <Loader2 className="h-5 w-5 animate-spin text-slate-600" />
        </div>

        <div className="mt-4 text-sm text-slate-600">{message}</div>

        {timedOut && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <div className="flex items-center justify-between gap-3">
              <div className="leading-snug">{timeoutHint}</div>
              <button
                type="button"
                onClick={handleReload}
                className="shrink-0 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
              >
                {reloadLabel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
