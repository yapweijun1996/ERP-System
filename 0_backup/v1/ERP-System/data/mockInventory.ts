import { InventoryItem, Supplier, Warehouse, PurchaseOrder } from '../types';

export const MOCK_INVENTORY: InventoryItem[] = [
  // US Inventory
  { id: 'ITM-001', clientId: 'client-a', companyId: 'comp-a1', sku: 'WIDGET-X', name: 'Super Widget X', stock: 150, unit: 'pcs', category: 'Finished Goods', price: 45.00 },
  { id: 'ITM-003', clientId: 'client-a', companyId: 'comp-a1', sku: 'BOLT-M8', name: 'M8 Steel Bolt', stock: 5000, unit: 'box', category: 'Raw Materials', price: 12.50 },
  
  // EU Inventory
  { id: 'ITM-002', clientId: 'client-a', companyId: 'comp-a2', sku: 'GADGET-Y', name: 'Mega Gadget Y', stock: 42, unit: 'pcs', category: 'Finished Goods', price: 110.00 },
];

export const MOCK_SUPPLIERS: Supplier[] = [
    { id: 'SUP-001', clientId: 'client-a', companyId: 'comp-a1', name: 'Steel Works Ltd', contact: 'Dave Smith', email: 'dave@steelworks.com', category: 'Raw Materials', status: 'Active' },
];

export const MOCK_WAREHOUSES: Warehouse[] = [
    { id: 'WH-001', clientId: 'client-a', companyId: 'comp-a1', code: 'MAIN-SF', name: 'San Francisco Hub', location: 'San Francisco, CA', manager: 'Mike Ross', status: 'Operational' },
    { id: 'WH-003', clientId: 'client-a', companyId: 'comp-a2', code: 'EU-BER', name: 'Berlin Depot', location: 'Berlin, DE', manager: 'Hans Gruber', status: 'Operational' },
];

export const MOCK_PURCHASE_ORDERS: PurchaseOrder[] = [
     { id: 'PO-9001', supplierName: 'Steel Works Ltd', date: '2023-10-15', total: 5400.00, status: 'Issued' },
];