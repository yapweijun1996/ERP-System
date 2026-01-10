
import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBackOnline, setShowBackOnline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowBackOnline(true);
      setTimeout(() => setShowBackOnline(false), 3000);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="fixed bottom-4 left-4 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div className="bg-slate-900 dark:bg-slate-800 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 border border-slate-700">
          <WifiOff className="w-5 h-5 text-red-400" />
          <div className="text-sm font-medium">
            You are currently offline.
            <span className="block text-xs text-slate-400 font-normal">Changes will save locally.</span>
          </div>
        </div>
      </div>
    );
  }

  if (showBackOnline) {
    return (
      <div className="fixed bottom-4 left-4 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div className="bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
          <Wifi className="w-5 h-5" />
          <div className="text-sm font-medium">Back online</div>
        </div>
      </div>
    );
  }

  return null;
};
