
import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { SalesDocument, SalesLineItem } from '../types';
import { calculateTotals } from '../utils/salesUtils';

export const useSalesLogic = (orderId: string) => {
    const { 
        salesDocuments, updateDocument, postDocument, addToast, 
        runningNumberConfigs, getPreviewId, hasPermission, 
        activeClient, activeCompany, inventory, customers, taxCodes 
    } = useApp();
  
    const [doc, setDoc] = useState<SalesDocument | null>(null);
    const [isPosting, setIsPosting] = useState(false);
    const [selectedSeriesId, setSelectedSeriesId] = useState<string>('');
    const [previewId, setPreviewId] = useState<string>('');

    // Initialize Document
    useEffect(() => {
        if (orderId === 'new') {
            const draftId = `DRAFT-${Math.floor(Math.random() * 100000).toString().padStart(6, '0')}`;
            setDoc({
                id: draftId,
                clientId: activeClient?.id || '',
                companyId: activeCompany?.id || '',
                type: 'INV',
                status: 'Draft',
                customerId: '',
                customerName: '',
                date: new Date().toISOString().split('T')[0],
                dueDate: '',
                salesExec: 'Current User',
                currency: activeCompany?.currency || 'USD',
                items: [],
                subtotal: 0,
                discountTotal: 0,
                taxableAmount: 0,
                taxTotal: 0,
                rounding: 0,
                grandTotal: 0,
                payments: [],
                balanceDue: 0
            });
        } else {
            const found = salesDocuments.find(d => d.id === orderId);
            if (found) {
                setDoc(JSON.parse(JSON.stringify(found))); 
                if (found.seriesId) setSelectedSeriesId(found.seriesId);
            }
        }
    }, [orderId, salesDocuments, activeClient, activeCompany]);

    // Handle Series Preview
    useEffect(() => {
        if (!doc) return;
        const companySeries = runningNumberConfigs.filter(c => c.docType === doc.type && c.companyId === activeCompany?.id);
        if (!selectedSeriesId) {
            const def = companySeries.find(c => c.isDefault) || companySeries[0];
            if (def) setSelectedSeriesId(def.id);
        }
        if (selectedSeriesId) {
            setPreviewId(getPreviewId(selectedSeriesId));
        }
    }, [doc?.type, selectedSeriesId, runningNumberConfigs, getPreviewId, activeCompany]);

    const isLocked = doc?.status !== 'Draft';

    // Actions
    const updateLineItem = useCallback((lineId: string, field: keyof SalesLineItem, value: any) => {
        if (!doc || isLocked) return;
        
        let newItems = doc.items.map(item => {
            if (item.id === lineId) {
                let updated = { ...item, [field]: value };
                if (field === 'stockCode') {
                    const invItem = inventory.find(i => i.id === value);
                    if (invItem) {
                        updated.description = invItem.name;
                        updated.unitPrice = invItem.price;
                        updated.uom = invItem.unit;
                    }
                }
                return updated;
            }
            return item;
        });

        const calculations = calculateTotals(newItems, taxCodes);
        setDoc(prev => prev ? ({ ...prev, ...calculations, balanceDue: (calculations.grandTotal || 0) - prev.payments.reduce((a,c) => a + c.amount, 0) }) : null);
    }, [doc, isLocked, inventory, taxCodes]);

    const addLine = useCallback(() => {
        if (!doc || isLocked) return;
        const newLine: SalesLineItem = {
            id: Math.random().toString(36).substr(2, 9),
            stockCode: '',
            description: '',
            qty: 1,
            uom: 'unit',
            unitPrice: 0,
            discountType: 'PERCENT',
            discountValue: 0,
            discount: 0,
            taxCode: taxCodes[0]?.code || 'SR',
            taxAmount: 0,
            lineTotal: 0
        };
        const newItems = [...doc.items, newLine];
        const calculations = calculateTotals(newItems, taxCodes);
        setDoc(prev => prev ? ({ ...prev, ...calculations }) : null);
    }, [doc, isLocked, taxCodes]);

    const removeLine = useCallback((id: string) => {
        if (!doc || isLocked) return;
        const newItems = doc.items.filter(i => i.id !== id);
        const calculations = calculateTotals(newItems, taxCodes);
        setDoc(prev => prev ? ({ ...prev, ...calculations }) : null);
    }, [doc, isLocked, taxCodes]);

    const updateHeader = useCallback((field: keyof SalesDocument, value: any) => {
        if (!doc || isLocked) return;
        let updates: any = { [field]: value };
        
        if (field === 'customerId') {
           const cust = customers.find(c => c.id === value);
           if (cust) {
               updates.customerName = cust.name;
               updates.billingAddress = cust.address;
               const d = new Date(doc.date);
               d.setDate(d.getDate() + cust.terms);
               updates.dueDate = d.toISOString().split('T')[0];
           }
        }
        setDoc(prev => prev ? ({ ...prev, ...updates }) : null);
    }, [doc, isLocked, customers]);

    const handleSaveDraft = useCallback(() => {
        if(!doc) return;
        updateDocument({ ...doc, seriesId: selectedSeriesId });
        addToast('Draft Saved', 'Document saved successfully.', 'success');
    }, [doc, selectedSeriesId, updateDocument, addToast]);

    const checkApprovalNeeded = useCallback(() => {
        if (!doc) return false;
        const discountPercentage = (doc.discountTotal / (doc.subtotal || 1)) * 100;
        return discountPercentage > 10;
    }, [doc]);

    const handlePost = useCallback(async () => {
        if(!doc) return;
        if (!doc.customerId) { addToast('Validation Error', 'Customer is required.', 'error'); return; }
        if (doc.items.length === 0) { addToast('Validation Error', 'Add at least one line item.', 'error'); return; }

        const needsApproval = checkApprovalNeeded();
        const canApprove = hasPermission('SALES_DISCOUNT_APPROVE');

        if (needsApproval && !canApprove) {
            addToast('Approval Required', 'Discount exceeds 10%. Submitted for manager approval.', 'warning');
            setDoc(prev => prev ? ({...prev, status: 'Pending Approval'}) : null);
            return;
        }
        
        setIsPosting(true);
        try {
            const postedDoc = await postDocument(doc, selectedSeriesId);
            setDoc(postedDoc);
            addToast('Document Posted', `Successfully posted as ${postedDoc.id}`, 'success');
        } catch (e: any) {
            addToast('Posting Failed', e.message || 'Could not post document.', 'error');
        } finally {
            setIsPosting(false);
        }
    }, [doc, checkApprovalNeeded, hasPermission, postDocument, selectedSeriesId, addToast]);

    return {
        doc, setDoc,
        isLocked,
        isPosting,
        selectedSeriesId, setSelectedSeriesId,
        previewId,
        updateLineItem, addLine, removeLine, updateHeader,
        handleSaveDraft, handlePost, checkApprovalNeeded,
        availableSeries: runningNumberConfigs.filter(c => c.docType === doc?.type && c.companyId === activeCompany?.id),
        activeCompany,
        customers,
        inventory,
        taxCodes,
        hasPermission
    };
};
