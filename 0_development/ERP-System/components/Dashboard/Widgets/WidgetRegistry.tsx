
import React from 'react';
import { useApp } from '../../../context/AppContext';
import { WidgetBase } from '../WidgetBase';
import { TaskItem, AlertItem, ActionButton, ActivityItem } from '../WorkCenterWidgets';
import { CheckSquare, ShoppingCart, Package, LifeBuoy, DollarSign } from 'lucide-react';
import { WidgetSize } from '../../../types';

interface WidgetProps {
  config: any;
  size: WidgetSize;
  isEditing?: boolean;
  onRemove?: () => void;
}

// --- WIDGET IMPLEMENTATIONS ---

const KPISnapshot: React.FC<WidgetProps & { icon: any, value: string, trend: string, color: string }> = ({ config, size, isEditing, onRemove, icon: Icon, value, trend, color }) => (
  <WidgetBase title={config.title} size={size} isEditing={isEditing} onRemove={onRemove} contentClassName="p-5">
    <div className="flex items-center justify-between h-full">
      <div>
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{value}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{trend}</p>
      </div>
      <div className={`p-3 rounded-xl ${color} bg-opacity-10 dark:bg-opacity-20`}>
        <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
      </div>
    </div>
  </WidgetBase>
);

const TaskListWidget: React.FC<WidgetProps> = ({ config, size, isEditing, onRemove }) => {
  const { notifications } = useApp();
  const tasks = notifications.filter(n => n.category === 'TASK' && n.status === 'UNREAD').slice(0, config.limit || 5);

  return (
    <WidgetBase title={config.title} size={size} isEditing={isEditing} onRemove={onRemove} contentClassName="p-0">
      <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
        {tasks.length === 0 && <div className="text-center text-slate-400 text-sm py-6">No pending tasks.</div>}
        {tasks.map(t => (
          <div key={t.id} className="p-3">
            <TaskItem 
              title={t.title} 
              priority={t.priority === 'CRITICAL' ? 'HIGH' : t.priority === 'HIGH' ? 'MEDIUM' : 'LOW'}
              icon={CheckSquare}
              onClick={() => {}} 
            />
          </div>
        ))}
      </div>
    </WidgetBase>
  );
};

const ExceptionListWidget: React.FC<WidgetProps> = ({ config, size, isEditing, onRemove }) => {
  const { inventory } = useApp();
  const lowStock = inventory.filter(i => i.stock < 50).slice(0, 3);

  return (
    <WidgetBase title={config.title} size={size} isEditing={isEditing} onRemove={onRemove} contentClassName="p-3">
      <div className="space-y-2">
        {lowStock.length === 0 && <div className="text-center text-slate-400 text-sm py-6">System Healthy.</div>}
        {lowStock.map(item => (
          <AlertItem 
            key={item.id} 
            title="Low Stock Warning" 
            message={`${item.name} (${item.sku}) is below threshold.`} 
            severity="WARNING" 
            onClick={() => {}} 
          />
        ))}
      </div>
    </WidgetBase>
  );
};

const ShortcutsWidget: React.FC<WidgetProps> = ({ config, size, isEditing, onRemove }) => (
  <WidgetBase title={config.title} size={size} isEditing={isEditing} onRemove={onRemove} contentClassName="p-3">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 h-full">
       <ActionButton label="New Order" icon={ShoppingCart} colorClass="bg-blue-500" onClick={()=>{}} />
       <ActionButton label="Stock Adjust" icon={Package} colorClass="bg-amber-500" onClick={()=>{}} />
       <ActionButton label="Raise Ticket" icon={LifeBuoy} colorClass="bg-pink-500" onClick={()=>{}} />
       <ActionButton label="Create PO" icon={DollarSign} colorClass="bg-emerald-500" onClick={()=>{}} />
    </div>
  </WidgetBase>
);

const RecentActivityWidget: React.FC<WidgetProps> = ({ config, size, isEditing, onRemove }) => {
  const { salesDocuments } = useApp();
  const activities = salesDocuments.slice(-5).reverse();

  return (
    <WidgetBase title={config.title} size={size} isEditing={isEditing} onRemove={onRemove} contentClassName="p-0">
      <div className="px-4">
        {activities.map(doc => (
           <ActivityItem 
             key={doc.id}
             user={doc.salesExec}
             action={doc.status === 'Draft' ? 'created draft' : 'posted'}
             target={`${doc.type} ${doc.id}`}
             time="Today"
           />
        ))}
      </div>
    </WidgetBase>
  );
};

// --- REGISTRY MAPPING ---

export const renderWidget = (defId: string, props: WidgetProps) => {
  switch (defId) {
    case 'kpi-revenue': return <KPISnapshot {...props} icon={DollarSign} value="$42,500" trend="+12% vs last month" color="bg-emerald-600" />;
    case 'kpi-orders': return <KPISnapshot {...props} icon={ShoppingCart} value="14" trend="Pending Processing" color="bg-blue-600" />;
    case 'kpi-stock-value': return <KPISnapshot {...props} icon={Package} value="$1.2M" trend="Total Valuation" color="bg-indigo-600" />;
    case 'list-tasks': return <TaskListWidget {...props} />;
    case 'list-exceptions': return <ExceptionListWidget {...props} />;
    case 'list-recent-sales': return <RecentActivityWidget {...props} />;
    case 'shortcuts-general': return <ShortcutsWidget {...props} />;
    default: return <WidgetBase {...props} title="Unknown Widget"><div className="text-red-500 p-4">Widget definition not found: {defId}</div></WidgetBase>;
  }
};
