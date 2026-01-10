
import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { DashboardWidget, WidgetDefinition } from '../../types';
import { renderWidget } from '../../components/Dashboard/Widgets/WidgetRegistry';
import { getWidgetSizeClass } from '../../components/Dashboard/WidgetBase';
import { Save, RotateCcw, Plus, Grid } from 'lucide-react';
import { Modal } from '../../components/UI/Modal';

export const DashboardCustomize: React.FC = () => {
  const { dashboard, addToast } = useApp();
  const [layoutWidgets, setLayoutWidgets] = useState<DashboardWidget[]>(dashboard.layout.widgets);
  const [isLibraryOpen, setLibraryOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const dragItem = useRef<string | null>(null);
  const dragOverItem = useRef<string | null>(null);

  const handleSave = () => {
    // Ensure order is correct before saving
    const ordered = layoutWidgets.map((w, i) => ({ ...w, order: i }));
    dashboard.updateLayout(ordered);
    addToast('Dashboard Saved', 'Your personalized layout has been updated.', 'success');
  };

  const handleReset = () => {
    if (window.confirm("Reset to company defaults?")) {
        dashboard.resetLayout();
        window.location.reload(); 
    }
  };

  const addWidget = (def: WidgetDefinition) => {
    const newWidget: DashboardWidget = {
      id: `w-${Date.now()}`,
      definitionId: def.id,
      size: def.defaultSize,
      order: layoutWidgets.length,
      config: { ...def.defaultConfig }
    };
    setLayoutWidgets([...layoutWidgets, newWidget]);
    setLibraryOpen(false);
  };

  const removeWidget = (id: string) => {
    setLayoutWidgets(prev => prev.filter(w => w.id !== id));
  };

  const changeSize = (id: string) => {
      setLayoutWidgets(prev => prev.map(w => {
          if (w.id !== id) return w;
          const def = dashboard.availableWidgets.find(d => d.id === w.definitionId);
          if (!def) return w;
          
          const sizes = def.allowedSizes;
          const currentIdx = sizes.indexOf(w.size);
          const nextSize = sizes[(currentIdx + 1) % sizes.length];
          return { ...w, size: nextSize };
      }));
  };

  // --- Drag and Drop Logic ---

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    dragItem.current = id;
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Ghost image handling - make it a bit transparent
    const el = e.currentTarget;
    setTimeout(() => {
        el.style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.style.opacity = '1';
    setDraggedId(null);
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    dragOverItem.current = targetId;

    if (!dragItem.current || dragItem.current === targetId) return;

    const newWidgets = [...layoutWidgets];
    const dragIndex = newWidgets.findIndex(w => w.id === dragItem.current);
    const hoverIndex = newWidgets.findIndex(w => w.id === targetId);

    if (dragIndex === -1 || hoverIndex === -1) return;

    // Swap/Reorder
    const [draggedWidget] = newWidgets.splice(dragIndex, 1);
    newWidgets.splice(hoverIndex, 0, draggedWidget);

    setLayoutWidgets(newWidgets);
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault(); // Necessary to allow dropping
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      
      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 py-4 flex justify-between items-center shadow-sm z-20">
        <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Customize Dashboard</h1>
            <p className="text-sm text-slate-500">Drag items to reorder. Configure widgets.</p>
        </div>
        <div className="flex gap-2 sm:gap-3">
            <button onClick={handleReset} className="hidden sm:flex items-center px-4 py-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-lg text-sm font-medium transition">
                <RotateCcw className="w-4 h-4 mr-2" /> Reset
            </button>
            <button onClick={() => setLibraryOpen(true)} className="flex items-center px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-lg text-sm font-medium transition border border-transparent dark:border-slate-700">
                <Plus className="w-4 h-4 mr-2" /> Add Widget
            </button>
            <button onClick={handleSave} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition shadow-sm">
                <Save className="w-4 h-4 mr-2" /> Save Layout
            </button>
        </div>
      </div>

      {/* Editor Canvas */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 custom-scrollbar">
        <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 grid-flow-row-dense pb-20">
            {layoutWidgets.length === 0 && (
                <div className="col-span-4 py-20 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400">
                    Your dashboard is empty. Click "Add Widget" to start.
                </div>
            )}
            {layoutWidgets.map((widget, index) => (
                <div 
                    key={widget.id} 
                    className={`contents group relative ${draggedId === widget.id ? 'opacity-0' : ''}`} // Hide the original position visually while dragging ghost takes over
                >
                    <div 
                        className={`${getWidgetSizeClass(widget.size)} relative h-full transition-transform duration-200`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, widget.id)}
                        onDragEnter={(e) => handleDragEnter(e, widget.id)}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOver}
                    >
                        {/* Widget Content */}
                        {renderWidget(widget.definitionId, { 
                            config: widget.config, 
                            size: widget.size, 
                            isEditing: true, 
                            onRemove: () => removeWidget(widget.id)
                        })}
                        
                        {/* Overlay Controls */}
                        <div className="absolute top-3 right-14 flex gap-1 bg-white dark:bg-slate-800 shadow-sm rounded border border-slate-200 dark:border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <div className="flex items-center px-2 border-r border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-400 cursor-move">
                                DRAG
                            </div>
                            <button onClick={() => changeSize(widget.id)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500" title="Resize"><Grid className="w-3.5 h-3.5" /></button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* Widget Library Modal */}
      <Modal isOpen={isLibraryOpen} onClose={() => setLibraryOpen(false)} title="Add Widget" size="lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dashboard.availableWidgets.map(def => (
                  <button 
                    key={def.id} 
                    onClick={() => addWidget(def)}
                    className="flex flex-col items-start p-4 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 rounded-xl transition-all group"
                  >
                      <div className="flex justify-between w-full mb-1">
                          <span className="font-bold text-slate-800 dark:text-white">{def.name}</span>
                          <span className="text-[10px] uppercase font-bold text-slate-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">{def.type}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 text-left">{def.description}</p>
                  </button>
              ))}
          </div>
      </Modal>
    </div>
  );
};
