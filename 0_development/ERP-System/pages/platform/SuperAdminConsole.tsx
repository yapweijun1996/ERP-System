import React, { useEffect, useMemo, useState } from 'react';
import { superadminApi, SuperadminCompany, SuperadminMaster } from '../../api/superadmin';

export const SuperAdminConsole: React.FC = () => {
    const [masters, setMasters] = useState<SuperadminMaster[]>([]);
    const [selectedMasterId, setSelectedMasterId] = useState<string | null>(null);
    const selectedMaster = useMemo(
        () => masters.find(m => m.id === selectedMasterId) || null,
        [masters, selectedMasterId],
    );

    const [companies, setCompanies] = useState<SuperadminCompany[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string>('');

    const [newMasterName, setNewMasterName] = useState('');
    const [newCompanyName, setNewCompanyName] = useState('');

    const refreshMasters = async () => {
        setIsLoading(true);
        setError('');
        try {
            const res = await superadminApi.listMasters();
            setMasters(res.masters || []);
            if (!selectedMasterId && res.masters?.length) setSelectedMasterId(res.masters[0].id);
        } catch (e) {
            setError(e instanceof Error ? e.message : '读取 master 列表失败');
        } finally {
            setIsLoading(false);
        }
    };

    const refreshCompanies = async (masterId: string) => {
        setIsLoading(true);
        setError('');
        try {
            const res = await superadminApi.listCompanies(masterId);
            setCompanies(res.companies || []);
        } catch (e) {
            setError(e instanceof Error ? e.message : '读取 company 列表失败');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshMasters();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        setCompanies([]);
        if (!selectedMasterId) return;
        refreshCompanies(selectedMasterId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMasterId]);

    const createMaster = async () => {
        const name = newMasterName.trim();
        if (!name) return;
        setIsLoading(true);
        setError('');
        try {
            const created = await superadminApi.createMaster({ name });
            setNewMasterName('');
            setMasters(prev => [created, ...prev]);
            setSelectedMasterId(created.id);
        } catch (e) {
            setError(e instanceof Error ? e.message : '创建 master 失败');
        } finally {
            setIsLoading(false);
        }
    };

    const createCompany = async () => {
        const masterId = selectedMasterId;
        const name = newCompanyName.trim();
        if (!masterId || !name) return;
        setIsLoading(true);
        setError('');
        try {
            const created = await superadminApi.createCompany(masterId, { name });
            setNewCompanyName('');
            setCompanies(prev => [created, ...prev]);
        } catch (e) {
            setError(e instanceof Error ? e.message : '创建 company 失败');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col gap-4 p-4 md:p-8">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">Super Admin Console</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                        管理 masterfn（tenants）与 company（companies）
                    </div>
                </div>
                <button
                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-semibold disabled:opacity-60"
                    onClick={refreshMasters}
                    disabled={isLoading}
                >
                    刷新
                </button>
            </div>

            {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 flex-1">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 min-h-0 flex flex-col">
                    <div className="font-semibold text-slate-900 dark:text-white">Masters</div>
                    <div className="mt-3 flex gap-2">
                        <input
                            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
                            placeholder="新 master 名称"
                            value={newMasterName}
                            onChange={e => setNewMasterName(e.target.value)}
                            disabled={isLoading}
                        />
                        <button
                            className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-60"
                            onClick={createMaster}
                            disabled={isLoading || !newMasterName.trim()}
                        >
                            创建
                        </button>
                    </div>

                    <div className="mt-4 overflow-auto min-h-0">
                        <ul className="space-y-2">
                            {masters.map(m => {
                                const active = m.id === selectedMasterId;
                                return (
                                    <li key={m.id}>
                                        <button
                                            className={[
                                                'w-full text-left px-3 py-2 rounded-xl border text-sm',
                                                active
                                                    ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800'
                                                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950',
                                            ].join(' ')}
                                            onClick={() => setSelectedMasterId(m.id)}
                                        >
                                            <div className="font-semibold text-slate-900 dark:text-white">{m.name}</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">{m.id}</div>
                                        </button>
                                    </li>
                                );
                            })}
                            {!masters.length && (
                                <li className="text-sm text-slate-500 dark:text-slate-400">暂无 master</li>
                            )}
                        </ul>
                    </div>
                </div>

                <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 min-h-0 flex flex-col">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="font-semibold text-slate-900 dark:text-white">Companies</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                master={selectedMaster?.name || '(未选择)'}
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                        <input
                            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm"
                            placeholder="新 company 名称"
                            value={newCompanyName}
                            onChange={e => setNewCompanyName(e.target.value)}
                            disabled={isLoading || !selectedMasterId}
                        />
                        <button
                            className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-60"
                            onClick={createCompany}
                            disabled={isLoading || !selectedMasterId || !newCompanyName.trim()}
                        >
                            创建
                        </button>
                    </div>

                    <div className="mt-4 overflow-auto min-h-0">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-slate-500 dark:text-slate-400">
                                <tr>
                                    <th className="text-left py-2">Name</th>
                                    <th className="text-left py-2">ID</th>
                                    <th className="text-left py-2">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {companies.map(c => (
                                    <tr key={c.id} className="border-t border-slate-100 dark:border-slate-800">
                                        <td className="py-2 font-semibold text-slate-900 dark:text-white">{c.name}</td>
                                        <td className="py-2 text-slate-600 dark:text-slate-300">{c.id}</td>
                                        <td className="py-2 text-slate-600 dark:text-slate-300">{c.status || 'Active'}</td>
                                    </tr>
                                ))}
                                {!companies.length && (
                                    <tr>
                                        <td className="py-3 text-slate-500 dark:text-slate-400" colSpan={3}>
                                            {selectedMasterId ? '暂无 company' : '请先选择一个 master'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

