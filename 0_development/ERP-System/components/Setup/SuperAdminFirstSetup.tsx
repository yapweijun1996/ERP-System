import React, { useMemo, useState } from 'react';
import { ShieldCheck, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface SuperAdminFirstSetupProps {
    onComplete: () => void;
}

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

export const SuperAdminFirstSetup: React.FC<SuperAdminFirstSetupProps> = ({ onComplete }) => {
    const API_URL = useMemo(() => getApiUrl(), []);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isWorking, setIsWorking] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const p = password.trim();
        if (p.length < 10) return setError('密码至少 10 位');
        if (p !== confirm.trim()) return setError('两次密码不一致');

        setIsWorking(true);
        try {
            const res = await fetch(`${API_URL}/api/setup/superadmin-init-account`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: p, email: email.trim() || null }),
            });
            const data = await readJson(res);
            if (!res.ok) {
                setError(data?.message || '设置失败');
                return;
            }
            onComplete();
        } catch (e2) {
            setError(e2 instanceof Error ? e2.message : '设置失败');
        } finally {
            setIsWorking(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-600 text-white">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-lg font-bold text-slate-900 dark:text-white">初始化 Super Admin 账号</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">首次启动需设置新密码</div>
                    </div>
                </div>

                <div className="mt-4 text-sm text-slate-700 dark:text-slate-300">
                    系统检测到 superadmin 仍为默认密码，请先设置一个新密码再继续。
                </div>

                {error && (
                    <div className="mt-4 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                        <AlertCircle className="w-4 h-4 mt-0.5" />
                        <div>{error}</div>
                    </div>
                )}

                <form className="mt-6 space-y-4" onSubmit={submit}>
                    <label className="text-sm block">
                        <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Email（可选）</div>
                        <input
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isWorking}
                        />
                    </label>

                    <label className="text-sm block">
                        <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">新密码（至少 10 位）</div>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="w-full px-3 py-2 pr-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isWorking}
                            />
                            <button
                                type="button"
                                className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                onClick={() => setShowPassword((v) => !v)}
                                disabled={isWorking}
                                aria-label={showPassword ? '隐藏密码' : '显示密码'}
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </label>

                    <label className="text-sm block">
                        <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">确认密码</div>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            disabled={isWorking}
                        />
                    </label>

                    <button
                        type="submit"
                        className="w-full px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
                        disabled={isWorking}
                    >
                        {isWorking && <Loader2 className="w-4 h-4 animate-spin" />}
                        保存并继续
                    </button>
                </form>
            </div>
        </div>
    );
};

