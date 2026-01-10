
import { ScopedEntity } from './core';
import { ModuleId, TicketStatus, TicketPriority, TicketType, NotificationCategory, NotificationPriority, NotificationStatus } from './enums';

export interface ERPNotification {
  id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  status: NotificationStatus;
  
  title: string;
  message: string;
  timestamp: string; // ISO
  
  // Scope
  clientId: string;
  clientName: string;
  companyId: string;
  companyName: string;
  
  // Context
  module: ModuleId;
  entityId?: string;
  entityType?: string; // e.g. 'SO', 'PO'
  link?: string; // Router path
  
  // Actions (Task specific)
  actions?: ('APPROVE' | 'REJECT' | 'VIEW' | 'SNOOZE' | 'ACKNOWLEDGE')[];
}

export interface TicketMessage {
  id: string;
  senderId: string;
  senderName: string;
  isInternal: boolean; // True = Support Note, False = External Reply
  message: string;
  timestamp: string;
  attachments?: string[];
}

export interface TicketTimeline {
  id: string;
  action: string;
  actorName: string;
  timestamp: string;
  fromStatus?: TicketStatus;
  toStatus?: TicketStatus;
}

export interface Ticket extends ScopedEntity {
  id: string;
  title: string;
  description: string;
  module: ModuleId;
  status: TicketStatus;
  priority: TicketPriority;
  type: TicketType;
  
  // People
  creatorId: string;
  creatorName: string;
  assigneeId?: string;
  assigneeName?: string;
  
  created: string;
  updated: string;
  
  // Content
  messages: TicketMessage[];
  timeline: TicketTimeline[];
  
  // Resolution
  resolutionSummary?: string;
  reopenReason?: string;
  
  clientName?: string; // Denormalized for Platform view
  companyName?: string; // Denormalized
}
