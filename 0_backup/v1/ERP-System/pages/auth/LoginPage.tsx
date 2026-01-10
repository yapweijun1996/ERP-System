
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  ShieldCheck, Lock, Mail, Eye, EyeOff, Globe, 
  Building2, ArrowRight, Loader2, AlertCircle, CheckCircle2,
  AlertTriangle, Server
} from 'lucide-react';
import { MOCK_CLIENTS } from '../../constants'; // To lookup tenant names

export const LoginPage: React.FC = () => {
  const { login, addToast } = useApp();
  
  // --- Form State ---
  const [tenantId, setTenantId] = useState('techflow');
  const [email, setEmail] = useState('');
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
    // Mock debounced lookup
    const timer = setTimeout(() => {
      if (!tenantId || isPlatformLogin) {
        setTenantName(null);
        setIsTenantValid(null);
        return;
      }
      
      // Check against mock data (case insensitive)
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

    // Basic Validation
    if (!email || !password) {
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
      setError('Invalid Workspace ID. Please contact your administrator.');
      setIsLoading(false);
      return;
    }

    try {
      // Simulate network delay for realistic feel
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const success = await login(email, password);
      if (!success) {
        setError('Invalid credentials. Please try again.');
      } else {
        // Success handled by AppContext (redirect)
      }
    } catch (err) {
      setError('Connection failed. Please check your network.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoFill = () => {
    if (isPlatformLogin) {
        setEmail('super@nexuserp.io');
        setPassword('password');
    } else {
        setTenantId('techflow');
        setEmail('alice@techflow.com');
        setPassword('password');
    }
  };

  const togglePlatformMode = () => {
      setIsPlatformLogin(!isPlatformLogin);
      setTenantId(isPlatformLogin ? 'techflow' : ''); // Reset/Set default
      setError(null);
      setEmail('');
      setPassword('');
  };

  // --- Sub-components ---

  const InputField = ({ 
    id, type, value, onChange, label, icon: Icon, placeholder, error, rightElement 
  }: any) => (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
        {label}
      </label>
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Icon className={`h-5 w-5 transition-colors ${error ? 'text-red-400' : 'text-slate-400 group-focus-within:text-blue-500'}`} />
        </div>
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`
            block w-full pl-11 pr-3 py-3 
            bg-slate-50 dark:bg-slate-950 
            border rounded-xl text-sm font-medium
            text-slate-900 dark:text-white placeholder-slate-400
            transition-all duration-200 outline-none
            ${error 
              ? 'border-red-300 focus:ring-2 focus:ring-red-500/20 focus:border-red-500' 
              : 'border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900'
            }
          `}
        />
        {rightElement && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {rightElement}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-8 sm:px-6 lg:px-8 transition-colors duration-300 relative overflow-hidden">
      
      {/* Background Decor */}
      {isPlatformLogin && (
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 z-50"></div>
      )}

      {/* Brand Header (Mobile & Desktop) */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8 px-4 relative z-10">
        <div className={`inline-flex items-center justify-center p-3 rounded-2xl shadow-lg mb-6 transform transition-transform hover:scale-105 ${isPlatformLogin ? 'bg-slate-900 shadow-slate-900/30' : 'bg-gradient-to-br from-blue-600 to-indigo-700 shadow-blue-500/20'}`}>
           {isPlatformLogin ? <Server className="w-8 h-8 text-white" /> : <ShieldCheck className="w-8 h-8 text-white" />}
        </div>
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          {isPlatformLogin ? 'Platform Console' : 'Nexus ERP'}
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {isPlatformLogin ? 'Super Admin Access' : 'Secure Enterprise Gateway'}
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-[420px] relative z-10">
        
        {/* Main Card */}
        <div className={`bg-white dark:bg-slate-900 sm:rounded-2xl shadow-xl border-y sm:border overflow-hidden transition-colors duration-500 ${isPlatformLogin ? 'border-orange-500/30 shadow-orange-500/10' : 'shadow-slate-200/50 dark:shadow-none border-slate-100 dark:border-slate-800'}`}>
            
            {/* Error Banner */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/30 p-4 flex gap-3 animate-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-300 font-medium">{error}</p>
              </div>
            )}

            <div className="px-6 py-8 sm:p-10">
              <form onSubmit={handleLogin} className="space-y-6">
                  
                  {/* Tenant Context Field - HIDDEN FOR PLATFORM LOGIN */}
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
                        {isTenantValid === false && (
                        <p className="text-xs text-amber-600 dark:text-amber-500 flex items-center mt-1">
                            <AlertTriangle className="w-3 h-3 mr-1" /> Workspace not found
                        </p>
                        )}
                    </div>
                  )}

                  {/* Divider if tenant hidden */}
                  {!isPlatformLogin && (
                    <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-slate-100 dark:border-slate-800"></div>
                        </div>
                    </div>
                  )}

                  <InputField 
                    id="email"
                    type="email"
                    label="Email Address"
                    icon={Mail}
                    value={email}
                    onChange={(e: any) => setEmail(e.target.value)}
                    placeholder={isPlatformLogin ? "admin@platform.com" : "name@company.com"}
                  />

                  <InputField 
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    label="Password"
                    icon={Lock}
                    value={password}
                    onChange={(e: any) => setPassword(e.target.value)}
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

              {/* SSO Section - Only for standard login */}
              {!isPlatformLogin && (
                <div className="mt-8">
                    <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-100 dark:border-slate-800" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-white dark:bg-slate-900 text-slate-400 font-medium">Single Sign-On</span>
                    </div>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-4">
                    <button className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm bg-white dark:bg-slate-800 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                        <Globe className="w-5 h-5 mr-2 text-blue-500" /> Google
                    </button>
                    <button className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm bg-white dark:bg-slate-800 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                        <Building2 className="w-5 h-5 mr-2 text-orange-500" /> Microsoft
                    </button>
                    </div>
                </div>
              )}
            </div>
            
            {/* Demo Link */}
            <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <button onClick={togglePlatformMode} className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 uppercase tracking-wide font-bold">
                  {isPlatformLogin ? '← Return to Standard Login' : 'Login as Platform Admin'}
              </button>
              <button onClick={handleDemoFill} className="text-[10px] text-blue-500 hover:text-blue-600 underline">
                Auto-fill {isPlatformLogin ? 'Super Admin' : 'Tenant'}
              </button>
            </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="mt-8 text-center px-4">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          &copy; 2023 Nexus ERP Inc. <span className="mx-1">•</span> <a href="#" className="hover:text-slate-600">Privacy</a> <span className="mx-1">•</span> <a href="#" className="hover:text-slate-600">Terms</a>
        </p>
      </div>
    </div>
  );
};
