
import React from 'react';
import { useApp } from '../../context/AppContext';
import { Permission } from '../../types';
import { Lock } from 'lucide-react';

interface PermissionGuardProps {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showLock?: boolean; // If true, shows the children but with a lock overlay/disabled style
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({ 
  permission, 
  children, 
  fallback = null, 
  showLock = false 
}) => {
  const { hasPermission } = useApp();
  const allowed = hasPermission(permission);

  if (allowed) {
    return <>{children}</>;
  }

  if (showLock) {
    return (
      <div className="relative group cursor-not-allowed opacity-60 grayscale" title={`Missing permission: ${permission}`}>
        <div className="pointer-events-none">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/10 backdrop-blur-[1px] rounded-lg">
             <Lock className="w-5 h-5 text-slate-500 drop-shadow-md" />
        </div>
      </div>
    );
  }

  return <>{fallback}</>;
};
