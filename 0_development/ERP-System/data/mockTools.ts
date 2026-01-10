
import { MiniTool } from '../types';
import { ModuleId } from '../types';

export const MOCK_TOOL_CATALOG: MiniTool[] = [
  {
    id: 'tool-volumetric',
    name: 'Volumetric Weight Calc',
    category: 'Logistics',
    description: 'Calculate chargeable weight for parcels based on courier divisors (5000/6000).',
    iconName: 'Box',
    version: '1.0.0',
    requiredModule: ModuleId.INVENTORY
  },
  {
    id: 'tool-currency-convert',
    name: 'Quick FX Converter',
    category: 'Finance',
    description: 'Real-time exchange rate conversion calculator.',
    iconName: 'Coins',
    version: '1.2.0',
    requiredModule: ModuleId.FINANCE
  },
  {
    id: 'tool-sku-gen',
    name: 'SKU Generator',
    category: 'General',
    description: 'Generate standardized SKU codes based on category attributes.',
    iconName: 'Barcode',
    version: '0.9.beta',
    requiredModule: ModuleId.MASTER_DATA
  }
];
