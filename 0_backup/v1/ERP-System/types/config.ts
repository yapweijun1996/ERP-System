
import { ScopedEntity } from './core';
import { DocType } from './enums';

export type DateFormatOption = 'YYYY' | 'YYMM' | 'YYYYMM' | 'YYYYMMDD' | 'None';
export type ResetFrequency = 'Never' | 'Monthly' | 'Yearly';

export interface RunningNumberConfig extends ScopedEntity {
  id: string;
  docType: DocType;
  name: string;
  isDefault: boolean;
  prefix: string;
  suffix?: string;
  separator: string; 
  suffixSeparator?: string;
  dateFormat: DateFormatOption;
  digits: number; 
  nextSequence: number;
  resetFrequency: ResetFrequency;
  lastResetDate?: string;
}

export interface TaxCode extends ScopedEntity {
  code: string;
  rate: number; 
  description: string;
}
