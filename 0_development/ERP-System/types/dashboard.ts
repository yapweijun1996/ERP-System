
import { ModuleId } from './enums';
import { Permission } from './rbac';

export type WidgetSize = 'SMALL' | 'MEDIUM' | 'LARGE' | 'FULL'; // 1/4, 1/2, 2/3, 1/1
export type WidgetType = 'KPI' | 'LIST' | 'CHART' | 'SHORTCUTS' | 'ALERT';

export interface WidgetDefinition {
  id: string;
  name: string;
  description: string;
  type: WidgetType;
  defaultSize: WidgetSize;
  allowedSizes: WidgetSize[];
  moduleId?: ModuleId;
  permission?: Permission;
  defaultConfig?: Record<string, any>;
}

export interface DashboardWidget {
  id: string; // Unique instance ID
  definitionId: string; // Ref to WidgetDefinition
  size: WidgetSize;
  order: number;
  config: Record<string, any>; // Instance specific settings (title, filter, etc)
}

export interface DashboardLayout {
  id: string;
  userId?: string; // If personal
  companyId?: string; // If company default
  roleId?: string; // If role default
  widgets: DashboardWidget[];
}