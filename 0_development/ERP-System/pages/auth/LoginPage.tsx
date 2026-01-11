import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShieldCheck, Lock, User, Eye, EyeOff, Globe,
  Building2, ArrowRight, Loader2, AlertCircle, CheckCircle2,
  AlertTriangle, Server
} from 'lucide-react';
import { MOCK_CLIENTS } from '../../constants';
import { LoginInput } from '../../components/auth/LoginInput';
import metadata from '../../metadata.json';

export const LoginPage: React.FC = () => {
  const { login } = useApp();

  // --- Form State ---
  const [tenantId, setTenantId] = useState('techflow');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // --- Platform Mode State ---
  const [isPlatformLogin, setIsPlatformLogin] = useState(false);

  // --- UI State ---
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [isTenantValid, setIsTenantValid] = useState<boolean | null>(null);

  // --- Tenant Detection Logic ---
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!tenantId || isPlatformLogin) {
        setTenantName(null);
        setIsTenantValid(null);
        return;
      }

      const found = MOCK_CLIENTS.find(c =>
        c.id.toLowerCase().includes(tenantId.toLowerCase()) ||
        c.name.toLowerCase().replace(/\s/g, '').includes(tenantId.toLowerCase())
      );

      if (found) {
        setTenantName(found.name);
        setIsTenantValid(true);
      } else {
        setTenantName(null);
        setIsTenantValid(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [tenantId, isPlatformLogin]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!username || !password) {
      setError('Please fill in all fields.');
      setIsLoading(false);
      return;
    }

    if (!isPlatformLogin && !tenantId) {
      setError('Workspace ID is required.');
      setIsLoading(false);
      return;
    }

    if (!isPlatformLogin && isTenantValid === false) {
      setError('Invalid Workspace ID.');
      setIsLoading(false);
      return;
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      const success = await login(username, password);
      if (!success) {
        setError('Invalid credentials.');
      }
    } catch (err) {
      setError('Connection failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoFill = () => {
    if (isPlatformLogin) {
      setUsername('superadmin');
      setPassword('password');
    } else {
      setTenantId('techflow');
      setUsername('alice');
      setPassword('password');
    }
  };

  const togglePlatformMode = () => {
    setIsPlatformLogin(!isPlatformLogin);
    setTenantId(isPlatformLogin ? 'techflow' : '');
    setError(null);
    setUsername('');
    setPassword('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 flex flex-col justify-center py-8 sm:px-6 lg:px-8 transition-colors duration-300 relative overflow-hidden">
      {isPlatformLogin && (
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 z-50"></div>
      )}

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8 px-4 relative z-10">
        <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 shadow-sm">
          <div className={`h-10 w-10 rounded-xl text-white flex items-center justify-center font-semibold ${isPlatformLogin ? 'bg-slate-900' : 'bg-slate-900'}`}>
            ERP
          </div>
          <div className="text-left">
            <div className="text-slate-900 dark:text-white font-semibold leading-tight">
              {isPlatformLogin ? 'Platform Console' : (metadata?.name || 'Nexus ERP')}
            </div>
            <div className="text-slate-500 dark:text-slate-400 text-sm leading-tight">
              {isPlatformLogin ? 'Super Admin Access' : 'Secure Enterprise Gateway'}
            </div>
          </div>
          <div className="ml-2">
            {isPlatformLogin
              ? <Server className="w-5 h-5 text-orange-500" />
              : <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            }
          </div>
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-[420px] relative z-10">
        <div className={`bg-white dark:bg-slate-900 sm:rounded-2xl shadow-sm border overflow-hidden transition-colors duration-500 ${isPlatformLogin ? 'border-orange-500/30' : 'border-slate-200 dark:border-slate-800'}`}>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/30 p-4 flex gap-3 animate-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-300 font-medium">{error}</p>
            </div>
          )}

          <div className="px-6 py-8 sm:p-10">
            <form onSubmit={handleLogin} className="space-y-6">
              {!isPlatformLogin && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                  <div className="flex justify-between items-baseline">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Workspace ID
                    </label>
                    {tenantName && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full flex items-center animate-in fade-in">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> {tenantName}
                      </span>
                    )}
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Building2 className={`h-5 w-5 transition-colors ${isTenantValid ? 'text-emerald-500' : 'text-slate-400'}`} />
                    </div>
                    <input
                      type="text"
                      value={tenantId}
                      onChange={(e) => setTenantId(e.target.value)}
                      placeholder="e.g. techflow"
                      className={`
                            block w-full pl-11 pr-3 py-3 
                            bg-slate-50 dark:bg-slate-950 
                            border rounded-xl text-sm font-medium
                            text-slate-900 dark:text-white placeholder-slate-400
                            transition-all duration-200 outline-none
                            ${isTenantValid === false
                          ? 'border-amber-300 focus:ring-2 focus:ring-amber-500/20'
                          : isTenantValid
                            ? 'border-emerald-200 dark:border-emerald-900/50 focus:ring-2 focus:ring-emerald-500/20'
                            : 'border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                        }
                            `}
                    />
                  </div>
                </div>
              )}

              {!isPlatformLogin && <div className="border-t border-slate-100 dark:border-slate-800 my-2"></div>}

              <LoginInput
                id="username"
                type="text"
                label="Username"
                icon={User}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={isPlatformLogin ? "superadmin" : "username"}
              />

              <LoginInput
                id="password"
                type={showPassword ? 'text' : 'password'}
                label="Password"
                icon={Lock}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                }
              />

              <div className="flex items-center justify-between">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-slate-600 dark:text-slate-400">Remember me</span>
                </label>
                <button type="button" className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 transition-colors">
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-[0.98] ${isPlatformLogin ? 'bg-slate-900 hover:bg-black shadow-slate-900/30 focus:ring-slate-500' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30 focus:ring-blue-500'}`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  <>
                    Sign In <ArrowRight className="w-4 h-4 ml-2 opacity-80" />
                  </>
                )}
              </button>
            </form>

            {!isPlatformLogin && (
              <div className="mt-8 text-center">
                <p className="text-sm text-slate-400">Single Sign-On Available</p>
                <div className="mt-4 flex justify-center gap-4">
                  <button className="p-2 bg-slate-50 rounded-full hover:bg-slate-100 transition-colors"><Globe className="w-5 h-5 text-blue-500" /></button>
                  <button className="p-2 bg-slate-50 rounded-full hover:bg-slate-100 transition-colors"><Building2 className="w-5 h-5 text-orange-500" /></button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <button onClick={togglePlatformMode} className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 uppercase tracking-wide font-bold">
              {isPlatformLogin ? '← Return to Standard' : 'Platform Admin Login'}
            </button>
            <button onClick={handleDemoFill} className="text-[10px] text-blue-500 hover:text-blue-600 underline">
              Auto-fill Demo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
