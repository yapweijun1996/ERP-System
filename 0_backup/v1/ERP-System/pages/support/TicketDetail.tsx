
import React, { useState } from 'react';
import { useTicketLogic } from '../../hooks/useTicketLogic';
import { Modal } from '../../components/UI/Modal';
import { TicketHeader } from '../../components/Tickets/TicketHeader';
import { TicketSidebar } from '../../components/Tickets/TicketSidebar';
import { TicketConversation } from '../../components/Tickets/TicketConversation';

interface TicketDetailProps {
    id: string;
    onBack: () => void;
}

export const TicketDetail: React.FC<TicketDetailProps> = ({ id, onBack }) => {
    const { activeTicket: ticket, availableTransitions, changeStatus, sendMessage, isSupport } = useTicketLogic(id);
    const [actionModal, setActionModal] = useState<{ isOpen: boolean, action: string, requireReason: boolean } | null>(null);
    const [reasonText, setReasonText] = useState('');

    if (!ticket) return <div className="p-8 text-center text-slate-500">Loading ticket...</div>;

    const handleTransitionClick = (action: string) => {
        const requireReason = action === 'Resolve' || action === 'Reopen';
        
        if (requireReason) {
            setReasonText('');
            setActionModal({ isOpen: true, action, requireReason: true });
        } else {
            // Find the 'to' status for this action
            const transition = availableTransitions.find(t => t.action === action);
            if (transition) changeStatus(transition.to);
        }
    };

    const confirmAction = () => {
        if (!actionModal) return;
        const transition = availableTransitions.find(t => t.action === actionModal.action);
        if (transition) {
            changeStatus(transition.to, reasonText);
        }
        setActionModal(null);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
            
            <TicketHeader 
                ticket={ticket} 
                onBack={onBack} 
                availableTransitions={availableTransitions as any} 
                onTransition={handleTransitionClick} 
            />

            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                <TicketConversation 
                    ticket={ticket} 
                    isSupport={isSupport} 
                    onSendMessage={sendMessage} 
                />
                <TicketSidebar 
                    ticket={ticket} 
                    isSupport={isSupport} 
                />
            </div>

            {/* Transition Action Modal */}
            <Modal 
                isOpen={!!actionModal} 
                onClose={() => setActionModal(null)} 
                title={actionModal?.action || 'Update Ticket'}
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        Are you sure you want to <strong>{actionModal?.action}</strong> this ticket?
                    </p>
                    
                    {actionModal?.requireReason && (
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">
                                {actionModal.action === 'Resolve' ? 'Resolution Summary' : 'Reason / Note'} <span className="text-red-500">*</span>
                            </label>
                            <textarea 
                                value={reasonText}
                                onChange={e => setReasonText(e.target.value)}
                                className="w-full mt-1 p-2 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 resize-none text-sm"
                                rows={3}
                                placeholder="Please provide details..."
                            />
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={() => setActionModal(null)} className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded">Cancel</button>
                        <button 
                            onClick={confirmAction}
                            disabled={actionModal?.requireReason && !reasonText.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
