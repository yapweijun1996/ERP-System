
import React, { useEffect, useState } from 'react';
import { Search, ArrowRight, LayoutDashboard, ShoppingCart, Package, Users, Settings, FileText, CreditCard } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate }) => {
  const { viewLevel } = useApp();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Define searchable actions based on context
  const getActions = () => {
    const common = [
      { id: 'settings', label: 'Go to Settings', icon: Settings, group: 'General' },
    ];

    if (viewLevel === 'COMPANY') {
      return [
        { id: 'dashboard', label: 'Go to Dashboard', icon: LayoutDashboard, group: 'Navigation' },
        { id: 'sales', label: 'Go to Sales Orders', icon: ShoppingCart, group: 'Navigation' },
        { id: 'inventory', label: 'Go to Inventory', icon: Package, group: 'Navigation' },
        { id: 'finance', label: 'Go to Finance', icon: CreditCard, group: 'Navigation' },
        { id: 'master', label: 'Go to Master Data', icon: Users, group: 'Navigation' },
        ...common
      ];
    }
    
    // Platform/Client simplified for demo
    return [
       { id: 'dashboard', label: 'Go to Overview', icon: LayoutDashboard, group: 'Navigation' },
       { id: 'users', label: 'Manage Users', icon: Users, group: 'Admin' },
       ...common
    ];
  };

  const actions = getActions().filter(action => 
    action.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % actions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + actions.length) % actions.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (actions[selectedIndex]) {
          onNavigate(actions[selectedIndex].id);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, actions, selectedIndex, onNavigate, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[20vh] px-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        <div className="flex items-center px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400 mr-3" />
          <input
            autoFocus
            type="text"
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent border-none outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 h-6"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">ESC</kbd>
        </div>

        <div className="max-h-[300px] overflow-y-auto py-2">
          {actions.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
              No results found.
            </div>
          ) : (
            actions.map((action, index) => (
              <button
                key={action.id}
                onClick={() => { onNavigate(action.id); onClose(); }}
                className={`w-full text-left px-4 py-3 flex items-center justify-between text-sm transition-colors ${
                  index === selectedIndex 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="flex items-center gap-3">
                  <action.icon className={`w-4 h-4 ${index === selectedIndex ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                  <span>{action.label}</span>
                </div>
                {index === selectedIndex && <ArrowRight className="w-4 h-4 opacity-50" />}
              </button>
            ))
          )}
        </div>
        
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 flex justify-between">
           <span>Navigate with <kbd className="font-sans">↑↓</kbd></span>
           <span>Select with <kbd className="font-sans">↵</kbd></span>
        </div>
      </div>
    </div>
  );
};
