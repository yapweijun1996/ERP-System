
import React, { useState } from 'react';
import { ArrowLeft, Clock, Paperclip, MessageSquare, MoreHorizontal, Calendar, User } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { TimelineEvent, RelatedDoc } from '../../types';

interface DetailLayoutProps {
  title: string;
  id: string;
  status: string;
  onBack: () => void;
  actions: React.ReactNode;
  mainContent: React.ReactNode;
  timeline: TimelineEvent[];
  relatedDocs?: RelatedDoc[];
}

export const DetailLayout: React.FC<DetailLayoutProps> = ({
  title, id, status, onBack, actions, mainContent, timeline, relatedDocs
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'timeline'>('details');

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 transition-colors">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-30 transition-colors shadow-sm">
        <div className="flex items-center space-x-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h1>
              <StatusBadge status={status} />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-mono mt-0.5">{id}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {actions}
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden md:block"></div>
          <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mobile Tabs */}
      <div className="lg:hidden flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-[73px] z-20">
        <button 
          className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'details' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
          onClick={() => setActiveTab('details')}
        >
          Details
        </button>
        <button 
          className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'timeline' ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
          onClick={() => setActiveTab('timeline')}
        >
          Activity & Docs
        </button>
      </div>

      {/* Content Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 md:p-8">
          
          {/* Main Column (Details) */}
          <div className={`lg:col-span-8 space-y-6 ${activeTab === 'timeline' ? 'hidden lg:block' : ''}`}>
             {mainContent}
          </div>

          {/* Side Panel (Timeline/Docs) */}
          <div className={`lg:col-span-4 space-y-6 ${activeTab === 'details' ? 'hidden lg:block' : ''}`}>
            
            {/* Related Docs Widget */}
            {relatedDocs && relatedDocs.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-semibold text-slate-700 dark:text-slate-300 text-sm">
                  Related Documents
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {relatedDocs.map((doc, idx) => (
                    <div key={idx} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer flex justify-between items-center group transition-colors">
                      <div className="flex items-center gap-3">
                         <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                             <Paperclip className="w-4 h-4" />
                         </div>
                         <div>
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{doc.id}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{doc.type}</p>
                         </div>
                      </div>
                      <StatusBadge status={doc.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline Widget */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors flex flex-col max-h-[600px]">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-semibold text-slate-700 dark:text-slate-300 text-sm flex justify-between items-center">
                <span>Activity Timeline</span>
                <Clock className="w-4 h-4 text-slate-400" />
              </div>
              
              <div className="p-5 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                {timeline.map((event, idx) => (
                  <div key={idx} className="relative pl-6 border-l-2 border-slate-100 dark:border-slate-800 last:border-0 pb-1 group">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 group-hover:border-blue-500 transition-colors"></div>
                    <div className="flex justify-between items-start">
                        <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">
                           {event.action}
                        </p>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">{event.date.split(',')[0]}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1 mb-2">
                        <User className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-500 dark:text-slate-400">{event.user}</span>
                    </div>

                    {event.description && (
                        <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700">
                            {event.description}
                        </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Comment Input */}
              <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                 <div className="relative">
                    <input 
                        type="text" 
                        placeholder="Add a comment or note..." 
                        className="w-full pl-3 pr-10 py-2.5 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                    />
                    <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors">
                        <MessageSquare className="w-4 h-4" />
                    </button>
                 </div>
              </div>
            </div>

            {/* Upload Area */}
             <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors border-dashed hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer group">
                <div className="p-6 flex flex-col items-center justify-center text-center">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-full mb-3 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                        <Paperclip className="w-5 h-5 text-slate-400 group-hover:text-blue-500" />
                    </div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Upload Attachments</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Drag files here or click to browse</p>
                </div>
             </div>

          </div>
        </div>
      </div>
    </div>
  );
};
