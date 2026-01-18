import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ShieldCheck, Lock, User, Eye, EyeOff,
  Building2, ArrowRight, Loader2, AlertCircle, CheckCircle2
} from 'lucide-react';
import { MOCK_CLIENTS } from '../../constants';
import { LoginInput } from '../../components/auth/LoginInput';
import metadata from '../../metadata.json';

function getTenantIdFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    return (params.get('tenantid') || params.get('tenantId') || '').trim() || '';
  } catch {
    return '';
  }
}

export const LoginPage: React.FC = () => {
  const { login, loginSuperadmin } = useApp();
  const tenantIdFromUrl = getTenantIdFromUrl();
  const isSuperadminEntry = tenantIdFromUrl.trim().toLowerCase() === 'superadmin';

  // --- Form State ---
  const [tenantId, setTenantId] = useState(() => {
    // Try to get tenantId from URL search params
    return tenantIdFromUrl;
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Load saved credentials on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('rememberMe');
      if (saved) {
        const { username: sUser, password: sPass, tenantId: sTenant } = JSON.parse(saved);
        if (sUser) setUsername(sUser);
        if (sPass) setPassword(sPass);
        // If URL didn't provide tenantId, use stored one
        if (!isSuperadminEntry && sTenant) {
          setTenantId(prev => (prev ? prev : sTenant));
        }
      }
    } catch (e) {
      console.error('Failed to load auth prefs', e);
    }
  }, []);

  // --- UI State ---
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [isTenantValid, setIsTenantValid] = useState<boolean | null>(null);

  // --- Tenant Detection Logic ---
  useEffect(() => {
    if (isSuperadminEntry) {
      setTenantName('Super Admin');
      setIsTenantValid(true);
      return;
    }

    const timer = setTimeout(() => {
      if (!tenantId) {
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
  }, [tenantId]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!username || !password) {
      setError('Please fill in all fields.');
      setIsLoading(false);
      return;
    }

    if (!isSuperadminEntry && !tenantId) {
      setError('Workspace ID is required.');
      setIsLoading(false);
      return;
    }

    if (!isSuperadminEntry && isTenantValid === false) {
      setError('Invalid Workspace ID.');
      setIsLoading(false);
      return;
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      const success = isSuperadminEntry
        ? await loginSuperadmin(username, password)
        : await login(username, password);
      if (success) {
        if (rememberMe) {
          // WARNING: Storing passwords in localStorage is not secure.
          // In a real production environment, use a secure cookie or token approach.
          localStorage.setItem('rememberMe', JSON.stringify({
            tenantId,
            username,
            password
          }));
        } else {
          localStorage.removeItem('rememberMe');
        }
      } else {
        setError('Invalid credentials.');
      }
    } catch (err) {
      setError('Connection failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 flex flex-col justify-center py-8 sm:px-6 lg:px-8 transition-colors duration-300 relative overflow-hidden">



      <div className="sm:mx-auto sm:w-full sm:max-w-[420px] relative z-10">
        <div className="bg-white dark:bg-slate-900 sm:rounded-2xl shadow-sm border overflow-hidden transition-colors duration-500 border-slate-200 dark:border-slate-800">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/30 p-4 flex gap-3 animate-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-300 font-medium">{error}</p>
            </div>
          )}

          <div className="px-6 py-8 sm:p-10">
            <form onSubmit={handleLogin} className="space-y-6">
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
                    onChange={(e) => {
                      if (isSuperadminEntry) return;
                      setTenantId(e.target.value);
                    }}
                    disabled={isSuperadminEntry}
                    placeholder={isSuperadminEntry ? 'superadmin' : 'e.g. techflow'}
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

              <div className="border-t border-slate-100 dark:border-slate-800 my-2"></div>

              <LoginInput
                id="username"
                type="text"
                label="Username"
                icon={User}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
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
                className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-[0.98] bg-blue-600 hover:bg-blue-700 shadow-blue-500/30 focus:ring-blue-500"
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
          </div>
        </div>
      </div>
    </div>
  );
};
