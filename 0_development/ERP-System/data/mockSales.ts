import { TaxCode, RunningNumberConfig, SalesDocument, Customer, Order, Invoice } from '../types';

// --- CONFIGURATION ---

export const TAX_CODES: TaxCode[] = [
    { code: 'US-SALES', rate: 0.0825, description: 'US Sales Tax', clientId: 'client-a', companyId: 'comp-a1' },
    { code: 'VAT-STD', rate: 0.19, description: 'DE VAT Standard (19%)', clientId: 'client-a', companyId: 'comp-a2' },
    { code: 'VAT-RED', rate: 0.07, description: 'DE VAT Reduced (7%)', clientId: 'client-a', companyId: 'comp-a2' },
    { code: 'US-EXEMPT', rate: 0.00, description: 'US Exempt', clientId: 'client-a', companyId: 'comp-a1' },
];

export const MOCK_RUNNING_NUMBERS: RunningNumberConfig[] = [
    // Comp A1 (US) - SALES ORDERS
    { id: 'rn-a1-so', docType: 'SO', name: 'Standard Sales Order', isDefault: true, prefix: 'SO', separator: '-', dateFormat: 'YYMM', digits: 4, nextSequence: 2, resetFrequency: 'Monthly', suffix: 'US', clientId: 'client-a', companyId: 'comp-a1' },
    { id: 'rn-a1-so-web', docType: 'SO', name: 'Web Order', isDefault: false, prefix: 'WEB', separator: '', dateFormat: 'YYYYMMDD', digits: 5, nextSequence: 341, resetFrequency: 'Never', clientId: 'client-a', companyId: 'comp-a1' },
    
    // Comp A1 (US) - INVOICES
    { id: 'rn-a1-inv', docType: 'INV', name: 'Standard Invoice (INV)', isDefault: true, prefix: 'INV', separator: '-', dateFormat: 'YYYY', digits: 5, nextSequence: 1042, resetFrequency: 'Yearly', clientId: 'client-a', companyId: 'comp-a1' },
    { id: 'rn-a1-inv-exp', docType: 'INV', name: 'Export Invoice (EXP)', isDefault: false, prefix: 'EXP', separator: '/', dateFormat: 'YYMM', digits: 4, nextSequence: 15, resetFrequency: 'Monthly', clientId: 'client-a', companyId: 'comp-a1' },
    { id: 'rn-a1-inv-gov', docType: 'INV', name: 'Government Contract (GOV)', isDefault: false, prefix: 'GOV', separator: '-', dateFormat: 'YYYY', digits: 6, nextSequence: 88, resetFrequency: 'Yearly', clientId: 'client-a', companyId: 'comp-a1' },
    { id: 'rn-a1-inv-ecom', docType: 'INV', name: 'E-Commerce Sale (WEB)', isDefault: false, prefix: 'WEB', separator: '', dateFormat: 'YYYYMMDD', digits: 5, nextSequence: 4021, resetFrequency: 'Never', clientId: 'client-a', companyId: 'comp-a1' },
    
    // Comp A2 (EU)
    { id: 'rn-a2-inv', docType: 'INV', name: 'EU Invoice', isDefault: true, prefix: 'DE', separator: '', dateFormat: 'YYYYMMDD', digits: 3, nextSequence: 55, resetFrequency: 'Never', clientId: 'client-a', companyId: 'comp-a2' },
];

const mockAddress = { street: '123 Acme Way', city: 'Metropolis', state: 'NY', zip: '10012', country: 'USA' };
const mockAddressDE = { street: 'Berliner Str. 5', city: 'Berlin', state: 'Berlin', zip: '10115', country: 'DE' };

export const MOCK_CUSTOMERS: Customer[] = [
    { id: 'CUST-001', clientId: 'client-a', companyId: 'comp-a1', name: 'Acme Corp', email: 'contact@acme.com', phone: '+1 555 0101', segment: 'Wholesale', status: 'Active', address: mockAddress, terms: 30 },
    { id: 'CUST-EU-01', clientId: 'client-a', companyId: 'comp-a2', name: 'EuroTech GmbH', email: 'info@eurotech.de', phone: '+49 30 123456', segment: 'Distributor', status: 'Active', address: mockAddressDE, terms: 14 },
];

export const MOCK_SALES_DOCUMENTS: SalesDocument[] = [
  // US Company Docs
  { 
    id: 'SO-2310-0001-US', 
    clientId: 'client-a',
    companyId: 'comp-a1',
    type: 'SO', status: 'Posted',
    customerId: 'CUST-001', customerName: 'Acme Corp', 
    date: '2023-10-01', dueDate: '2023-10-31',
    salesExec: 'Bob Sales', currency: 'USD',
    billingAddress: mockAddress, shippingAddress: mockAddress,
    items: [
        { id: '1', stockCode: 'WIDGET-X', description: 'Super Widget X', qty: 10, uom: 'pcs', unitPrice: 100, discountType: 'FIXED', discountValue: 0, discount: 0, taxCode: 'US-SALES', taxAmount: 82.50, lineTotal: 1082.50 }
    ],
    subtotal: 1000, discountTotal: 0, taxableAmount: 1000, taxTotal: 82.50, rounding: 0, grandTotal: 1082.50,
    payments: [], balanceDue: 1082.50
  },
  // EU Company Docs
  { 
    id: 'DE20231015055', 
    clientId: 'client-a',
    companyId: 'comp-a2',
    type: 'INV', status: 'Posted',
    customerId: 'CUST-EU-01', customerName: 'EuroTech GmbH', 
    date: '2023-10-15', dueDate: '2023-11-15',
    salesExec: 'Charlie EU', currency: 'EUR',
    billingAddress: mockAddressDE, shippingAddress: mockAddressDE,
    items: [
        { id: '1', stockCode: 'GADGET-Y', description: 'Mega Gadget Y', qty: 5, uom: 'pcs', unitPrice: 120, discountType: 'PERCENT', discountValue: 0, discount: 0, taxCode: 'VAT-STD', taxAmount: 114, lineTotal: 714 }
    ],
    subtotal: 600, discountTotal: 0, taxableAmount: 600, taxTotal: 114, rounding: 0, grandTotal: 714,
    payments: [], balanceDue: 714
  }
];

export const MOCK_ORDERS: Order[] = MOCK_SALES_DOCUMENTS.map(d => ({ ...d, total: d.grandTotal }));
export const MOCK_INVOICES: Invoice[] = [
    { id: 'INV-2023-001', orderId: 'SO-1001', customerName: 'Acme Corp', date: '2023-10-01', dueDate: '2023-10-31', amount: 1250.00, status: 'Paid', itemsCount: 3 },
];