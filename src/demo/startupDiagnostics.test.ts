import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const source=readFileSync('web/public/assets/demo-startup-diagnostics.js','utf8');
type Diagnostics={ failure(error: unknown, stage: string): Record<string,unknown>; snapshot(): Record<string,unknown>; serialize(): string };
function install(mode='demo') {
  const window: Record<string,unknown>={erpDataMode:()=>mode,addEventListener:()=>{},__ERP_BUILD_ID__:'a'.repeat(40)};
  vm.runInNewContext(source,{window,Set,JSON});
  return {window,diagnostics:window.ErpDemoDiagnostics as Diagnostics};
}
describe('safe visible Demo startup diagnostics',()=>{
  it('retains only allowlisted codes, source labels and startup stages',()=>{
    const {diagnostics}=install();
    const result=diagnostics.failure({code:'42P10',demoBootStatement:'erp-system-demo-sales-credit.sql',message:'private row content',query:'secret SQL'},'Loading pricing fixtures');
    expect(result).toEqual({code:'42P10',stage:'Loading pricing fixtures',statement:'erp-system-demo-sales-credit.sql'});
    expect(Object.keys(result).sort()).toEqual(['code','stage','statement']);
    expect(diagnostics.failure({code:'demo_schema_index_mismatch',demoBootStatement:'VALIDATE UNIQUE INDEX uq_sales_credit_profile_customer'},'Checking database compatibility')).toEqual({code:'demo_schema_index_mismatch',stage:'Checking database compatibility',statement:'VALIDATE UNIQUE INDEX uq_sales_credit_profile_customer'});
  });
  it('never serializes records, original errors, arbitrary codes/stages/identifiers or storage',()=>{
    const {window,diagnostics}=install();
    window.__ERP_DEMO_FAILURE__={code:'private@example.test',stage:'select secret from employee',statement:'VALIDATE UNIQUE INDEX private_customer_name',record:{secret:'private record'},stack:'private stack'};
    window.__ERP_DEMO_PROGRESS__={phase:'private token'};
    window.__ERP_BUILD_ID__='secret build token';
    window.ErpSystemData={mode:'secret mode',databaseReady:false,db:{secret:'private db'}};
    const text=diagnostics.serialize();
    expect(text).not.toMatch(/private|secret|employee|stack|record|token/);
    expect(diagnostics.snapshot()).toEqual({code:'demo_initialization_failed',stage:'Preparing local demo database',statement:null,phase:'loading',mode:'pending',ready:false,buildId:'development'});
  });
  it('captures only readiness/mode/phase and an immutable build ID alongside the safe failure',()=>{
    const {window,diagnostics}=install();
    window.__ERP_DEMO_FAILURE__={code:'23505',stage:'Checking database compatibility',statement:'CREATE UNIQUE INDEX uq_sales_credit_profile_customer'};
    window.__ERP_DEMO_PROGRESS__={phase:'failed',detail:'unneeded content'};
    window.ErpSystemData={mode:'fallback',databaseReady:false};
    expect(diagnostics.snapshot()).toEqual({code:'23505',stage:'Checking database compatibility',statement:'CREATE UNIQUE INDEX uq_sales_credit_profile_customer',phase:'failed',mode:'fallback',ready:false,buildId:'a'.repeat(40)});
  });
  it('is absent from production/API mode',()=>{
    expect(install('api').window.ErpDemoDiagnostics).toBeUndefined();
  });
  it('copies only bounded metadata digests/counts for an unknown lineage, never names, definitions or defaults',()=>{
    const {window,diagnostics}=install();
    const lineage={marker:118,structuralHash:'a'.repeat(64),expectedStructuralHash:'b'.repeat(64),matchedVersion:null,identityCount:0,legacyRoleIndex:'absent',normalizedMatchedVersion:null,
      categories:[{name:'columns',hash:'c'.repeat(64),count:5000,expectedHash:'d'.repeat(64),expectedCount:4999,definition:'private default literal'},{name:'private_custom_table',hash:'e'.repeat(64),count:1}],privateRow:'private row',storage:'private storage'};
    window.__ERP_DEMO_FAILURE__=diagnostics.failure({code:'demo_schema_lineage_unknown',demoBootStatement:'VALIDATE DEMO SCHEMA LINEAGE',demoBootLineage:lineage},'Checking database compatibility');
    const result=diagnostics.snapshot();
    expect(result.lineage).toEqual({marker:118,structuralHash:'a'.repeat(64),expectedStructuralHash:'b'.repeat(64),matchedVersion:null,identityCount:0,legacyRoleIndex:'absent',normalizedMatchedVersion:null,categories:[{name:'columns',hash:'c'.repeat(64),count:5000,expectedHash:'d'.repeat(64),expectedCount:4999}]});
    expect(diagnostics.serialize()).not.toMatch(/private|storage|definition|default/);
    expect(diagnostics.failure({code:'42P10',demoBootStatement:'erp-system-demo-sales-credit.sql',demoBootLineage:lineage},'Loading pricing fixtures')).not.toHaveProperty('lineage');
  });
  it('rejects malformed, unbounded or arbitrary diagnostic evidence',()=>{
    const {diagnostics}=install();
    for(const marker of [-1,1000001,118.5,'private marker'])expect(diagnostics.failure({code:'demo_schema_lineage_unknown',demoBootStatement:'VALIDATE DEMO SCHEMA LINEAGE',demoBootLineage:{marker,structuralHash:'a'.repeat(64)}},'Checking database compatibility')).not.toHaveProperty('lineage');
    expect(diagnostics.failure({code:'demo_schema_lineage_unknown',demoBootStatement:'VALIDATE DEMO SCHEMA LINEAGE',demoBootLineage:{marker:118,structuralHash:'private SQL'}},'Checking database compatibility')).not.toHaveProperty('lineage');
  });
});
