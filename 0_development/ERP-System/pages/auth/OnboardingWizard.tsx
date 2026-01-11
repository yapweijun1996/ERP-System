
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle, ArrowRight, ArrowLeft, Loader2, Rocket } from 'lucide-react';
import { StepCompanyBasics, StepModules, StepTeam } from '../../components/Onboarding/WizardSteps';
import { DEFAULT_FEATURES, MOCK_RUNNING_NUMBERS } from '../../constants';

export const OnboardingWizard: React.FC = () => {
  const { currentUser, activeClient, logout } = useApp();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form Data State
  const [formData, setFormData] = useState({
      company: {
          name: activeClient?.name || '',
          regId: '',
          address: '',
          currency: 'USD',
          timezone: 'UTC',
      },
      config: {
          fiscalYearEnd: '12-31',
          autoNumbering: true,
          seedData: true,
      },
      features: { ...DEFAULT_FEATURES },
      invites: [] as {email: string, role: string}[],
  });

  const updateCompany = (data: any) => setFormData(prev => ({ ...prev, company: data }));
  const updateFeatures = (features: any) => setFormData(prev => ({ ...prev, features }));
  
  const addInvite = (email: string, role: string) => 
    setFormData(prev => ({ ...prev, invites: [...prev.invites, { email, role }] }));
  
  const removeInvite = (idx: number) => 
    setFormData(prev => ({ ...prev, invites: prev.invites.filter((_, i) => i !== idx) }));

  const nextStep = () => setStep(prev => prev + 1);
  const prevStep = () => setStep(prev => prev - 1);

  const handleFinish = async () => {
    setLoading(true);
    try {
        const params = new URLSearchParams(window.location.search);
        const company = params.get('company')?.trim();
        if (!company) throw new Error('缺少 company 参数（例如 ?company=vantajas）');

        const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:6601';
        const token = localStorage.getItem('auth_token');
        if (!token) throw new Error('未登录（缺少 auth_token）');

        const res = await fetch(
            `${API_URL}/api/setup/complete-onboarding?company=${encodeURIComponent(company)}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name: formData.company.name,
                    currency: formData.company.currency,
                    timezone: formData.company.timezone,
                    country: 'USA',
                    features: formData.features,
                }),
            },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data?.message || data?.error || 'Go Live 失败');
        }

        window.location.reload();
    } catch (e) {
        console.error('Complete onboarding failed:', e);
        alert(e instanceof Error ? e.message : 'Go Live 失败');
        setLoading(false);
    }
  };

  // Steps Configuration
  const steps = [
      { id: 1, label: 'Entity', desc: 'Company Profile' },
      { id: 2, label: 'Modules', desc: 'Enable Features' },
      { id: 3, label: 'Team', desc: 'Invite Users' },
      { id: 4, label: 'Review', desc: 'Go Live' },
  ];
  const progressPct = ((step - 1) / (steps.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        
        {/* Progress Header */}
        <div className="w-full max-w-4xl mb-8">
            <div className="flex justify-between items-center mb-6">
                <div className="font-bold text-xl text-slate-800 dark:text-white flex items-center gap-2">
                    <Rocket className="w-6 h-6 text-blue-600" /> Nexus Onboarding
                </div>
                <button onClick={logout} className="text-sm text-slate-500 hover:text-red-500">Cancel & Logout</button>
            </div>
            
	            {/* Stepper (不可跳步) */}
	            <div className="relative">
	                {/* Dots row */}
	                <div className="relative flex items-center justify-between px-5">
	                    {/* Track */}
	                    <div className="absolute inset-x-5 top-1/2 h-1 -translate-y-1/2 bg-slate-200 dark:bg-slate-800 rounded-full z-0"></div>
	                    {/* Progress */}
	                    <div className="absolute inset-x-5 top-1/2 h-1 -translate-y-1/2 z-0">
	                        <div
	                            className="h-1 bg-blue-600 rounded-full transition-[width] duration-500 ease-out"
	                            style={{ width: `${progressPct}%` }}
	                        />
	                    </div>
	
	                    {steps.map((s) => {
	                        const isActive = s.id === step;
	                        const isCompleted = s.id < step;
	                        return (
	                            <div key={s.id} className="relative z-10">
	                                <div
	                                    className={[
	                                        'w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors',
	                                        isCompleted ? 'bg-blue-600 text-white' : '',
	                                        isActive ? 'bg-white dark:bg-slate-900 border-2 border-blue-600 text-blue-600' : '',
	                                        !isActive && !isCompleted
	                                            ? 'bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 text-slate-400'
	                                            : '',
	                                    ].join(' ')}
	                                    aria-current={isActive ? 'step' : undefined}
	                                >
	                                    {isCompleted ? <CheckCircle className="w-6 h-6" /> : s.id}
	                                </div>
	                            </div>
	                        );
	                    })}
	                </div>
	
	                {/* Labels row */}
	                <div className="mt-3 flex justify-between px-5">
	                    {steps.map((s) => {
	                        const isActive = s.id === step;
	                        const isCompleted = s.id < step;
	                        return (
	                            <div key={s.id} className="w-10 text-center hidden sm:block">
	                                <p
	                                    className={[
	                                        'text-xs font-bold',
	                                        isActive ? 'text-blue-600' : '',
	                                        isCompleted ? 'text-slate-600 dark:text-slate-300' : '',
	                                        !isActive && !isCompleted ? 'text-slate-400' : '',
	                                    ].join(' ')}
	                                >
	                                    {s.label}
	                                </p>
	                            </div>
	                        );
	                    })}
	                </div>
	            </div>
	        </div>

        {/* Content Card */}
        <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 min-h-[400px] flex flex-col justify-between">
            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{steps[step-1].desc}</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">Step {step} of {steps.length}</p>
                
                {step === 1 && <StepCompanyBasics data={formData.company} onChange={updateCompany} />}
                {step === 2 && <StepModules features={formData.features} onChange={updateFeatures} />}
                {step === 3 && <StepTeam invites={formData.invites} onAdd={addInvite} onRemove={removeInvite} />}
                {step === 4 && (
                    <div className="space-y-6 text-center py-8">
                        <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 mb-6">
                            <Rocket className="w-10 h-10" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Ready for Launch!</h3>
                        <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                            You are about to create the workspace for <span className="font-bold text-slate-800 dark:text-slate-200">{formData.company.name}</span> with {formData.invites.length} team members invited.
                        </p>
                        
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg text-left max-w-sm mx-auto space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Base Currency</span>
                                <span className="font-medium dark:text-white">{formData.company.currency}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Modules Enabled</span>
                                <span className="font-medium dark:text-white">{Object.values(formData.features).filter(Boolean).length}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex justify-between mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                {step > 1 ? (
                    <button 
                        onClick={prevStep}
                        disabled={loading}
                        className="flex items-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </button>
                ) : (
                    <div></div> // Spacer
                )}
                
                {step < 4 ? (
                    <button 
                        onClick={nextStep}
                        className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition flex items-center"
                    >
                        Next Step <ArrowRight className="w-4 h-4 ml-2" />
                    </button>
                ) : (
                    <button 
                        onClick={handleFinish}
                        disabled={loading}
                        className="bg-emerald-600 text-white px-8 py-2.5 rounded-lg font-bold hover:bg-emerald-700 transition flex items-center shadow-lg shadow-emerald-500/30"
                    >
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Rocket className="w-4 h-4 mr-2" />}
                        {loading ? 'Setting up Environment...' : 'Go Live'}
                    </button>
                )}
            </div>
        </div>
    </div>
  );
};
