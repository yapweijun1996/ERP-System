import React, { useState, useEffect } from 'react';
import { SuperAdminFirstSetup } from './SuperAdminFirstSetup';
import { NotFound } from '../../pages/common/NotFound';

interface DatabaseSetupGuardProps {
    children: React.ReactNode;
}

export const DatabaseSetupGuard: React.FC<DatabaseSetupGuardProps> = ({ children }) => {
    const [mode, setMode] = useState<
        'checking' | 'bootstrapping' | 'ready' | 'error' | 'not-found' | 'superadmin-setup'
    >('checking');
    const [message, setMessage] = useState<string>('');

    useEffect(() => {
        const checkSuperadmin = async () => {
            try {
                const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:6601';
                setMessage('');
                setMode('checking');

                const params = new URLSearchParams(window.location.search);
                const tenantId = (params.get('tenantid') || params.get('tenantId') || '').trim().toLowerCase();
                if (tenantId !== 'superadmin') {
                    setMode('not-found');
                    return;
                }

                const statusRes = await fetch(`${API_URL}/api/setup/superadmin-status`);
                const statusData = await statusRes.json().catch(() => null);

                const status = statusData?.status;
                if (status === 'ready') {
                    const userRes = await fetch(`${API_URL}/api/setup/superadmin-user-status`);
                    const userData = await userRes.json().catch(() => null);
                    if (userData?.needsSetup) {
                        setMode('superadmin-setup');
                        return;
                    }
                    setMode('ready');
                    return;
                }

                if (status === 'not_found' || status === 'empty') {
                    setMode('bootstrapping');
                    // Ensure UI has time to render the bootstrapping view.
                    await new Promise((r) => setTimeout(r, 300));
                    const bootstrapRes = await fetch(`${API_URL}/api/setup/bootstrap-superadmin`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({}),
                    });
                    const bootstrapData = await bootstrapRes.json().catch(() => null);
                    if (!bootstrapRes.ok) {
                        setMode('error');
                        setMessage(bootstrapData?.message || 'Bootstrap superadmin 失败');
                        return;
                    }
                    if (bootstrapData?.status !== 'ready') {
                        setMode('error');
                        setMessage(bootstrapData?.message || 'Bootstrap superadmin 未完成');
                        return;
                    }
                    const userRes = await fetch(`${API_URL}/api/setup/superadmin-user-status`);
                    const userData = await userRes.json().catch(() => null);
                    if (userData?.needsSetup) {
                        setMode('superadmin-setup');
                        return;
                    }
                    // Small delay to make the transition visible and reduce flicker.
                    await new Promise((r) => setTimeout(r, 300));
                    setMode('ready');
                    return;
                }

                setMode('error');
                setMessage(statusData?.message || '无法判断 superadmin 数据库状态');
            } catch (error) {
                console.error('Failed to check superadmin status:', error);
                setMode('error');
                setMessage(error instanceof Error ? error.message : '无法连接到后端');
            }
        };

        checkSuperadmin();
    }, []);

    // Show loading while checking database status
    if (mode === 'checking') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600 dark:text-slate-400">正在检查 Super Admin 数据库...</p>
                </div>
            </div>
        );
    }

    if (mode === 'not-found') {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-6">
                <NotFound onNavigate={() => window.location.href = '/'} />
            </div>
        );
    }

    if (mode === 'bootstrapping') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-900 dark:text-white font-semibold">正在初始化 Super Admin 环境...</p>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mt-2">
                        创建数据库并导入 schema/seed（首次启动可能需要几十秒）
                    </p>
                </div>
            </div>
        );
    }

    if (mode === 'superadmin-setup') {
        const SetupComponent = SuperAdminFirstSetup as any;
        if (!SetupComponent) {
            return (
                <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-6">
                    <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6">
                        <div className="text-lg font-bold text-slate-900 dark:text-white">启动失败</div>
                        <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            Super Admin 初始化组件加载失败
                        </div>
                        <button
                            className="mt-5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold"
                            onClick={() => window.location.reload()}
                        >
                            重新尝试
                        </button>
                    </div>
                </div>
            );
        }
        return <SetupComponent onComplete={() => window.location.reload()} />;
    }

    if (mode === 'error') {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-6">
                <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6">
                    <div className="text-lg font-bold text-slate-900 dark:text-white">启动失败</div>
                    <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">{message || '未知错误'}</div>
                    <button
                        className="mt-5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold"
                        onClick={() => window.location.reload()}
                    >
                        重新尝试
                    </button>
                </div>
            </div>
        );
    }

    // Database is ready, show the app
    return <>{children}</>;
};
