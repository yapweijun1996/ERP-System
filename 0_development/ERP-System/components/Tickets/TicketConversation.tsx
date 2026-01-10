
import React, { useState, useRef, useEffect } from 'react';
import { Ticket } from '../../types';
import { CheckCircle, Lock, Paperclip, Send } from 'lucide-react';

interface TicketConversationProps {
  ticket: Ticket;
  isSupport: boolean;
  onSendMessage: (text: string, isInternal: boolean) => void;
}

export const TicketConversation: React.FC<TicketConversationProps> = ({ ticket, isSupport, onSendMessage }) => {
  const [newMessage, setNewMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket.messages]);

  const handleSend = () => {
      if (!newMessage.trim()) return;
      onSendMessage(newMessage, isInternal);
      setNewMessage('');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Resolution Banner */}
        {ticket.status === 'Resolved' && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800 p-4 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <div>
                    <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Resolution Summary</h4>
                    <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">{ticket.resolutionSummary || 'No summary provided.'}</p>
                </div>
            </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50 dark:bg-slate-950">
            {/* Original Description */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm mb-8">
                <div className="flex items-center gap-3 mb-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                        {ticket.creatorName[0]}
                    </div>
                    <div>
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{ticket.creatorName}</div>
                        <div className="text-xs text-slate-500">Created on {new Date(ticket.created).toLocaleString()}</div>
                    </div>
                </div>
                <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {ticket.description}
                </p>
            </div>

            {/* Thread */}
            {ticket.messages.map(msg => {
                // Filter Internal Notes for End Users
                if (msg.isInternal && !isSupport) return null;

                return (
                    <div key={msg.id} className={`flex gap-4 ${msg.isInternal ? 'pl-8' : ''}`}>
                        <div className={`flex-1 p-4 rounded-xl border shadow-sm relative ${
                            msg.isInternal 
                            ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' 
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                        }`}>
                            {msg.isInternal && (
                                <div className="absolute -top-2.5 right-4 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                                    <Lock className="w-3 h-3" /> Internal Note
                                </div>
                            )}
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{msg.senderName}</span>
                                <span className="text-[10px] text-slate-400">{new Date(msg.timestamp).toLocaleString()}</span>
                            </div>
                            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{msg.message}</p>
                        </div>
                    </div>
                );
            })}
            <div ref={messagesEndRef} />
        </div>

        {/* Reply Input */}
        {ticket.status !== 'Closed' && (
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                {isSupport && (
                    <div className="flex items-center gap-4 mb-2">
                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                            <input 
                                type="radio" 
                                name="msgType" 
                                checked={!isInternal} 
                                onChange={() => setIsInternal(false)}
                                className="text-blue-600"
                            />
                            <span className="text-slate-700 dark:text-slate-300">Public Reply</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                            <input 
                                type="radio" 
                                name="msgType" 
                                checked={isInternal} 
                                onChange={() => setIsInternal(true)}
                                className="text-amber-600"
                            />
                            <span className="text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                                <Lock className="w-3 h-3" /> Internal Note
                            </span>
                        </label>
                    </div>
                )}
                <div className={`relative rounded-xl border overflow-hidden transition-colors ${isInternal ? 'border-amber-300 dark:border-amber-700 bg-amber-50/30' : 'border-slate-200 dark:border-slate-700'}`}>
                    <textarea 
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        placeholder={isInternal ? "Add an internal note..." : "Type your reply..."}
                        className="w-full p-4 bg-transparent outline-none text-sm min-h-[100px] resize-none"
                    />
                    <div className="flex justify-between items-center px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                        <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
                            <Paperclip className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={handleSend}
                            disabled={!newMessage.trim()}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                                !newMessage.trim() 
                                ? 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600' 
                                : isInternal 
                                    ? 'bg-amber-600 text-white hover:bg-amber-700' 
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                        >
                            <Send className="w-3 h-3" /> {isInternal ? 'Save Note' : 'Send Reply'}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
