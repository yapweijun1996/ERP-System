import React from 'react';
import { LucideIcon } from 'lucide-react';

interface LoginInputProps {
    id: string;
    type: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    label: string;
    icon: LucideIcon;
    placeholder?: string;
    error?: boolean;
    rightElement?: React.ReactNode;
}

export const LoginInput: React.FC<LoginInputProps> = ({
    id, type, value, onChange, label, icon: Icon, placeholder, error, rightElement
}) => (
    <div className="space-y-1.5">
        <label htmlFor={id} className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
            {label}
        </label>
        <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Icon className={`h-5 w-5 transition-colors ${error ? 'text-red-400' : 'text-slate-400 group-focus-within:text-blue-500'}`} />
            </div>
            <input
                id={id}
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className={`
            block w-full pl-11 pr-3 py-3 
            bg-slate-50 dark:bg-slate-950 
            border rounded-xl text-sm font-medium
            text-slate-900 dark:text-white placeholder-slate-400
            transition-all duration-200 outline-none
            ${error
                        ? 'border-red-300 focus:ring-2 focus:ring-red-500/20 focus:border-red-500'
                        : 'border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900'
                    }
          `}
            />
            {rightElement && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    {rightElement}
                </div>
            )}
        </div>
    </div>
);
