
import React from 'react';
import { MoreHorizontal, Move, X } from 'lucide-react';
import { WidgetSize } from '../../types';

export const getWidgetSizeClass = (size: WidgetSize) => {
  switch (size) {
    case 'SMALL': return 'col-span-1';
    case 'MEDIUM': return 'col-span-1 md:col-span-2 lg:col-span-2';
    case 'LARGE': return 'col-span-1 md:col-span-2 lg:col-span-3';
    case 'FULL': return 'col-span-1 md:col-span-2 lg:col-span-4';
    default: return 'col-span-1';
  }
};

interface WidgetBaseProps {
  title: string;
  size: WidgetSize;
  children: React.ReactNode;
  onRemove?: () => void;
  isEditing?: boolean;
  className?: string;
  contentClassName?: string;
  action?: React.ReactNode;
}

export const WidgetBase: React.FC<WidgetBaseProps> = ({ 
  title, size, children, onRemove, isEditing, className = '', contentClassName = 'p-4', action 
}) => {
  
  return (
    <div className={`
      relative bg-white dark:bg-slate-900 border rounded-xl shadow-sm flex flex-col h-full overflow-hidden
      ${getWidgetSizeClass(size)} 
      ${isEditing 
        ? 'border-dashed border-2 border-slate-300 dark:border-slate-700 cursor-move hover:bg-slate-50 dark:hover:bg-slate-800/50' 
        : 'border-slate-200 dark:border-slate-800 transition-shadow hover:shadow-md'
      } 
      ${className}
    `}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0 ${isEditing ? 'bg-slate-50/50 dark:bg-slate-800/50' : ''}`}>
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide truncate flex items-center gap-2">
          {isEditing && <Move className="w-3.5 h-3.5 text-slate-400" />}
          {title}
        </h3>
        
        <div className="flex items-center gap-2">
          {!isEditing && action}
          {isEditing && onRemove && (
            <button 
              onClick={onRemove}
              className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {!isEditing && (
            <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className={`flex-1 overflow-y-auto custom-scrollbar min-h-[120px] ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
};
