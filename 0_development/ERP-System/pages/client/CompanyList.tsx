import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Company } from '../../types';
import { companiesApi } from '../../api/companies';
import { Building2, Plus, MoreHorizontal, Loader } from 'lucide-react';
import { StatusBadge } from '../../components/UI/StatusBadge';

export const CompanyList: React.FC = () => {
  const { currentClient, navigateToCompany, addToast } = useApp();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Load companies
  useEffect(() => {
    const fetchCompanies = async () => {
      if (!currentClient?.id) return;
      try {
        setIsLoading(true);
        const data = await companiesApi.list(currentClient.id);
        setCompanies(data);
      } catch (error) {
        console.error("Failed to load companies", error);
        addToast('error', 'Error', 'Failed to load companies');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCompanies();
  }, [currentClient?.id, addToast]);

  const handleManage = (companyId: string) => {
    navigateToCompany(companyId);
    addToast('success', 'Workspace Switched', 'You are now managing this company');
  };

  const handleCreateMock = async () => {
    if (!currentClient?.id) return;
    const name = prompt("Enter Company Name:");
    if (!name) return;

    try {
      setIsCreating(true);
      const newComp = await companiesApi.create({
        tenantId: currentClient.id,
        name,
        currency: 'USD',
        country: 'US',
        features: { SALES: true, FINANCE: true, INVENTORY: true, HR: true }
      });
      setCompanies(prev => [...prev, newComp]);
      addToast('success', 'Company Created', `${name} has been added.`);
    } catch (e) {
      addToast('error', 'Creation Failed');
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) return <div className="p-10 text-center"><Loader className="animate-spin w-8 h-8 mx-auto text-blue-500" /></div>;

  return (
    <div className="space-y-6 pb-20 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Companies</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Manage business entities for {currentClient?.name}</p>
        </div>
        <button
          onClick={handleCreateMock}
          disabled={isCreating}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
        >
          {isCreating ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          <span>Add Company</span>
        </button>
      </div>

      <div className="grid gap-4">
        {companies.map(comp => (
          <div key={comp.id} className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-6">
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Building2 className="w-8 h-8" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{comp.name}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">ID: {comp.id} • Currency: {comp.currency}</p>
              <div className="flex items-center justify-center md:justify-start gap-2 mt-2">
                <StatusBadge status="Active" />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleManage(comp.id)}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                Manage
              </button>
              <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
        {companies.length === 0 && (
          <div className="text-center py-10 text-slate-500">
            No companies found. Create one to get started.
          </div>
        )}
      </div>
    </div>
  );
};
