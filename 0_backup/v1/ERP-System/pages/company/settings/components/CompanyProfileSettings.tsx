
import React, { useState, useEffect } from 'react';
import { useApp } from '../../../../context/AppContext';
import { Save, Building, Globe, MapPin, Phone, Mail, Link as LinkIcon, AlertCircle, Info } from 'lucide-react';
import { Company, Address } from '../../../../types';

interface FormState {
    name: string;
    code: string;
    regId: string;
    currency: string;
    timezone: string;
    country: string;
    language: string;
    email: string;
    phone: string;
    website: string;
    address: Address;
}

export const CompanyProfileSettings: React.FC<{ onDirtyChange?: (isDirty: boolean) => void }> = ({ onDirtyChange }) => {
    const { activeCompany, updateCompany, addToast } = useApp();
    const [isDirty, setIsDirty] = useState(false);
    const [formData, setFormData] = useState<FormState>({
        name: '', code: '', regId: '',
        currency: '', timezone: '', country: '', language: '',
        email: '', phone: '', website: '',
        address: { street: '', city: '', state: '', zip: '', country: '' }
    });

    useEffect(() => {
        if (activeCompany) {
            setFormData({
                name: activeCompany.name || '',
                code: activeCompany.code || '',
                regId: activeCompany.regId || '',
                currency: activeCompany.currency || 'USD',
                timezone: activeCompany.timezone || '',
                country: activeCompany.country || '',
                language: activeCompany.language || 'en-US',
                email: activeCompany.email || '',
                phone: activeCompany.phone || '',
                website: activeCompany.website || '',
                address: {
                    street: activeCompany.address?.street || '',
                    city: activeCompany.address?.city || '',
                    state: activeCompany.address?.state || '',
                    zip: activeCompany.address?.zip || '',
                    country: activeCompany.address?.country || activeCompany.country || ''
                }
            });
            setIsDirty(false);
        }
    }, [activeCompany]);

    useEffect(() => {
        if (onDirtyChange) onDirtyChange(isDirty);
        
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty, onDirtyChange]);

    const handleChange = (field: keyof FormState | 'address', value: any, addressField?: keyof Address) => {
        setFormData(prev => {
            if (field === 'address' && addressField) {
                return { ...prev, address: { ...prev.address, [addressField]: value } };
            }
            return { ...prev, [field]: value };
        });
        setIsDirty(true);
    };

    const handleSave = () => {
        if (!activeCompany) return;
        
        if (!formData.name) { addToast('Validation Error', 'Company Name is required.', 'error'); return; }
        if (!formData.currency) { addToast('Validation Error', 'Base Currency is required.', 'error'); return; }

        const updatedCompany: Company = {
            ...activeCompany,
            ...formData,
            address: formData.address
        };

        updateCompany(updatedCompany);
        setIsDirty(false);
        addToast('Profile Saved', 'Company settings updated successfully.', 'success');
    };

    const inputClasses = "w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none";
    const labelClasses = "text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide";

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 pb-24">
            
            <div className={`sticky top-0 z-30 transition-transform duration-300 ${isDirty ? 'translate-y-0' : '-translate-y-full'}`}>
                <div className="bg-amber-50 dark:bg-amber-900 border-b border-amber-200 dark:border-amber-800 px-6 py-3 flex items-center justify-between shadow-sm">
                    <div className="flex items-center text-amber-800 dark:text-amber-100 text-sm font-medium">
                        <AlertCircle className="w-4 h-4 mr-2" />
                        You have unsaved changes.
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setIsDirty(false)} className="text-xs text-amber-700 dark:text-amber-300 hover:underline px-2">Discard</button>
                        <button onClick={handleSave} className="bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1.5 rounded font-medium transition-colors">Save Changes</button>
                    </div>
                </div>
            </div>

            <div className="max-w-5xl grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center">
                            <Building className="w-4 h-4 mr-2 text-blue-600" /> Identity
                        </h3>
                        
                        <div className="mb-6 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-6 bg-slate-50 dark:bg-slate-950/30 hover:bg-slate-100 dark:hover:bg-slate-900 transition cursor-pointer group">
                            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform border border-slate-100 dark:border-slate-700">
                                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                                    {formData.name ? formData.name.substring(0, 2).toUpperCase() : 'CO'}
                                </span>
                            </div>
                            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Upload Logo</p>
                            <p className="text-[10px] text-slate-400 mt-1">PNG, JPG up to 2MB</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className={labelClasses}>Company Name <span className="text-red-500">*</span></label>
                                <input type="text" value={formData.name} onChange={e => handleChange('name', e.target.value)} className={inputClasses} />
                            </div>
                            <div className="space-y-1.5">
                                <label className={labelClasses + " flex justify-between"}>
                                    Code / Abbreviation
                                    <span className="text-[10px] normal-case font-normal text-slate-400">For document prefixes</span>
                                </label>
                                <input type="text" value={formData.code} onChange={e => handleChange('code', e.target.value)} placeholder="e.g. TF-US" className={`${inputClasses} font-mono uppercase`} maxLength={6} />
                            </div>
                            <div className="space-y-1.5">
                                <label className={labelClasses}>Tax / Registration ID</label>
                                <input type="text" value={formData.regId} onChange={e => handleChange('regId', e.target.value)} className={inputClasses} />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center">
                            <Globe className="w-4 h-4 mr-2 text-blue-600" /> Locale & Regional
                        </h3>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className={labelClasses}>Base Currency <span className="text-red-500">*</span></label>
                                <select value={formData.currency} onChange={e => handleChange('currency', e.target.value)} className={inputClasses}>
                                    <option value="USD">USD ($)</option>
                                    <option value="EUR">EUR (€)</option>
                                    <option value="GBP">GBP (£)</option>
                                    <option value="SGD">SGD (S$)</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className={labelClasses}>Timezone</label>
                                <select value={formData.timezone} onChange={e => handleChange('timezone', e.target.value)} className={inputClasses}>
                                    <option value="UTC">UTC (GMT+0)</option>
                                    <option value="UTC-5">EST (UTC-5)</option>
                                    <option value="UTC-8">PST (UTC-8)</option>
                                    <option value="UTC+1">CET (UTC+1)</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className={labelClasses}>Language</label>
                                <select value={formData.language} onChange={e => handleChange('language', e.target.value)} className={inputClasses}>
                                    <option value="en-US">English (US)</option>
                                    <option value="de-DE">German</option>
                                    <option value="es-ES">Spanish</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="xl:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center">
                            <MapPin className="w-4 h-4 mr-2 text-blue-600" /> Registered Address
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2 space-y-1.5">
                                <label className={labelClasses}>Street Address</label>
                                <input type="text" value={formData.address.street} onChange={e => handleChange('address', e.target.value, 'street')} placeholder="123 Business Rd, Suite 100" className={inputClasses} />
                            </div>
                            <div className="space-y-1.5">
                                <label className={labelClasses}>City</label>
                                <input type="text" value={formData.address.city} onChange={e => handleChange('address', e.target.value, 'city')} className={inputClasses} />
                            </div>
                            <div className="space-y-1.5">
                                <label className={labelClasses}>State / Province</label>
                                <input type="text" value={formData.address.state} onChange={e => handleChange('address', e.target.value, 'state')} className={inputClasses} />
                            </div>
                            <div className="space-y-1.5">
                                <label className={labelClasses}>Zip / Postal Code</label>
                                <input type="text" value={formData.address.zip} onChange={e => handleChange('address', e.target.value, 'zip')} className={inputClasses} />
                            </div>
                            <div className="space-y-1.5">
                                <label className={labelClasses}>Country</label>
                                <select value={formData.address.country} onChange={e => handleChange('address', e.target.value, 'country')} className={inputClasses}>
                                    <option value="">Select...</option>
                                    <option value="USA">United States</option>
                                    <option value="DE">Germany</option>
                                    <option value="UK">United Kingdom</option>
                                    <option value="SG">Singapore</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center">
                            <Phone className="w-4 h-4 mr-2 text-blue-600" /> Contact Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className={labelClasses}>General Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="email" value={formData.email} onChange={e => handleChange('email', e.target.value)} placeholder="info@company.com" className={`${inputClasses} pl-9`} />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className={labelClasses}>Phone Number</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="tel" value={formData.phone} onChange={e => handleChange('phone', e.target.value)} placeholder="+1 (555) 000-0000" className={`${inputClasses} pl-9`} />
                                </div>
                            </div>
                            <div className="md:col-span-2 space-y-1.5">
                                <label className={labelClasses}>Website</label>
                                <div className="relative">
                                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="url" value={formData.website} onChange={e => handleChange('website', e.target.value)} placeholder="https://www.company.com" className={`${inputClasses} pl-9`} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className={`fixed bottom-0 right-0 left-0 md:left-64 p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center transition-transform duration-200 z-40 ${isDirty ? 'translate-y-0' : 'translate-y-full'}`}>
                <div className="text-sm text-slate-600 dark:text-slate-400 hidden sm:block">
                    <Info className="w-4 h-4 inline mr-2" />
                    Updates will affect all generated documents immediately.
                </div>
                <div className="flex gap-4 ml-auto">
                    <button 
                        onClick={() => setIsDirty(false)} 
                        className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm font-medium transition"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave} 
                        className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-500/30"
                    >
                        <Save className="w-4 h-4 mr-2" /> Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};
