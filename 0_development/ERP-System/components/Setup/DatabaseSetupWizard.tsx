import React, { useState, useEffect } from 'react';
import { Database, CheckCircle, AlertCircle, Loader, RefreshCw } from 'lucide-react';

interface DatabaseSetupWizardProps {
    onComplete: () => void;
}

type SetupStep = 'checking' | 'choose' | 'create' | 'select' | 'complete' | 'error';
type DatabaseStatus = 'ready' | 'empty' | 'not_configured' | 'error' | 'checking';

export const DatabaseSetupWizard: React.FC<DatabaseSetupWizardProps> = ({ onComplete }) => {
    const [step, setStep] = useState<SetupStep>('checking');
    const [status, setStatus] = useState<DatabaseStatus>('checking');
    const [errorMessage, setErrorMessage] = useState('');
    const [loading, setLoading] = useState(false);

    // Create database form
    const [newDbName, setNewDbName] = useState('nexus_erp');
    const [loadSeedData, setLoadSeedData] = useState(true);

    // Select database form
    const [availableDatabases, setAvailableDatabases] = useState<string[]>([]);
    const [selectedDb, setSelectedDb] = useState('');

    const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

    // Check database status on mount
    useEffect(() => {
        checkDatabaseStatus();
    }, []);

    const checkDatabaseStatus = async () => {
        try {
            setStatus('checking');
            const response = await fetch(`${API_URL}/api/setup/status`);
            const data = await response.json();

            setStatus(data.status);

            if (data.status === 'ready') {
                setStep('complete');
                setTimeout(() => onComplete(), 1500);
            } else if (data.status === 'empty') {
                setStep('choose');
            } else if (data.status === 'not_configured') {
                setStep('choose');
            } else if (data.status === 'error') {
                setStep('error');
                setErrorMessage(data.message);
            }
        } catch (error) {
            console.error('Failed to check database status:', error);
            setStep('error');
            setStatus('error');
            setErrorMessage('无法连接到后端服务器。请确保服务器正在运行。');
        }
    };

    const loadAvailableDatabases = async () => {
        try {
            const response = await fetch(`${API_URL}/api/setup/databases`);
            const data = await response.json();
            setAvailableDatabases(data.databases || []);
        } catch (error) {
            console.error('Failed to load databases:', error);
        }
    };

    const handleCreateDatabase = async () => {
        if (!newDbName.trim()) {
            alert('请输入数据库名称');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/setup/create-database`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    databaseName: newDbName,
                    loadSeedData
                })
            });

            const data = await response.json();

            if (response.ok) {
                setStep('complete');
                setTimeout(() => {
                    window.location.reload(); // Reload to reinitialize with new database
                }, 1500);
            } else {
                alert(data.message || '创建数据库失败');
            }
        } catch (error) {
            console.error('Create database error:', error);
            alert('创建数据库时发生错误');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectDatabase = async () => {
        if (!selectedDb) {
            alert('请选择一个数据库');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/setup/use-database`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ databaseName: selectedDb })
            });

            const data = await response.json();

            if (response.ok) {
                setStep('complete');
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                alert(data.message || '连接数据库失败');
            }
        } catch (error) {
            console.error('Select database error:', error);
            alert('连接数据库时发生错误');
        } finally {
            setLoading(false);
        }
    };

    // Render checking state
    if (step === 'checking') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-12 max-w-md w-full text-center">
                    <Loader className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-6" />
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
                        检查数据库状态...
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400">
                        正在连接到 PostgreSQL
                    </p>
                </div>
            </div>
        );
    }

    // Render error state
    if (step === 'error') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-12 max-w-md w-full">
                    <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-6" />
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4 text-center">
                        连接失败
                    </h2>
                    <p className="text-slate-600 dark:text-slate-300 mb-6 text-center">
                        {errorMessage}
                    </p>
                    <div className="space-y-3">
                        <button
                            onClick={checkDatabaseStatus}
                            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                            <RefreshCw className="w-5 h-5" />
                            重试
                        </button>
                        <div className="text-sm text-slate-500 dark:text-slate-400 text-center">
                            <p className="mb-2">请确保:</p>
                            <ul className="text-left space-y-1 ml-6">
                                <li>• PostgreSQL 服务正在运行</li>
                                <li>• 后端服务器已启动 (port 3001)</li>
                                <li>• 数据库配置正确</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Render complete state
    if (step === 'complete') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-12 max-w-md w-full text-center">
                    <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-6" />
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
                        数据库已就绪!
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400">
                        正在启动应用...
                    </p>
                </div>
            </div>
        );
    }

    // Render choose action
    if (step === 'choose') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-12 max-w-2xl w-full">
                    <div className="text-center mb-8">
                        <Database className="w-20 h-20 text-blue-600 mx-auto mb-4" />
                        <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">
                            欢迎使用 Nexus ERP
                        </h1>
                        <p className="text-slate-600 dark:text-slate-400">
                            首次使用需要配置数据库
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Create New Database */}
                        <button
                            onClick={() => setStep('create')}
                            className="group p-8 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700 transition-all"
                        >
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                                创建新数据库
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                创建一个全新的数据库并加载初始数据
                            </p>
                        </button>

                        {/* Use Existing Database */}
                        <button
                            onClick={() => {
                                setStep('select');
                                loadAvailableDatabases();
                            }}
                            className="group p-8 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-green-500 hover:bg-green-50 dark:hover:bg-slate-700 transition-all"
                        >
                            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                                使用现有数据库
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                连接到已存在的 Nexus ERP 数据库
                            </p>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Render create database form
    if (step === 'create') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-12 max-w-md w-full">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">
                        创建新数据库
                    </h2>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                数据库名称
                            </label>
                            <input
                                type="text"
                                value={newDbName}
                                onChange={(e) => setNewDbName(e.target.value)}
                                placeholder="nexus_erp"
                                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                            />
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                只能包含字母、数字和下划线
                            </p>
                        </div>

                        <div className="flex items-start gap-3">
                            <input
                                type="checkbox"
                                id="seedData"
                                checked={loadSeedData}
                                onChange={(e) => setLoadSeedData(e.target.checked)}
                                className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <label htmlFor="seedData" className="text-sm text-slate-700 dark:text-slate-300">
                                <span className="font-medium">加载演示数据</span>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    包含示例租户、用户和业务数据,方便快速体验系统功能
                                </p>
                            </label>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setStep('choose')}
                                disabled={loading}
                                className="flex-1 px-6 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                            >
                                返回
                            </button>
                            <button
                                onClick={handleCreateDatabase}
                                disabled={loading || !newDbName.trim()}
                                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <Loader className="w-5 h-5 animate-spin" />
                                        创建中...
                                    </>
                                ) : (
                                    '创建数据库'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Render select database form
    if (step === 'select') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-12 max-w-md w-full">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">
                        选择现有数据库
                    </h2>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                可用的数据库
                            </label>
                            {availableDatabases.length > 0 ? (
                                <select
                                    value={selectedDb}
                                    onChange={(e) => setSelectedDb(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                                >
                                    <option value="">-- 请选择 --</option>
                                    {availableDatabases.map((db) => (
                                        <option key={db} value={db}>
                                            {db}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <div className="text-sm text-slate-500 dark:text-slate-400 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
                                    没有找到可用的数据库
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setStep('choose')}
                                disabled={loading}
                                className="flex-1 px-6 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                            >
                                返回
                            </button>
                            <button
                                onClick={handleSelectDatabase}
                                disabled={loading || !selectedDb}
                                className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <Loader className="w-5 h-5 animate-spin" />
                                        连接中...
                                    </>
                                ) : (
                                    '使用此数据库'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};
