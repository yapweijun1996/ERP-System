import React, { useMemo, useState } from 'react';
import { ShieldCheck, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../../api/auth';

interface FirstAdminSetupProps {
    companyId: string;
    onComplete: () => void;
}

function validate(input: {
    username: string;
    password: string;
    name: string;
    companyName: string;
    email: string;
}) {
    if (!input.companyName.trim()) return '公司名称必填';
    if (!input.name.trim()) return '姓名必填';
    if (!input.username.trim()) return '用户名必填';
    if (!input.password.trim()) return '密码必填';
    if (input.password.trim().length < 6) return '密码至少 6 位';
    return null;
}

export const FirstAdminSetup: React.FC<FirstAdminSetupProps> = ({ companyId, onComplete }) => {
    const defaults = useMemo(() => {
        const guess = companyId.trim() || 'company';
        return {
            companyName: guess,
            username: 'admin',
            password: 'password',
            name: 'Admin',
            email: `admin@${guess}.com`,
        };
    }, [companyId]);

    const [companyName, setCompanyName] = useState(defaults.companyName);
    const [username, setUsername] = useState(defaults.username);
    const [password, setPassword] = useState(defaults.password);
    const [showPassword, setShowPassword] = useState(false);
    const [name, setName] = useState(defaults.name);
    const [email, setEmail] = useState(defaults.email);

    const [isWorking, setIsWorking] = useState(false);
    const [error, setError] = useState<string>('');

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const err = validate({ username, password, name, companyName, email });
        if (err) {
            setError(err);
            return;
        }

        setIsWorking(true);
        try {
            const res = await authApi.register({
                username: username.trim(),
                password: password.trim(),
                name: name.trim(),
                companyName: companyName.trim(),
                email: email.trim() || undefined,
            } as any);

            localStorage.setItem('auth_token', res.token);
            onComplete();
            window.location.reload();
        } catch (e) {
            setError(e instanceof Error ? e.message : '创建管理员失败');
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
                        <div className="text-lg font-bold text-slate-900 dark:text-white">创建首个管理员</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">company={companyId}</div>
                    </div>
                </div>

                <div className="mt-4 text-sm text-slate-700 dark:text-slate-300">
                    数据库已初始化，但当前没有任何用户。请先创建一个管理员账号用于登录。
                </div>

                {error && (
                    <div className="mt-4 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                        <AlertCircle className="w-4 h-4 mt-0.5" />
                        <div>{error}</div>
                    </div>
                )}

                <form className="mt-6 space-y-4" onSubmit={handleCreate}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="text-sm">
                            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">公司名称</div>
                            <input
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                disabled={isWorking}
                            />
                        </label>
                        <label className="text-sm">
                            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">姓名</div>
                            <input
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={isWorking}
                            />
                        </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="text-sm">
                            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">用户名</div>
                            <input
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                disabled={isWorking}
                            />
                        </label>
                        <label className="text-sm">
                            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">密码</div>
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
                    </div>

                    <label className="text-sm block">
                        <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Email（可选）</div>
                        <input
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isWorking}
                        />
                    </label>

                    <button
                        type="submit"
                        className="w-full px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
                        disabled={isWorking}
                    >
                        {isWorking && <Loader2 className="w-4 h-4 animate-spin" />}
                        创建管理员并登录
                    </button>
                </form>
            </div>
        </div>
    );
};
