
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const TopBarSupportBanner: React.FC = () => {
  const { supportSession, endSupportSession, activeClient, activeCompany } = useApp();

  if (!supportSession) return null;

  return (
    <div className="bg-amber-500 text-white px-4 py-2 flex justify-between items-center text-sm shadow-md z-50">
      <div className="flex items-center gap-3">
        <div className="p-1 bg-white/20 rounded">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="font-bold flex items-center gap-2">
          SUPPORT SESSION ACTIVE
          <span className="bg-black/20 px-2 py-0.5 rounded text-xs font-mono">READ-ONLY</span>
        </div>
        <div className="hidden md:block opacity-90 text-xs">
          Target: {activeClient?.name} {activeCompany ? `/ ${activeCompany.name}` : ''}
        </div>
      </div>
      <button 
        onClick={endSupportSession}
        className="bg-white text-amber-600 hover:bg-amber-50 px-3 py-1 rounded text-xs font-bold transition-colors flex items-center gap-2"
      >
        EXIT SESSION <X className="w-3 h-3" />
      </button>
    </div>
  );
};
