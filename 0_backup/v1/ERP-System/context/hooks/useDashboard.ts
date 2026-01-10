
import { useState, useCallback, useMemo, useEffect } from 'react';
import { DashboardLayout, DashboardWidget, WidgetDefinition } from '../../types';
import { WIDGET_LIBRARY, DEFAULT_LAYOUTS } from '../../data/mockDashboard';

export const useDashboard = (
  currentUser: any, 
  activeCompany: any, 
  isModuleEnabled: (mid: any) => boolean,
  hasPermission: (perm: any) => boolean
) => {
  // Local storage for user layouts: Record<userId_companyId, DashboardLayout>
  const [userLayouts, setUserLayouts] = useState<Record<string, DashboardLayout>>({});
  
  // Load from local storage
  useEffect(() => {
    const stored = localStorage.getItem('nexus_user_layouts');
    if (stored) {
      try {
        setUserLayouts(JSON.parse(stored));
      } catch (e) { console.error('Failed to load layouts', e); }
    }
  }, []);

  const saveLayouts = (layouts: Record<string, DashboardLayout>) => {
    setUserLayouts(layouts);
    localStorage.setItem('nexus_user_layouts', JSON.stringify(layouts));
  };

  // Resolve Available Widgets based on modules/permissions
  const availableWidgets = useMemo(() => {
    return WIDGET_LIBRARY.filter(w => {
      if (w.moduleId && !isModuleEnabled(w.moduleId)) return false;
      if (w.permission && !hasPermission(w.permission)) return false;
      return true;
    });
  }, [isModuleEnabled, hasPermission]);

  // Resolve Active Layout
  const activeLayoutKey = useMemo(() => {
    if (!currentUser || !activeCompany) return null;
    return `${currentUser.id}_${activeCompany.id}`;
  }, [currentUser, activeCompany]);

  const effectiveLayout = useMemo(() => {
    if (!activeLayoutKey) return DEFAULT_LAYOUTS['DEFAULT'];

    // 1. User Personal Layout
    if (userLayouts[activeLayoutKey]) return userLayouts[activeLayoutKey];

    // 2. Company Default (Mocked as role-based for now, normally fetched from DB)
    // 3. Role Default
    const roleId = currentUser?.roles[0];
    if (roleId && DEFAULT_LAYOUTS[roleId]) return DEFAULT_LAYOUTS[roleId];

    // 4. System Default
    return DEFAULT_LAYOUTS['DEFAULT'];
  }, [activeLayoutKey, userLayouts, currentUser]);

  const updateLayout = useCallback((widgets: DashboardWidget[]) => {
    if (!activeLayoutKey) return;
    const newLayout: DashboardLayout = {
      id: `custom-${Date.now()}`,
      userId: currentUser.id,
      companyId: activeCompany.id,
      widgets
    };
    saveLayouts({ ...userLayouts, [activeLayoutKey]: newLayout });
  }, [activeLayoutKey, currentUser, activeCompany, userLayouts]);

  const resetLayout = useCallback(() => {
    if (!activeLayoutKey) return;
    const { [activeLayoutKey]: removed, ...rest } = userLayouts;
    saveLayouts(rest);
  }, [activeLayoutKey, userLayouts]);

  return {
    effectiveLayout,
    availableWidgets,
    updateLayout,
    resetLayout,
    canCustomize: true // Could be permission gated
  };
};
