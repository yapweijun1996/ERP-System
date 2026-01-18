import React from 'react';
import { FileQuestion, ArrowLeft, Home } from 'lucide-react';

interface NotFoundProps {
    onNavigate: (page: string) => void;
}

export const NotFound: React.FC<NotFoundProps> = ({ onNavigate }) => {
    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-full mb-8 shadow-sm border border-slate-100 dark:border-slate-800">
                <FileQuestion className="w-16 h-16 text-slate-400 dark:text-slate-500" />
            </div>

            <h1 className="text-8xl font-bold text-slate-900 dark:text-slate-100 tracking-tighter mb-4">
                404
            </h1>

            <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-4">
                Page Not Found
            </h2>

            <p className="text-slate-500 dark:text-slate-400 max-w-md mb-10 text-lg leading-relaxed">
                The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
            </p>
        </div>
    );
};
