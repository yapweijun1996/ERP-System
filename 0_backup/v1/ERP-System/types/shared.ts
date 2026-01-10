
import { ToastType, WorkspaceType } from './enums';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

export interface Task {
  id: string;
  title: string;
  count: number;
  priority: 'low' | 'medium' | 'high';
  link: string;
  type?: 'approval' | 'todo' | 'alert';
  workspace?: WorkspaceType;
}

export interface TimelineEvent {
  id: string;
  date: string;
  user: string;
  action: string;
  description?: string;
}

export interface RelatedDoc {
  id: string;
  type: string;
  status: string;
}

export interface MonthlyMetric {
    month: string;
    revenue: number;
    expenses: number;
    profit: number;
}

export interface RegionMetric {
    region: string;
    value: number;
}
