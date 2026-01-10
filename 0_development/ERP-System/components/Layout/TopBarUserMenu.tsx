
import React, { useState, useRef, useEffect } from 'react';
import { Gauge, HelpCircle, Check, LogOut } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const TopBarUserMenu: React.FC = () => {
  const { currentUser, switchUser, users, logout, performanceMode, togglePerformanceMode } = useApp();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={userRef}>
        <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center gap-2 pl-2 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow ring-2 ring-white dark:ring-slate-800">{currentUser.name.charAt(0)}</div>
            <div className="hidden md:block text-left leading-tight"><div className="text-xs font-bold text-slate-700 dark:text-slate-200">{currentUser.name}</div><div className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">{currentUser.roles[0]?.replace('ROLE_', '').toLowerCase().replace('_', ' ')}</div></div>
        </button>
        {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50"><p className="text-xs font-semibold text-slate-500 uppercase">Signed in as</p><p className="text-sm font-medium text-slate-900 dark:text-white truncate">{currentUser.email}</p></div>
                
                {/* Performance Toggle */}
                <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="px-3 py-2 flex items-center justify-between group">
                        <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                            <Gauge className="w-4 h-4 text-slate-500" />
                            <span className="font-medium">Performance</span>
                            <div className="relative group/tooltip cursor-help">
                                <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 bg-slate-800 text-white text-[10px] rounded-lg shadow-xl opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all z-50 text-center leading-relaxed">
                                    Reduces visual effects (blur, animations) to improve speed on slower devices.
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={togglePerformanceMode}
                            className={`w-9 h-5 rounded-full relative transition-colors focus:outline-none cursor-pointer ${performanceMode ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                        >
                            <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 shadow-sm transition-transform duration-200 ${performanceMode ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                        </button>
                    </div>
                </div>

                <div className="py-2"><div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Debug: Switch User</div>{users.map(u => ( <button key={u.id} onClick={() => { switchUser(u.id); setUserMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold">{u.name.charAt(0)}</div><span className="truncate">{u.name}</span></div>{currentUser.id === u.id && <Check className="w-3 h-3 text-blue-600 dark:text-blue-400" />}</button> ))}</div>
                <div className="border-t border-slate-100 dark:border-slate-800 p-2"><button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"><LogOut className="w-4 h-4" /><span>Sign out</span></button></div>
            </div>
        )}
    </div>
  );
};
