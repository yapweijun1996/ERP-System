
import { ScopedEntity, Address } from './core';
import { DocType, DocStatus, DiscountType } from './enums';

export interface SalesLineItem {
  id: string;
  stockCode: string;
  description: string;
  qty: number;
  uom: string;
  unitPrice: number;
  discountType: DiscountType;
  discountValue: number;      
  discount: number;           
  taxCode: string;
  taxAmount: number;
  lineTotal: number; 
  remarks?: string;
}

export interface PaymentSplit {
  method: 'Cash' | 'Bank Transfer' | 'Credit Card' | 'Cheque' | 'Credit Note';
  amount: number;
  reference?: string;
}

export interface SalesDocument extends ScopedEntity {
  id: string;
  type: DocType;
  status: DocStatus;
  seriesId?: string; 
  customerId: string;
  customerName: string;
  date: string;
  dueDate: string;
  salesExec: string;
  currency: string;
  project?: string;
  customerPO?: string;
  remarks?: string;
  billingAddress?: Address;
  shippingAddress?: Address;
  items: SalesLineItem[];
  subtotal: number;       
  discountTotal: number;  
  docDiscountValue?: number; 
  docDiscountType?: DiscountType; 
  taxableAmount: number;  
  taxTotal: number;
  rounding: number;
  grandTotal: number;
  payments: PaymentSplit[];
  balanceDue: number;
}

export interface Order extends SalesDocument {
  total: number; 
}

export interface Invoice {
    id: string;
    orderId: string;
    customerName: string;
    date: string;
    dueDate: string;
    amount: number;
    status: 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Void';
    itemsCount: number;
}
