
import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  enablePagination?: boolean;
  defaultPageSize?: number;
}

export const DataTable = <T extends { id: string }>({ 
  data, 
  columns, 
  onRowClick, 
  isLoading, 
  emptyMessage = "No records found.",
  enablePagination = true,
  defaultPageSize = 10
}: DataTableProps<T>) => {
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const totalPages = Math.ceil(data.length / pageSize);

  // Reset page if data length changes drastically
  useMemo(() => {
    if (currentPage > totalPages && totalPages > 0) {
        setCurrentPage(1);
    }
  }, [data.length, totalPages, currentPage]);

  const paginatedData = useMemo(() => {
    if (!enablePagination) return data;
    const start = (currentPage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, currentPage, pageSize, enablePagination]);

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading data...</div>;
  }

  return (
    <div className="flex flex-col h-full w-full">
      {/* Scroll container for the table body */}
      <div className="flex-1 overflow-auto custom-scrollbar relative">
        <table className="w-full text-left text-sm">
          {/* Sticky Header */}
          <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 shadow-sm">
            <tr>
              {columns.map((col, idx) => (
                <th 
                  key={idx} 
                  className={`px-6 py-3 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap bg-slate-50 dark:bg-slate-800 ${col.headerClassName || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row) => (
                <tr 
                  key={row.id} 
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`transition-colors ${onRowClick ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer' : ''}`}
                >
                  {columns.map((col, idx) => (
                    <td key={idx} className={`px-6 py-3 ${col.className || ''}`}>
                      {col.cell 
                        ? col.cell(row) 
                        : (col.accessorKey ? String(row[col.accessorKey]) : '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {enablePagination && data.length > 0 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
            <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, data.length)} of {data.length} entries
            </div>
            
            <div className="flex items-center gap-2">
                <select 
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                    className="text-xs border border-slate-200 dark:border-slate-700 rounded bg-transparent p-1 mr-2 outline-none focus:ring-1 focus:ring-blue-500"
                >
                    <option value={10}>10 / page</option>
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                </select>

                <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <button 
                        onClick={() => setCurrentPage(1)} 
                        disabled={currentPage === 1}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed border-r border-slate-200 dark:border-slate-700"
                    >
                        <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                        disabled={currentPage === 1}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed border-r border-slate-200 dark:border-slate-700"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 text-xs font-medium min-w-[3rem] text-center">
                        {currentPage} / {totalPages}
                    </span>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                        disabled={currentPage === totalPages}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed border-l border-slate-200 dark:border-slate-700"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => setCurrentPage(totalPages)} 
                        disabled={currentPage === totalPages}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed border-l border-slate-200 dark:border-slate-700"
                    >
                        <ChevronsRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
