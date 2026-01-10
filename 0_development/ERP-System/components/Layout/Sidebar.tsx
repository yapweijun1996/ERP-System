
import React, { useEffect, useMemo, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, X, LogOut, ChevronDown, ChevronRight, Circle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getMenuItems, MenuItemConfig } from '../../config/menuConfig';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate }) => {
  const {
    isModuleEnabled, viewLevel,
    isSidebarCollapsed, toggleSidebarCollapse,
    isMobileMenuOpen, setMobileMenuOpen,
    logout, performanceMode, activeCompany, activeClient, platform
  } = useApp();

  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const handleNavigate = (id: string) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  const toggleGroup = (id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setMobileMenuOpen]);

  // Expand parent groups if child is active
  useEffect(() => {
    const items = getMenuItems(viewLevel);
    items.forEach(item => {
      if (item.children) {
        const childActive = item.children.some(child => child.id === currentPage);
        if (childActive) {
          setExpandedItems(prev => ({ ...prev, [item.id]: true }));
        }
      }
    });
  }, [currentPage, viewLevel]);

  const checkFeature = (moduleId?: string, featureFlag?: string): boolean => {
    // 1. Module Level Check
    if (moduleId && !isModuleEnabled(moduleId as any)) return false;

    // 2. Sub-Feature Level Check
    if (featureFlag) {
      let features = platform?.features || {}; // Default to platform if exists
      if (viewLevel === 'CLIENT' && activeClient) features = activeClient.features || {};
      if (viewLevel === 'COMPANY' && activeCompany) features = activeCompany.features || {};

      if (features[featureFlag] === false) return false; // Explicitly disabled
    }
    return true;
  };

  const menuItems = useMemo(() => getMenuItems(viewLevel), [viewLevel]);

  const sections = useMemo(() =>
    Array.from(new Set(menuItems.map(i => i.section).filter(Boolean))) as string[],
    [menuItems]);

  const MenuItem: React.FC<{ item: MenuItemConfig, depth?: number }> = ({ item, depth = 0 }) => {
    // Check Visibility
    if (!checkFeature(item.moduleId, item.featureFlag)) return null;

    const isActive = currentPage === item.id || (currentPage.startsWith(item.id + '-') && item.id !== 'dashboard');
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems[item.id];

    const basePadding = isSidebarCollapsed ? 'px-2' : 'px-4';
    const indent = depth * 12; // 12px indent per level

    if (hasChildren && !isSidebarCollapsed) {
      return (
        <div className="mb-1">
          <button
            onClick={() => toggleGroup(item.id)}
            className={`
                        group flex items-center w-full py-2 rounded-lg transition-colors duration-200 outline-none
                        text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200
                        ${isExpanded ? 'bg-slate-50 dark:bg-slate-800/30' : ''}
                        mx-2 w-[calc(100%-1rem)] px-4
                    `}
          >
            <item.icon className="w-5 h-5 flex-shrink-0 mr-3 text-slate-500" strokeWidth={2} />
            <span className="text-sm font-medium flex-1 text-left truncate">{item.label}</span>
            {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          </button>
          {isExpanded && (
            <div className="mt-1 space-y-0.5">
              {item.children!.map(child => (
                <MenuItem key={child.id} item={child} depth={depth + 1} />
              ))}
            </div>
          )}
        </div>
      );
    }

    // Leaf Item or Collapsed Parent acting as link
    return (
      <button
        onClick={() => handleNavigate(item.path || item.id)}
        title={isSidebarCollapsed ? item.label : ''}
        className={`
          group relative flex items-center w-[calc(100%-1rem)] transition-colors duration-200 outline-none rounded-lg mx-2 mb-1
          ${isSidebarCollapsed ? 'justify-center py-3 px-2' : `py-2 ${depth > 0 ? 'pl-10 pr-4' : 'px-4'}`}
          ${isActive
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
          }
        `}
      >
        {depth === 0 ? (
          <item.icon
            className={`flex-shrink-0 ${isSidebarCollapsed ? 'w-6 h-6' : 'w-5 h-5'} ${isActive ? 'text-white' : ''} ${!isSidebarCollapsed && 'mr-3'}`}
            strokeWidth={isActive ? 2.5 : 2}
          />
        ) : (
          // Small dot for sub-items if desired, or just text. Let's use icon if provided or dot
          item.icon && item.icon !== Circle ? (
            <item.icon className={`w-4 h-4 mr-3 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
          ) : (
            <Circle className={`w-2 h-2 mr-3 flex-shrink-0 ${isActive ? 'fill-current' : 'text-slate-300'}`} />
          )
        )}

        <span className={`text-sm font-medium truncate ${isSidebarCollapsed ? 'hidden' : 'block'}`}>{item.label}</span>

        {isSidebarCollapsed && !performanceMode && (
          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-md opacity-0 group-hover:opacity-100 z-[60] pointer-events-none whitespace-nowrap shadow-xl hidden md:block">
            {item.label}
            <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent border-r-slate-900"></div>
          </div>
        )}
      </button>
    );
  };

  // Performance Mode: Opaque background, no blurs
  const bgClass = performanceMode
    ? 'bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800'
    : 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-r border-slate-200 dark:border-slate-800 shadow-xl md:shadow-none';

  return (
    <>
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`
          md:relative fixed top-0 left-0 h-full z-50 flex flex-col transition-all duration-300 ease-in-out
          ${bgClass}
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${isSidebarCollapsed ? 'md:w-[80px]' : 'md:w-64'}
          w-64
        `}
      >
        <div className={`h-16 flex items-center px-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0 transition-all ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className={`flex items-center space-x-3 min-w-0 transition-opacity duration-200 ${isSidebarCollapsed ? 'hidden opacity-0' : 'flex opacity-100'}`}>
            <div className="flex-shrink-0 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center w-8 h-8 shadow-sm">
              <span className="text-white font-bold text-lg">N</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate tracking-tight">Nexus ERP</span>
            </div>
          </div>

          <button
            onClick={toggleSidebarCollapse}
            className="hidden md:flex p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isSidebarCollapsed ? "Expand" : "Collapse"}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            ) : (
              <PanelLeftClose className="w-5 h-5" />
            )}
          </button>

          <button onClick={() => setMobileMenuOpen(false)} className="md:hidden p-2 text-slate-400 hover:text-slate-600 ml-auto">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 scrollbar-thin">
          {sections.map(section => (
            <div key={section} className="mb-4">
              {!isSidebarCollapsed && (
                <div className="px-6 mb-2 text-[11px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-wider truncate">
                  {section}
                </div>
              )}
              {isSidebarCollapsed && (
                <div className="my-2 border-t border-slate-100 dark:border-slate-800 mx-4"></div>
              )}
              {menuItems.filter(i => i.section === section).map(item => (
                <MenuItem key={item.id} item={item} />
              ))}
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-200 dark:border-slate-800 flex-shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={logout}
            className={`w-full p-4 flex items-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${isSidebarCollapsed ? 'justify-center' : 'space-x-3'}`}
          >
            <LogOut className="w-5 h-5 text-slate-400" />
            {!isSidebarCollapsed && <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
