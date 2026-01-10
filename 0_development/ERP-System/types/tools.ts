
import { ModuleId } from './enums';

export type ToolCategory = 'Logistics' | 'Finance' | 'General' | 'Developer';

export interface MiniTool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  iconName: string; // Lucide icon name
  version: string;
  requiredModule?: ModuleId; // If the tool depends on a core module (e.g., Warehouse calc needs Inventory)
}

// Configuration state
export interface ToolConfig {
  enabledToolIds: string[]; // List of IDs enabled for this entity
  pinnedToolIds: string[]; // List of IDs pinned to dashboard (Company level only)
}

export interface CalculationHistoryItem {
  id: string;
  toolId: string;
  timestamp: string;
  summary: string;
  details: Record<string, any>;
}
