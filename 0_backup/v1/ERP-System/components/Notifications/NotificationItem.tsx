
import React from 'react';
import { ERPNotification } from '../../types';
import { CheckCircle, AlertTriangle, Info, MessageSquare, AlertOctagon, X, Clock, ExternalLink } from 'lucide-react';

interface NotificationItemProps {
  item: ERPNotification;
  onAction: (id: string, action: string) => void;
  onNavigate?: (path: string, id?: string) => void;
  compact?: boolean;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({ item, onAction, onNavigate, compact = false }) => {
  
  const getIcon = () => {
    switch (item.category) {
      case 'TASK': return <CheckCircle className="w-5 h-5 text-blue-500" />;
      case 'EXCEPTION': return item.priority === 'CRITICAL' ? <AlertOctagon className="w-5 h-5 text-red-500" /> : <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'MENTION': return <MessageSquare className="w-5 h-5 text-purple-500" />;
      default: return <Info className="w-5 h-5 text-slate-400" />;
    }
  };

  const getPriorityBorder = () => {
    if (item.priority === 'CRITICAL') return 'border-l-4 border-l-red-500';
    if (item.priority === 'HIGH') return 'border-l-4 border-l-amber-500';
    return 'border-l-4 border-l-transparent';
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const handleNavigate = () => {
      if (item.link && onNavigate) {
          onNavigate(item.link, item.entityId);
      }
  };

  return (
    <div className={`relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 ${getPriorityBorder()} ${compact ? 'p-3' : 'p-4 rounded-lg'} hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group`}>
        <div className="flex gap-3">
            <div className="mt-0.5 shrink-0">
                {getIcon()}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                    <h4 className={`text-sm font-semibold text-slate-800 dark:text-slate-200 ${item.status === 'UNREAD' ? 'font-bold' : 'font-medium'}`}>
                        {item.title}
                    </h4>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">{timeAgo(item.timestamp)}</span>
                </div>
                
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                    {item.message}
                </p>

                <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded border border-slate-200 dark:border-slate-700 truncate max-w-[120px]">
                        {item.companyName}
                    </span>
                    {item.link && (
                        <button onClick={handleNavigate} className="text-[10px] flex items-center text-blue-600 dark:text-blue-400 hover:underline">
                            View <ExternalLink className="w-3 h-3 ml-1" />
                        </button>
                    )}
                </div>

                {/* Actions */}
                {item.actions && item.actions.length > 0 && (
                    <div className="flex gap-2 mt-3">
                        {item.actions.map(action => {
                            if (action === 'VIEW') return null; // handled by link
                            const isPrimary = action === 'APPROVE' || action === 'ACKNOWLEDGE';
                            const isDestructive = action === 'REJECT';
                            
                            return (
                                <button 
                                    key={action}
                                    onClick={(e) => { e.stopPropagation(); onAction(item.id, action); }}
                                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                        isPrimary ? 'bg-blue-600 text-white hover:bg-blue-700' :
                                        isDestructive ? 'bg-white border border-slate-200 text-red-600 hover:bg-red-50 dark:bg-slate-800 dark:border-slate-700' :
                                        'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                                    }`}
                                >
                                    {action.charAt(0) + action.slice(1).toLowerCase()}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
            
            {/* Hover Actions (Desktop) */}
            {!compact && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onAction(item.id, 'SNOOZE'); }}
                        title="Snooze"
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded"
                    >
                        <Clock className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onAction(item.id, 'ACKNOWLEDGE'); }}
                        title="Mark Read"
                        className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded"
                    >
                        <CheckCircle className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    </div>
  );
};
