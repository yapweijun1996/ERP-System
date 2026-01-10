
import React from 'react';
import { 
  LayoutDashboard, ShoppingCart, Package, Menu, Settings, 
  Building, Users, Activity, Globe 
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ModuleId, ViewLevel } from '../../types';

interface MobileNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentPage, onNavigate }) => {
  const { isModuleEnabled, setMobileMenuOpen, viewLevel } = useApp();

  const NavItem = ({ id, icon: Icon, label, moduleId }: any) => {
    if (moduleId && !isModuleEnabled(moduleId)) return null;

    const isActive = currentPage === id;
    return (
      <button 
        onClick={() => onNavigate(id)}
        className={`flex flex-col items-center justify-center w-full py-2 space-y-1 ${
          isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        <Icon className={`w-6 h-6 ${isActive ? 'fill-current opacity-20' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
        <span className="text-[10px] font-medium">{label}</span>
      </button>
    );
  };

  const getMobileItems = (level: ViewLevel) => {
    if (level === 'PLATFORM') {
      return [
        { id: 'dashboard', icon: Activity, label: 'Overview' },
        { id: 'clients', icon: Building, label: 'Tenants' },
        { id: 'system-status', icon: Globe, label: 'System' },
        { id: 'settings', icon: Settings, label: 'Settings' }
      ];
    }
    if (level === 'CLIENT') {
      return [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
        { id: 'companies', icon: Building, label: 'Companies' },
        { id: 'users', icon: Users, label: 'Users' },
        { id: 'settings', icon: Settings, label: 'Settings' }
      ];
    }
    // Company / ERP
    return [
      { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
      { id: 'sales', icon: ShoppingCart, label: 'Sales', moduleId: ModuleId.SALES },
      { id: 'inventory', icon: Package, label: 'Stock', moduleId: ModuleId.INVENTORY },
      { id: 'settings', icon: Settings, label: 'Settings' }
    ];
  };

  const items = getMobileItems(viewLevel);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-safe z-40 transition-colors">
      <div className="flex justify-around items-center h-16">
        {items.map(item => (
            <NavItem key={item.id} {...item} />
        ))}
        {/* Toggle the Sidebar Drawer */}
        <button 
            onClick={() => setMobileMenuOpen(true)}
            className={`flex flex-col items-center justify-center w-full py-2 space-y-1 text-slate-500 dark:text-slate-400`}
        >
            <Menu className="w-6 h-6" />
            <span className="text-[10px] font-medium">Menu</span>
        </button>
      </div>
    </div>
  );
};
