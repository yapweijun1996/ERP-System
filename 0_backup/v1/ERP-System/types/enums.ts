
export type ViewLevel = 'PLATFORM' | 'CLIENT' | 'COMPANY';

export enum ModuleId {
  SALES = 'SALES',
  INVENTORY = 'INVENTORY',
  MASTER_DATA = 'MASTER_DATA',
  ANALYTICS = 'ANALYTICS',
  BILLING = 'BILLING',
  SUPPORT = 'SUPPORT',
  PURCHASING = 'PURCHASING',
  FINANCE = 'FINANCE',
  ORGANIZATION = 'ORGANIZATION',
}

export type WorkspaceType = 'SALES' | 'INVENTORY' | 'FINANCE' | 'EXECUTIVE' | 'HR';

export type DocStatus = 'Draft' | 'Posted' | 'Void' | 'Paid' | 'Pending Approval';
export type DocType = 'SO' | 'INV' | 'DO' | 'PO' | 'SQ' | 'CN';
export type DiscountType = 'PERCENT' | 'FIXED';

export type NotificationCategory = 'INFO' | 'TASK' | 'EXCEPTION' | 'MENTION';
export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type NotificationStatus = 'UNREAD' | 'READ' | 'ARCHIVED';

export type TicketStatus = 
  | 'Draft' 
  | 'Submitted' 
  | 'Triaging' 
  | 'Waiting Customer' 
  | 'In Progress' 
  | 'Resolved' 
  | 'Closed';

export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type TicketType = 'Bug' | 'Question' | 'Feature Request' | 'Access';

export type ToastType = 'success' | 'error' | 'info' | 'warning';
