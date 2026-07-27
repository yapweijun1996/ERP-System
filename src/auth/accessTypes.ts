import type { DataScope, RoleTemplate } from './accessCatalog';
import type { EffectiveCapability } from './permissions';
import type { CompanyModuleState } from './moduleAccess';
import type { StaffOnboardingDraftInput } from '../modules/hr/staffOnboarding';

export type { DataScope, RoleTemplate, EffectiveCapability, CompanyModuleState };

export interface CompanyRole {
  roleId: number;
  masterFn: string;
  companyFn: string;
  name: string;
  isSuperadmin: boolean;
  sourceTemplateKey: string | null;
}

export interface StaffOnboardingDraft extends StaffOnboardingDraftInput {
  id: number;
  masterFn: string;
  companyFn: string;
  status: 'draft' | 'activated' | 'cancelled';
  version: number;
}

export interface OnboardingStatus {
  masterFn: string;
  companyFn: string;
  status: 'setup' | 'live';
  currentStage:
    | 'company' | 'fiscal' | 'warehouse' | 'modules' | 'roles'
    | 'staff' | 'import' | 'opening_balance' | 'uat' | 'live';
  completedSteps: string[];
  version: number;
}

export interface ImportJob {
  id: number;
  target: 'employee' | 'customer' | 'supplier' | 'product' | 'account'
    | 'warehouse' | 'inventory' | 'ar' | 'ap' | 'gl';
  format: 'csv' | 'xlsx';
  status: 'validated' | 'invalid' | 'committed' | 'failed';
  totalRows: number;
  errorRows: number;
  warningRows: number;
  importedRows: number;
  version: number;
}
