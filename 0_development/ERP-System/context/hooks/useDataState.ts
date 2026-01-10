
import { useState } from 'react';
import { 
  Platform, SalesDocument, InventoryItem, Customer, Supplier, Warehouse, 
  FinanceTransaction, Employee, Department, RunningNumberConfig, TaxCode, 
  Role, ERPNotification, SystemLog, BackgroundJob, ToolConfig, CalculationHistoryItem 
} from '../../types';
import { 
  MOCK_PLATFORM, MOCK_SALES_DOCUMENTS, MOCK_INVENTORY, MOCK_CUSTOMERS, 
  MOCK_SUPPLIERS, MOCK_WAREHOUSES, MOCK_FINANCE, MOCK_EMPLOYEES, 
  MOCK_DEPARTMENTS, MOCK_RUNNING_NUMBERS, TAX_CODES, MOCK_ROLES, 
  MOCK_NOTIFICATIONS, MOCK_SYSTEM_LOGS, MOCK_BACKGROUND_JOBS,
  MOCK_TOOL_CATALOG
} from '../../constants';

export const useDataState = () => {
  const [platformData, setPlatformData] = useState<Platform>(MOCK_PLATFORM);
  const [allSalesDocs, setAllSalesDocs] = useState<SalesDocument[]>(MOCK_SALES_DOCUMENTS);
  const [allInventory, setAllInventory] = useState<InventoryItem[]>(MOCK_INVENTORY);
  const [allCustomers, setAllCustomers] = useState<Customer[]>(MOCK_CUSTOMERS);
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>(MOCK_SUPPLIERS);
  const [allWarehouses, setAllWarehouses] = useState<Warehouse[]>(MOCK_WAREHOUSES);
  const [allFinance, setAllFinance] = useState<FinanceTransaction[]>(MOCK_FINANCE);
  const [allEmployees, setAllEmployees] = useState<Employee[]>(MOCK_EMPLOYEES);
  const [allDepartments, setAllDepartments] = useState<Department[]>(MOCK_DEPARTMENTS);
  const [allRunningNumbers, setAllRunningNumbers] = useState<RunningNumberConfig[]>(MOCK_RUNNING_NUMBERS);
  const [allTaxCodes, setAllTaxCodes] = useState<TaxCode[]>(TAX_CODES);
  const [roles, setRoles] = useState<Role[]>(MOCK_ROLES);
  
  // --- NOTIFICATIONS & ADMIN ---
  const [allNotifications, setAllNotifications] = useState<ERPNotification[]>(MOCK_NOTIFICATIONS);
  const [systemLogs] = useState<SystemLog[]>(MOCK_SYSTEM_LOGS);
  const [backgroundJobs] = useState<BackgroundJob[]>(MOCK_BACKGROUND_JOBS);

  // --- TOOLS ---
  // Seed with some initial configuration
  const [clientToolConfigs, setClientToolConfigs] = useState<Record<string, ToolConfig>>({
    'client-a': { enabledToolIds: ['tool-volumetric', 'tool-currency-convert'], pinnedToolIds: [] },
    'client-b': { enabledToolIds: ['tool-volumetric'], pinnedToolIds: [] }
  });
  
  const [companyToolConfigs, setCompanyToolConfigs] = useState<Record<string, ToolConfig>>({
    'comp-a1': { enabledToolIds: ['tool-volumetric'], pinnedToolIds: ['tool-volumetric'] },
    'comp-a2': { enabledToolIds: [], pinnedToolIds: [] },
    'comp-b1': { enabledToolIds: ['tool-volumetric'], pinnedToolIds: [] }
  });

  const [toolHistory, setToolHistory] = useState<CalculationHistoryItem[]>([]);

  return {
    platformData, setPlatformData,
    allSalesDocs, setAllSalesDocs,
    allInventory, setAllInventory,
    allCustomers, setAllCustomers,
    allSuppliers, setAllSuppliers,
    allWarehouses, setAllWarehouses,
    allFinance, setAllFinance,
    allEmployees, setAllEmployees,
    allDepartments, setAllDepartments,
    allRunningNumbers, setAllRunningNumbers,
    allTaxCodes, setAllTaxCodes,
    roles, setRoles,
    allNotifications, setAllNotifications,
    systemLogs,
    backgroundJobs,
    // Tools
    clientToolConfigs, setClientToolConfigs,
    companyToolConfigs, setCompanyToolConfigs,
    toolHistory, setToolHistory
  };
};
