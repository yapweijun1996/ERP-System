
import { useState, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Ticket, TicketStatus, TicketMessage, TicketTimeline, TicketPriority, TicketType, ModuleId } from '../types';
import { MOCK_TICKETS } from '../constants';

export const useTicketLogic = (ticketId?: string) => {
    const { currentUser, viewLevel, addToast } = useApp();
    const [tickets, setTickets] = useState<Ticket[]>(MOCK_TICKETS);
    const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);

    // Initial Load
    useMemo(() => {
        if (ticketId && ticketId !== 'new') {
            const found = tickets.find(t => t.id === ticketId);
            if (found) setActiveTicket(found);
        }
    }, [ticketId, tickets]);

    // Permissions
    const isSupport = viewLevel === 'PLATFORM';
    const isCustomer = viewLevel === 'COMPANY' || viewLevel === 'CLIENT';

    // State Machine Transitions
    const availableTransitions = useMemo(() => {
        if (!activeTicket) return [];
        const status = activeTicket.status;
        const transitions: { action: string, to: TicketStatus, variant: 'primary' | 'secondary' | 'danger' }[] = [];

        if (isCustomer) {
            if (status === 'Draft') transitions.push({ action: 'Submit Ticket', to: 'Submitted', variant: 'primary' });
            if (status === 'Waiting Customer') transitions.push({ action: 'Reply & Resume', to: 'In Progress', variant: 'primary' });
            if (status === 'Resolved') {
                transitions.push({ action: 'Confirm Closed', to: 'Closed', variant: 'primary' });
                transitions.push({ action: 'Reopen', to: 'In Progress', variant: 'danger' });
            }
            if (status === 'Closed') transitions.push({ action: 'Reopen', to: 'In Progress', variant: 'secondary' });
        }

        if (isSupport) {
            if (status === 'Submitted') transitions.push({ action: 'Triage', to: 'Triaging', variant: 'primary' });
            if (status === 'Triaging') {
                transitions.push({ action: 'Start Work', to: 'In Progress', variant: 'primary' });
                transitions.push({ action: 'Request Info', to: 'Waiting Customer', variant: 'secondary' });
            }
            if (status === 'In Progress') {
                transitions.push({ action: 'Resolve', to: 'Resolved', variant: 'primary' });
                transitions.push({ action: 'Request Info', to: 'Waiting Customer', variant: 'secondary' });
            }
            if (status === 'Resolved') transitions.push({ action: 'Close', to: 'Closed', variant: 'primary' });
        }

        return transitions;
    }, [activeTicket, isCustomer, isSupport]);

    const updateTicket = useCallback((updates: Partial<Ticket>) => {
        if (!activeTicket) return;
        const updated = { ...activeTicket, ...updates, updated: new Date().toISOString() };
        
        setTickets(prev => prev.map(t => t.id === updated.id ? updated : t));
        setActiveTicket(updated);
    }, [activeTicket]);

    const changeStatus = useCallback((toStatus: TicketStatus, reason?: string) => {
        if (!activeTicket) return;
        const oldStatus = activeTicket.status;
        
        const newTimeline: TicketTimeline = {
            id: `tl-${Date.now()}`,
            action: `Status Change: ${oldStatus} -> ${toStatus}`,
            actorName: currentUser.name,
            timestamp: new Date().toISOString(),
            fromStatus: oldStatus,
            toStatus: toStatus
        };

        const updates: Partial<Ticket> = {
            status: toStatus,
            timeline: [...activeTicket.timeline, newTimeline]
        };

        if (toStatus === 'Resolved' && reason) updates.resolutionSummary = reason;
        if (toStatus === 'In Progress' && (oldStatus === 'Resolved' || oldStatus === 'Closed') && reason) updates.reopenReason = reason;

        updateTicket(updates);
        addToast('Status Updated', `Ticket moved to ${toStatus}`, 'success');
    }, [activeTicket, currentUser, updateTicket, addToast]);

    const sendMessage = useCallback((text: string, isInternal: boolean) => {
        if (!activeTicket) return;
        
        const newMessage: TicketMessage = {
            id: `msg-${Date.now()}`,
            senderId: currentUser.id,
            senderName: currentUser.name,
            isInternal,
            message: text,
            timestamp: new Date().toISOString()
        };

        const updates: Partial<Ticket> = {
            messages: [...activeTicket.messages, newMessage]
        };

        // Customer replying automatically moves waiting tickets to in progress
        if (isCustomer && activeTicket.status === 'Waiting Customer') {
            updates.status = 'In Progress';
            updates.timeline = [...activeTicket.timeline, {
                id: `tl-${Date.now()}`,
                action: 'Customer Reply',
                actorName: currentUser.name,
                timestamp: new Date().toISOString(),
                fromStatus: 'Waiting Customer',
                toStatus: 'In Progress'
            }];
        }

        updateTicket(updates);
    }, [activeTicket, currentUser, isCustomer, updateTicket]);

    const createTicket = useCallback((data: { title: string, description: string, priority: TicketPriority, type: TicketType, module: ModuleId }) => {
        const newTicket: Ticket = {
            id: `TKT-${Math.floor(Math.random() * 10000)}`,
            clientId: currentUser.clientId,
            clientName: 'Current Client', // Mock
            companyId: currentUser.defaultCompanyId || '',
            companyName: 'Current Company', // Mock
            creatorId: currentUser.id,
            creatorName: currentUser.name,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            status: 'Submitted', // Jump straight to submitted for simplicity in this proto
            messages: [],
            timeline: [{
                id: `tl-${Date.now()}`,
                action: 'Created',
                actorName: currentUser.name,
                timestamp: new Date().toISOString(),
                toStatus: 'Submitted'
            }],
            ...data
        };
        setTickets(prev => [newTicket, ...prev]);
        addToast('Ticket Created', 'Support team has been notified.', 'success');
        return newTicket;
    }, [currentUser, addToast]);

    return {
        tickets,
        activeTicket,
        availableTransitions,
        isSupport,
        isCustomer,
        updateTicket,
        changeStatus,
        sendMessage,
        createTicket
    };
};
