
export interface PurchaseOrder {
    id: string;
    supplierName: string;
    date: string;
    total: number;
    status: 'Draft' | 'Pending Approval' | 'Issued' | 'Received';
}
