
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../../components/UI/Modal';
import { Building, MapPin, Globe, CreditCard, Mail, ShieldCheck, Check, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { DEFAULT_FEATURES } from '../../constants';
import { useTranslation } from 'react-i18next';

interface CreateClientWizardProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CreateClientWizard: React.FC<CreateClientWizardProps> = ({ isOpen, onClose }) => {
    const { createClient } = useApp();
    const { t } = useTranslation();
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        code: '',
        country: 'USA',
        timezone: 'UTC',
        currency: 'USD',
        language: 'en-US',
        adminEmail: '',
    });

    const updateField = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleNext = () => {
        if (step < 3) setStep(prev => prev + 1);
        else handleSubmit();
    };

    const handleBack = () => setStep(prev => prev - 1);

    const handleSubmit = async () => {
        setIsLoading(true);
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        await createClient({
            name: formData.name,
            code: formData.code,
            country: formData.country,
            timezone: formData.timezone,
            currency: formData.currency,
            features: DEFAULT_FEATURES
        }, formData.adminEmail);

        setIsLoading(false);
        onClose();
        setStep(1); // Reset
    };

    // --- STEP COMPONENTS ---

    const StepIdentity = () => (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t('admin.client_name', 'Client Name')}</label>
                <input
                    autoFocus
                    type="text"
                    value={formData.name}
                    onChange={e => updateField('name', e.target.value)}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Acme Corporation"
                />
            </div>
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t('admin.tenant_code', 'Tenant Code / Subdomain')}</label>
                <div className="flex items-center">
                    <input
                        type="text"
                        value={formData.code}
                        onChange={e => updateField('code', e.target.value.toLowerCase().replace(/\s/g, '-'))}
                        className="flex-1 p-2.5 border border-slate-200 dark:border-slate-700 rounded-l-lg bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        placeholder="acme-corp"
                    />
                    <div className="px-3 py-2.5 bg-slate-100 dark:bg-slate-800 border border-l-0 border-slate-200 dark:border-slate-700 rounded-r-lg text-slate-500 text-sm">
                        .nexuserp.io
                    </div>
                </div>
                <p className="text-[10px] text-slate-400">{t('admin.tenant_code_hint', 'Unique identifier for system routing.')}</p>
            </div>
        </div>
    );

    const StepRegional = () => (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t('admin.country', 'Country')}</label>
                    <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select
                            value={formData.country}
                            onChange={e => updateField('country', e.target.value)}
                            className="w-full pl-10 p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="USA">United States</option>
                            <option value="GBR">United Kingdom</option>
                            <option value="DEU">Germany</option>
                            <option value="SGP">Singapore</option>
                        </select>
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t('admin.timezone', 'Timezone')}</label>
                    <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select
                            value={formData.timezone}
                            onChange={e => updateField('timezone', e.target.value)}
                            className="w-full pl-10 p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="UTC">UTC (GMT+0)</option>
                            <option value="EST">EST (UTC-5)</option>
                            <option value="PST">PST (UTC-8)</option>
                            <option value="CET">CET (UTC+1)</option>
                        </select>
                    </div>
                </div>
            </div>
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t('admin.currency', 'Base Currency')}</label>
                <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select
                        value={formData.currency}
                        onChange={e => updateField('currency', e.target.value)}
                        className="w-full pl-10 p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                    </select>
                </div>
            </div>
        </div>
    );

    const StepAdmin = () => (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-lg flex gap-3">
                <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                    <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100">{t('admin.plan_assignment', 'Plan Assignment')}</h4>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">{t('admin.plan_desc', 'Defaulting to Enterprise Trial. Quotas: 50 Users, 10GB Storage.')}</p>
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t('admin.admin_email', 'Client Admin Email')}</label>
                <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="email"
                        value={formData.adminEmail}
                        onChange={e => updateField('adminEmail', e.target.value)}
                        className="w-full pl-10 p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="admin@client-domain.com"
                    />
                </div>
                <p className="text-[10px] text-slate-400">{t('admin.invite_hint', 'An invitation will be sent to this user to set up their password.')}</p>
            </div>
        </div>
    );

    const isStepValid = () => {
        if (step === 1) return formData.name.length > 2 && formData.code.length > 2;
        if (step === 2) return true; // Defaults set
        if (step === 3) return formData.adminEmail.includes('@');
        return false;
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('admin.provision_new_tenant', 'Provision New Tenant')}>
            <div className="flex flex-col h-[400px]">
                {/* Stepper */}
                <div className="flex items-center justify-between mb-8 px-8">
                    {[1, 2, 3].map(s => (
                        <div key={s} className="flex items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${s === step ? 'bg-blue-600 text-white' :
                                    s < step ? 'bg-emerald-500 text-white' :
                                        'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                }`}>
                                {s < step ? <Check className="w-4 h-4" /> : s}
                            </div>
                            {s < 3 && <div className={`w-16 h-0.5 mx-2 ${s < step ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}></div>}
                        </div>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto px-1">
                    {step === 1 && <StepIdentity />}
                    {step === 2 && <StepRegional />}
                    {step === 3 && <StepAdmin />}
                </div>

                <div className="pt-6 mt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between">
                    <button
                        onClick={handleBack}
                        disabled={step === 1 || isLoading}
                        className="flex items-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" /> {t('common.back', 'Back')}
                    </button>
                    <button
                        onClick={handleNext}
                        disabled={!isStepValid() || isLoading}
                        className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                            <>
                                {step === 3 ? t('admin.provision_client', 'Provision Client') : t('common.next_step', 'Next Step')}
                                {step !== 3 && <ArrowRight className="w-4 h-4 ml-2" />}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
};
