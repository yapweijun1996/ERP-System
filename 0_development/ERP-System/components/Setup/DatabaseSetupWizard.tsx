import React, { useEffect, useMemo, useState } from 'react';
import { Database, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

interface DatabaseSetupWizardProps {
    companyId: string | null;
    onComplete: () => void;
}

type DbStatus = 'checking' | 'ready' | 'empty' | 'not_found' | 'not_configured' | 'error';

function getApiUrl() {
    return (import.meta as any).env?.VITE_API_URL || 'http://localhost:6601';
}

async function readJson(response: Response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

export const DatabaseSetupWizard: React.FC<DatabaseSetupWizardProps> = ({ companyId, onComplete }) => {
    const API_URL = useMemo(() => getApiUrl(), []);
    const [status, setStatus] = useState<DbStatus>('checking');
    const [databaseName, setDatabaseName] = useState<string | null>(null);
    const [message, setMessage] = useState<string>('');
    const [isWorking, setIsWorking] = useState(false);
    const [loadSeedData, setLoadSeedData] = useState(false);

    const refreshStatus = async () => {
        if (!companyId) {
            setStatus('not_configured');
            setDatabaseName(null);
            setMessage('缺少 company。请用 ?company=vantajas 方式打开系统。');
            return;
        }

        setStatus('checking');
        setMessage('');
        try {
            const res = await fetch(`${API_URL}/api/setup/db-status?company=${encodeURIComponent(companyId)}`);
            const data = await readJson(res);
            if (!res.ok) {
                setStatus((data?.status as DbStatus) || 'error');
                setDatabaseName(data?.database || null);
                setMessage(data?.message || '读取数据库状态失败');
                return;
            }

            setStatus((data?.status as DbStatus) || 'error');
            setDatabaseName(data?.database || null);
            setMessage(data?.message || '');

            if (data?.status === 'ready') {
                setTimeout(() => onComplete(), 500);
            }
        } catch (e) {
            setStatus('error');
            setMessage(e instanceof Error ? e.message : '无法连接到后端');
        }
    };

    const initSchema = async () => {
        if (!companyId) return;
        setIsWorking(true);
        setMessage('');
        try {
            const res = await fetch(`${API_URL}/api/setup/init-schema?company=${encodeURIComponent(companyId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ loadSeedData }),
            });
            const data = await readJson(res);
            if (!res.ok) {
                setMessage(data?.message || '初始化失败');
                setStatus('error');
                return;
            }
            setMessage(data?.message || '初始化完成');
            await refreshStatus();
        } catch (e) {
            setStatus('error');
            setMessage(e instanceof Error ? e.message : '初始化失败');
        } finally {
            setIsWorking(false);
        }
    };

    useEffect(() => {
        refreshStatus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyId]);

    const title = (
        <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600 text-white">
                <Database className="w-5 h-5" />
            </div>
            <div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">数据库初始化</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                    company={companyId || '(missing)'} {databaseName ? `| db=${databaseName}` : ''}
                </div>
            </div>
        </div>
    );

    const statusBadge = (() => {
        if (status === 'checking') return <span className="text-slate-500">检查中...</span>;
        if (status === 'ready') return <span className="text-emerald-600">已就绪</span>;
        if (status === 'empty') return <span className="text-amber-600">空数据库</span>;
        if (status === 'not_found') return <span className="text-red-600">数据库不存在</span>;
        if (status === 'not_configured') return <span className="text-red-600">未配置</span>;
        return <span className="text-red-600">错误</span>;
    })();

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6">
                <div className="flex items-start justify-between gap-4">
                    {title}
                    <div className="text-xs font-semibold">{statusBadge}</div>
                </div>

                <div className="mt-5 text-sm text-slate-700 dark:text-slate-300">
                    {status === 'checking' ? (
                        <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            正在检查数据库状态...
                        </div>
                    ) : (
                        <div className="flex items-start gap-2">
                            {status === 'ready' ? (
                                <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                            ) : (
                                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                            )}
                            <div>{message || '—'}</div>
                        </div>
                    )}
                </div>

                <div className="mt-6 space-y-3">
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input
                            type="checkbox"
                            checked={loadSeedData}
                            onChange={(e) => setLoadSeedData(e.target.checked)}
                            disabled={isWorking}
                        />
                        加载 seed（示例数据，仅建议开发/演示用）
                    </label>

                    <div className="flex flex-wrap gap-2">
                        <button
                            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-60"
                            onClick={initSchema}
                            disabled={isWorking || status === 'ready' || !companyId}
                        >
                            {isWorking ? '执行中...' : '初始化数据库'}
                        </button>
                        <button
                            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold disabled:opacity-60"
                            onClick={refreshStatus}
                            disabled={isWorking}
                        >
                            重新检查
                        </button>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400">
                        打开方式：`http://localhost:6600/?company=vantajas`（公司不同就换 company 参数）
                    </div>
                </div>
            </div>
        </div>
    );
};

