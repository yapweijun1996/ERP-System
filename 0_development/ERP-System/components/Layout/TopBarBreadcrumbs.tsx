
import React, { useState, useRef, useEffect } from 'react';
import { Building2, Globe, Slash, ChevronsUpDown, Check, Search, Menu } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const TopBarBreadcrumbs: React.FC = () => {
  const { 
    viewLevel, setViewLevel, platform, setSelectedClientId,
    selectedCompanyId, setSelectedCompanyId, activeClient, activeCompany,
    currentUser, availableCompanies, supportSession, setMobileMenuOpen
  } = useApp();

  const [clientMenuOpen, setClientMenuOpen] = useState(false);
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  
  const clientRef = useRef<HTMLLIElement>(null);
  const companyRef = useRef<HTMLLIElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // Handle horizontal scrolling with vertical mouse wheel
  useEffect(() => {
    const el = navRef.current;
    if (el) {
      const onWheel = (e: WheelEvent) => {
        if (e.deltaY === 0) return;
        // Only prevent default if content actually overflows
        if (el.scrollWidth > el.clientWidth) {
            e.preventDefault();
            el.scrollLeft += e.deltaY;
        }
      };
      el.addEventListener('wheel', onWheel, { passive: false });
      return () => el.removeEventListener('wheel', onWheel);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientRef.current && !clientRef.current.contains(event.target as Node)) setClientMenuOpen(false);
      if (companyRef.current && !companyRef.current.contains(event.target as Node)) setCompanyMenuOpen(false);
    };
    const handleResize = () => {
        setClientMenuOpen(false);
        setCompanyMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true); // Close on scroll
    
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleResize, true);
    };
  }, []);

  const handlePlatformClick = () => setViewLevel('PLATFORM');
  const handleClientNameClick = () => activeClient && setViewLevel('CLIENT');
  
  const handleClientSwitch = (clientId: string) => {
      setSelectedClientId(clientId);
      const client = platform.clients.find(c => c.id === clientId);
      if (client && client.companies.length > 0) setSelectedCompanyId(client.companies[0].id);
      setViewLevel('CLIENT');
      setClientMenuOpen(false);
  };

  const handleCompanyNameClick = () => activeCompany && setViewLevel('COMPANY');
  const handleCompanySwitch = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setViewLevel('COMPANY');
    setCompanyMenuOpen(false);
  };

  const getMenuPosition = (ref: HTMLElement, width: number) => {
      const rect = ref.getBoundingClientRect();
      let left = rect.left;
      // Prevent overflow on right edge
      if (left + width > window.innerWidth) {
          left = window.innerWidth - width - 16;
      }
      return { top: rect.bottom + 8, left: Math.max(16, left) };
  };

  const toggleClientMenu = () => {
      if (!clientMenuOpen && clientRef.current) {
          setMenuPos(getMenuPosition(clientRef.current, 288)); // w-72 is 288px
          setCompanyMenuOpen(false);
          setClientMenuOpen(true);
      } else {
          setClientMenuOpen(false);
      }
  };

  const toggleCompanyMenu = () => {
      if (!companyMenuOpen && companyRef.current) {
          setMenuPos(getMenuPosition(companyRef.current, 320)); // w-80 is 320px
          setClientMenuOpen(false);
          setCompanyMenuOpen(true);
      } else {
          setCompanyMenuOpen(false);
      }
  };

  const BreadcrumbSeparator = () => (
    <div className="text-slate-300 dark:text-slate-700 shrink-0 px-0.5">
        <Slash className="w-3 h-3 sm:w-4 sm:h-4 -skew-x-12 opacity-50" />
    </div>
  );

  const BreadcrumbItem = ({ icon: Icon, label, isActive, onClick, onMenuToggle, hasMenu, disabled, avatarFallback, avatarColorClass }: any) => (
      <div className={`relative flex items-center ${disabled ? 'opacity-50 cursor-default' : ''}`}>
        <div 
          className={`group flex items-center gap-1.5 sm:gap-2 px-1.5 py-1 sm:px-2 sm:py-1.5 rounded-md transition-all duration-200 cursor-pointer select-none ${isActive ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
          onClick={(e) => { if (!disabled) onClick(e); }}
        >
            {avatarFallback ? (
                <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded flex items-center justify-center text-[9px] sm:text-[10px] font-bold shadow-sm shrink-0 ${avatarColorClass || 'bg-slate-200 text-slate-600'}`}>{avatarFallback}</div>
            ) : Icon ? (
                <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 group-hover:text-slate-500'}`} />
            ) : (
                <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded bg-slate-200 dark:bg-slate-800 shrink-0" />
            )}
            <span className={`text-xs sm:text-sm font-medium truncate max-w-[100px] sm:max-w-[160px]`}>{label}</span>
            {hasMenu && (
                <div role="button" onClick={(e) => { e.stopPropagation(); if (!disabled) onMenuToggle(); }} className={`ml-0.5 -mr-1 p-0.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 ${isActive ? 'opacity-100' : ''}`}>
                    <ChevronsUpDown className="w-3 h-3" />
                </div>
            )}
        </div>
      </div>
  );

  return (
    <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0 overflow-hidden">
        {/* Mobile Menu Trigger */}
        <button 
            onClick={() => setMobileMenuOpen(true)} 
            className="md:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg shrink-0 transition-colors"
            aria-label="Open Menu"
        >
            <Menu className="w-5 h-5" />
        </button>
        
        {/* Breadcrumb Scroller */}
        <div className="flex-1 overflow-hidden relative group">
            <nav 
                ref={navRef}
                aria-label="Breadcrumb" 
                className="flex items-center overflow-x-auto pr-4 pb-1 scrollbar-hide"
            >
                <ol className="flex items-center space-x-0.5 sm:space-x-1 whitespace-nowrap">
                    
                    {/* Platform */}
                    <li className={`${viewLevel === 'PLATFORM' ? 'flex' : 'hidden md:flex'}`}>
                        <BreadcrumbItem 
                            icon={Globe} 
                            label={viewLevel === 'PLATFORM' && !supportSession ? "Super Admin" : "Platform"} 
                            isActive={viewLevel === 'PLATFORM'} 
                            onClick={handlePlatformClick} 
                            disabled={!currentUser.roles.includes('ROLE_ADMIN') && !supportSession} 
                            hasMenu={false} 
                        />
                    </li>
                    
                    <li aria-hidden="true" className={`${viewLevel === 'PLATFORM' ? 'block' : 'hidden md:block'}`}>
                        <BreadcrumbSeparator />
                    </li>
                    
                    {/* Client */}
                    <li className="relative flex items-center" ref={clientRef}>
                        <BreadcrumbItem 
                            label={activeClient?.name || 'Select Client'} 
                            isActive={viewLevel === 'CLIENT'} 
                            onClick={handleClientNameClick} 
                            onMenuToggle={toggleClientMenu} 
                            hasMenu={currentUser.roles.includes('ROLE_ADMIN')} 
                            disabled={supportSession !== null} 
                            avatarFallback={activeClient?.name.charAt(0)} 
                            avatarColorClass="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300" 
                        />
                        {clientMenuOpen && (
                            <div 
                                className="fixed z-50 w-72 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-2 animate-in fade-in zoom-in-95 duration-100"
                                style={{ top: menuPos.top, left: menuPos.left }}
                            >
                                <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Switch Tenant</div>
                                {platform.clients.map(c => (
                                    <button key={c.id} onClick={() => handleClientSwitch(c.id)} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-200 flex items-center justify-between group transition-colors">
                                        <div className="flex items-center gap-3"><div className="w-6 h-6 rounded bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-bold">{c.name.charAt(0)}</div><span>{c.name}</span></div>
                                        {activeClient?.id === c.id && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </li>
                    
                    {/* Separator only if company is active or viewlevel is company */}
                    {(activeCompany || viewLevel === 'COMPANY') && (
                        <li aria-hidden="true"><BreadcrumbSeparator /></li>
                    )}
                    
                    {/* Company */}
                    {(activeCompany || viewLevel === 'COMPANY') && (
                        <li className="relative flex items-center" ref={companyRef}>
                            <BreadcrumbItem 
                                icon={Building2} 
                                label={activeCompany?.name || 'Select Company'} 
                                isActive={viewLevel === 'COMPANY'} 
                                onClick={handleCompanyNameClick} 
                                onMenuToggle={toggleCompanyMenu} 
                                hasMenu={!!activeClient && availableCompanies.length > 1} 
                                disabled={!activeClient || supportSession !== null} 
                                avatarFallback={activeCompany?.name.charAt(0)} 
                                avatarColorClass="bg-blue-600 text-white shadow-sm" 
                            />
                            {companyMenuOpen && activeClient && (
                                <div 
                                    className="fixed z-50 w-80 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                                    style={{ top: menuPos.top, left: menuPos.left }}
                                >
                                    <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                                        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" /><input autoFocus type="text" placeholder="Find company..." className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100" /></div>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto py-1 custom-scrollbar">
                                        {availableCompanies.length === 0 ? <div className="px-4 py-8 text-center"><p className="text-sm text-slate-500">No companies found.</p></div> : availableCompanies.map(comp => (
                                            <button key={comp.id} onClick={() => handleCompanySwitch(comp.id)} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-200 flex items-center justify-between group transition-colors">
                                                <div className="flex items-center gap-3 overflow-hidden"><div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold shrink-0">{comp.name.charAt(0)}</div><div className="truncate"><div className="font-medium truncate">{comp.name}</div><div className="text-[10px] text-slate-400">{comp.country} • {comp.currency}</div></div></div>
                                                {activeCompany?.id === comp.id && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 ml-2" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </li>
                    )}
                </ol>
            </nav>
            {/* Fade effect for scrolling indication */}
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-slate-900 to-transparent pointer-events-none md:hidden"></div>
        </div>
    </div>
  );
};
