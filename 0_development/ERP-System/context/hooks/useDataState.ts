
import { useState } from 'react';
import {
  Platform, SalesDocument, InventoryItem, Customer, Supplier, Warehouse,
  FinanceTransaction, Employee, Department, RunningNumberConfig, TaxCode,
  Role, ERPNotification, SystemLog, BackgroundJob, ToolConfig, CalculationHistoryItem
} from '../../types';

// Initial Empty States
const INITIAL_PLATFORM: Platform = {
  id: 'platform',
  name: 'Nexus ERP Platform',
  clients: [],
  features: {
    SALES: false,
    INVENTORY: false,
    MASTER_DATA: false,
    ANALYTICS: false,
    BILLING: false,
    SUPPORT: false,
    PURCHASING: false,
    FINANCE: false
  }
};

export const useDataState = () => {
  const [platformData, setPlatformData] = useState<Platform>(INITIAL_PLATFORM);
  const [allSalesDocs, setAllSalesDocs] = useState<SalesDocument[]>([]);
  const [allInventory, setAllInventory] = useState<InventoryItem[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
  const [allWarehouses, setAllWarehouses] = useState<Warehouse[]>([]);
  const [allFinance, setAllFinance] = useState<FinanceTransaction[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [allRunningNumbers, setAllRunningNumbers] = useState<RunningNumberConfig[]>([]);
  const [allTaxCodes, setAllTaxCodes] = useState<TaxCode[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  // --- NOTIFICATIONS & ADMIN ---
  const [allNotifications, setAllNotifications] = useState<ERPNotification[]>([]);
  const [systemLogs] = useState<SystemLog[]>([]);
  const [backgroundJobs] = useState<BackgroundJob[]>([]);

  // --- TOOLS ---
  const [clientToolConfigs, setClientToolConfigs] = useState<Record<string, ToolConfig>>({});

  const [companyToolConfigs, setCompanyToolConfigs] = useState<Record<string, ToolConfig>>({});

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
