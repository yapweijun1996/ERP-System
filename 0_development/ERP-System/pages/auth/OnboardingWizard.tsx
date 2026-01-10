
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle, ArrowRight, ArrowLeft, Loader2, Rocket } from 'lucide-react';
import { StepCompanyBasics, StepModules, StepTeam } from '../../components/Onboarding/WizardSteps';
import { DEFAULT_FEATURES, MOCK_RUNNING_NUMBERS } from '../../constants';

export const OnboardingWizard: React.FC = () => {
  const { currentUser, activeClient, completeOnboarding, logout } = useApp();
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
    // Simulate Processing
    setTimeout(() => {
        if (activeClient) {
            completeOnboarding(activeClient.id, {
                name: formData.company.name,
                currency: formData.company.currency,
                timezone: formData.company.timezone,
                country: 'USA', // Simplified for demo
                features: formData.features
            });
        }
        setLoading(false);
    }, 1500);
  };

  // Steps Configuration
  const steps = [
      { id: 1, label: 'Entity', desc: 'Company Profile' },
      { id: 2, label: 'Modules', desc: 'Enable Features' },
      { id: 3, label: 'Team', desc: 'Invite Users' },
      { id: 4, label: 'Review', desc: 'Go Live' },
  ];

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
            
            {/* Stepper */}
            <div className="flex items-center justify-between relative">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 dark:bg-slate-800 -z-0"></div>
                <div className="absolute top-1/2 left-0 h-1 bg-blue-600 transition-all duration-500 -z-0" style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}></div>
                
                {steps.map((s) => {
                    const isActive = s.id === step;
                    const isCompleted = s.id < step;
                    return (
                        <div key={s.id} className="relative z-10 flex flex-col items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                                isCompleted ? 'bg-blue-600 text-white' : 
                                isActive ? 'bg-white dark:bg-slate-900 border-2 border-blue-600 text-blue-600' : 
                                'bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 text-slate-400'
                            }`}>
                                {isCompleted ? <CheckCircle className="w-6 h-6" /> : s.id}
                            </div>
                            <div className="mt-2 text-center hidden sm:block">
                                <p className={`text-xs font-bold ${isActive ? 'text-blue-600' : 'text-slate-500'}`}>{s.label}</p>
                            </div>
                        </div>
                    );
                })}
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
