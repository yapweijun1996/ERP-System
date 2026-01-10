import { FinanceTransaction } from '../types';

export const MOCK_FINANCE: FinanceTransaction[] = [
    { id: 'TRX-001', clientId: 'client-a', companyId: 'comp-a1', date: '2023-10-24', description: 'Consulting Revenue', amount: 15000, type: 'Income', status: 'Posted', category: 'Sales' },
    { id: 'TRX-EU-01', clientId: 'client-a', companyId: 'comp-a2', date: '2023-10-22', description: 'Miete (Rent)', amount: -2500, type: 'Expense', status: 'Posted', category: 'Rent' },
];