import React from 'react';
import { Lock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ModuleId } from '../../types';

interface FeatureGuardProps {
  moduleId: ModuleId;
  children: React.ReactNode;
  fallbackTitle?: string;
}

export const FeatureGuard: React.FC<FeatureGuardProps> = ({ moduleId, children, fallbackTitle = "Module Disabled" }) => {
  const { isModuleEnabled, viewLevel } = useApp();

  if (isModuleEnabled(moduleId)) {
    return <>{children}</>;
  }

  const getMessage = () => {
    if (viewLevel === 'COMPANY') return "This module is not enabled for this Company. Please contact your Client Administrator.";
    if (viewLevel === 'CLIENT') return "This module is not enabled for your Client account. Please contact Support.";
    return "This module is globally disabled on the Platform.";
  };

  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8 bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl m-4 transition-colors">
      <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full mb-4">
        <Lock className="w-10 h-10 text-slate-400 dark:text-slate-500" />
      </div>
      <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">{fallbackTitle}</h2>
      <p className="text-slate-500 dark:text-slate-400 max-w-md">{getMessage()}</p>
      {viewLevel !== 'PLATFORM' && (
        <div className="mt-6 text-sm text-slate-400 dark:text-slate-600">
          Module ID: <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{moduleId}</span>
        </div>
      )}
    </div>
  );
};