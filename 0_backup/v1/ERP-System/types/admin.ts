
import { User } from './rbac';

export interface SupportSession {
    isActive: boolean;
    originalUser: User;
    targetClientId: string;
    targetCompanyId?: string;
    startTime: string;
    expiryTime: string;
    reason?: string;
    isReadOnly: boolean;
}

export interface SystemLog {
    id: string;
    timestamp: string;
    level: 'INFO' | 'WARN' | 'ERROR' | 'FATAL' | 'DEBUG';
    module: string;
    message: string;
    clientId?: string;
    traceId: string;
    metadata?: Record<string, any>;
}

export interface BackgroundJob {
    id: string;
    name: string;
    status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    progress: number;
    clientId?: string;
    startedAt: string;
    nextRetry?: string;
    retries: number;
    error?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  target: string;
  details: string;
}

export interface SecurityPolicy {
  id: string;
  name: string;
  type: 'Role' | 'Access' | 'Compliance';
  status: 'Active' | 'Draft';
  usersCount: number;
}

export interface IntegrationApp {
  id: string;
  name: string;
  category: 'Payment' | 'Shipping' | 'CRM' | 'Comms';
  status: 'Connected' | 'Available';
  icon: string;
}

export interface SystemService {
  name: string;
  status: 'Operational' | 'Degraded' | 'Down';
  uptime: string;
  region: string;
}
