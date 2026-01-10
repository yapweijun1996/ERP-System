
import { ScopedEntity } from './core';

export interface FinanceTransaction extends ScopedEntity {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'Income' | 'Expense';
  status: 'Posted' | 'Pending';
  category: string;
}
