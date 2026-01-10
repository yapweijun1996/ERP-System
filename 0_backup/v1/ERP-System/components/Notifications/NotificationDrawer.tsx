
import React, { useMemo } from 'react';
import { X, CheckCheck, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NotificationItem } from './NotificationItem';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string) => void;
  onDetailNavigate: (page: string, id?: string) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ isOpen, onClose, onNavigate, onDetailNavigate }) => {
  const { notifications, notificationAction } = useApp();

  const unreadNotifications = useMemo(() => {
      return notifications
        .filter(n => n.status !== 'ARCHIVED')
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [notifications]);

  const handleAction = (id: string, action: string) => {
      notificationAction(id, action);
  };

  const handleDetail = (path: string, id?: string) => {
      onDetailNavigate(path, id);
      onClose();
  };

  return (
    <>
        {/* Backdrop */}
        {isOpen && (
            <div 
                className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 transition-opacity"
                onClick={onClose}
            />
        )}

        {/* Drawer Panel */}
        <div className={`fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white dark:bg-slate-900 shadow-2xl z-[60] transform transition-transform duration-300 ease-in-out border-l border-slate-200 dark:border-slate-800 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Inbox</h2>
                    <p className="text-xs text-slate-500">{unreadNotifications.filter(n => n.status === 'UNREAD').length} unread items</p>
                </div>
                <div className="flex items-center gap-2">
                    <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors" title="Mark all read">
                        <CheckCheck className="w-5 h-5" />
                    </button>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
                {unreadNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 px-8 text-center">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            <CheckCheck className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="text-sm font-medium">All caught up!</p>
                        <p className="text-xs mt-1">No new notifications or tasks.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {unreadNotifications.map(item => (
                            <NotificationItem 
                                key={item.id} 
                                item={item} 
                                onAction={handleAction} 
                                onNavigate={handleDetail}
                                compact={true}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                <button 
                    onClick={() => { onNavigate('notifications'); onClose(); }}
                    className="w-full flex items-center justify-center py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                >
                    View Notification Center <ArrowRight className="w-4 h-4 ml-2" />
                </button>
            </div>
        </div>
    </>
  );
};
