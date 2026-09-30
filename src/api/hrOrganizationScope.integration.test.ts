import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { and, eq, isNull, ne } from 'drizzle-orm';
import type { DB } from '../data/db';
import { appUser, company, companyModule, employee, customer, userCompany, leaveRequest, leaveType, role, rolePermission, userCompanyRole, userCompanyRoleScope, staffAppointment, calendarHoliday, userPermissionOverride, approvalInstance, approvalInstanceEvent, leaveBalanceEntry, businessUnit, hrPosition } from '../data/schema';
import { resolveHrEmployeeAccessWithin } from '../auth/hrDataAccess';
import { freshDb } from '../test/helpers';
import { seedDemo } from '../data/seed';
import { createApp } from './app';
import { createLeaveDraftWithin, submitLeaveApplicationWithin, decideGovernedLeaveWithin, requestApprovedLeaveCancellationWithin } from '../modules/hr/leaveApplication';
import { saveOrganizationWithin, assignEmployeeOrganizationWithin } from '../modules/hr/organization';

const scope = { masterFn: 'M1', companyFn: 'C-SG' };
let db: DB, server: Server, base: string, cookie: string, csrf: string;
let actorId: number, viewerId: number, viewerEmployee: number, targetId: number, otherId: number, unitId: number, positionId: number, assignmentId: number;
function cookies(response: Response) {
  const values = (response.headers as Headers & {getSetCookie(): string[]}).getSetCookie();
  const pairs = values.map(value => value.split(';')[0]);
  return { cookie: pairs.join('; '), csrf: decodeURIComponent(pairs.find(pair => pair.startsWith('erp_csrf='))!.slice(9)) };
}
beforeAll(async () => {
  db = await freshDb(); await seedDemo(db);
  const users = await db.select().from(appUser);
  actorId = users.find(row => row.username === 'admin')!.userId;
  viewerId = users.find(row => row.username === 'viewer')!.userId;
  const [ownerStaff] = await db.select().from(employee).where(and(eq(employee.userId, viewerId), eq(employee.companyFn, 'C-SG')));
  viewerEmployee = ownerStaff.id;
  const staff = await db.select().from(employee).where(and(eq(employee.companyFn, 'C-SG'), ne(employee.id, viewerEmployee), eq(employee.isActive, true), isNull(employee.userId)));
  targetId = staff[0].id; otherId = staff[1].id;
  const actor = { userId: actorId, requestId: 'synthetic-scope-fixture' };
  unitId = (await db.transaction(tx => saveOrganizationWithin(tx, scope, actor, 'business_unit', {code:'SCOPE-UNIT',name:'Synthetic Unit',isActive:true,expectedVersion:0}))).id;
  positionId = (await db.transaction(tx => saveOrganizationWithin(tx, scope, actor, 'position', {code:'SCOPE-POS',name:'Synthetic Position',isActive:true,expectedVersion:0}))).id;
  await db.update(userCompanyRole).set({ revokedAt: new Date(), revokedByUserId: actorId, revocationReason: 'Synthetic scoped role replacement' }).where(and(eq(userCompanyRole.userId, viewerId), eq(userCompanyRole.companyFn, 'C-SG')));
  const [limitedRole] = await db.insert(role).values({...scope,name:'Synthetic scoped HR'}).returning();
  await db.insert(rolePermission).values(['hr.read','hr.write'].map(permissionKey => ({masterFn:'M1',roleId:limitedRole.roleId,permissionKey,allowed:true})));
  const [assignment] = await db.insert(userCompanyRole).values({userId:viewerId,companyFn:'C-SG',roleId:limitedRole.roleId,assignmentSource:'manual',assignedByUserId:actorId,assignmentReason:'Synthetic explicit grant',scopeBackfilledAt:new Date()}).returning();
  assignmentId = assignment.assignmentId;
  await db.insert(userCompanyRoleScope).values({...scope,assignmentId,resourceKey:'hr/*',scope:'business_unit',targetType:'business_unit',targetId:String(unitId)});
  server = createApp(db).listen(0,'127.0.0.1'); await new Promise<void>(resolve => server.once('listening',resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No API address');
  base = 'http://127.0.0.1:'+address.port;
  const loggedIn = await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({organizationCode:'ACME',username:'viewer',password:'viewer1234'})});
  expect(loggedIn.status).toBe(200);({cookie,csrf}=cookies(loggedIn));
},60000);
afterAll(async () => {if(server) await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));});
async function request(path: string, method='GET', body?: unknown, key='synthetic-'+Math.random()) {
  return fetch(base+path,{method,headers:{cookie,'content-type':'application/json','x-csrf-token':csrf,'idempotency-key':key,...(body&&typeof body==='object'&&'expectedUpdatedAt' in body?{'if-match':String(body.expectedUpdatedAt)}:{})},body:body==null?undefined:JSON.stringify(body)});
}
async function assign(employeeId: number, unit: number|null, position: number|null, version=0) {
  return db.transaction(tx=>assignEmployeeOrganizationWithin(tx,scope,{userId:actorId,requestId:'explicit-fixture-assignment'},{employeeId,businessUnitId:unit,positionId:position,expectedVersion:version,reason:'Explicit synthetic organization assignment'}));
}
describe('one HR staff projection across generic and specific API paths',()=>{
  it('denies an unassigned actor despite an explicit BU permission grant',async()=>{
    const response=await request('/api/hr/employees');
    expect(response.status).toBe(200);expect((await response.json()).data).toEqual([]);
    expect((await request('/api/hr/employees/'+targetId,'PATCH',{})).status).toBe(403);
  });
  it('allows own BU including accountless staff and denies other staff through both code paths',async()=>{
    await assign(viewerEmployee,unitId,positionId);
    const adminLogin=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({organizationCode:'ACME',username:'admin',password:'demo1234'})});
    expect(adminLogin.status).toBe(200);
    const adminAuth=cookies(adminLogin);
    const companyHeaders={cookie:adminAuth.cookie,'content-type':'application/json','x-csrf-token':adminAuth.csrf,'idempotency-key':'synthetic-assignment-repeat'};
    const masterHeaders={...companyHeaders,'idempotency-key':'synthetic-concurrent-master'};
    const masterBody={code:'CONCURRENT-POS',name:'Synthetic concurrent Position',isActive:true,expectedVersion:0};
    const masters=await Promise.all([1,2].map(()=>fetch(base+'/api/hr/organization/position',{method:'POST',headers:masterHeaders,body:JSON.stringify(masterBody)})));
    expect(masters.map(response=>response.status)).toEqual([201,201]);
    const masterResults=await Promise.all(masters.map(response=>response.json()));
    expect(masterResults[0].data.id).toBe(masterResults[1].data.id);
    const assignmentBody={businessUnitId:unitId,positionId,expectedVersion:0,reason:'Explicit Company assignment'};
    const assigned=await fetch(base+'/api/hr/employees/'+targetId+'/organization',{method:'PUT',headers:companyHeaders,body:JSON.stringify(assignmentBody)});
    expect(assigned.status).toBe(200);
    const replay=await fetch(base+'/api/hr/employees/'+targetId+'/organization',{method:'PUT',headers:companyHeaders,body:JSON.stringify(assignmentBody)});
    expect(replay.status).toBe(200);expect(replay.headers.get('idempotency-replayed')).toBe('true');
    const conflict=await fetch(base+'/api/hr/employees/'+targetId+'/organization',{method:'PUT',headers:companyHeaders,body:JSON.stringify({...assignmentBody,reason:'Different payload'})});
    expect(conflict.status).toBe(409);
    const [foreignStaff]=await db.select().from(employee).where(eq(employee.companyFn,'C-MY')).limit(1);
    expect((await request('/api/hr/employees/'+foreignStaff.id)).status).toBe(404);
    expect((await request('/api/hr/employees/'+foreignStaff.id+'/history')).status).toBe(403);
    const [foreignLeave]=await db.insert(leaveRequest).values({...scope,employeeId:otherId,leaveType:'Unpaid',startDate:'2026-10-05',endDate:'2026-10-05',days:'1.00',reason:'Synthetic denied Leave',status:'pending'}).returning();
    expect((await request('/api/hr/leave-requests/'+foreignLeave.id+'/actions/approve','POST',{},'deny-cross-scope-leave')).status).toBe(404);
    expect((await request('/api/hr/leave-applications/'+foreignLeave.id)).status).toBe(403);
    const [scopedLeave]=await db.insert(leaveRequest).values({...scope,employeeId:targetId,leaveType:'Unpaid',startDate:'2026-10-06',endDate:'2026-10-06',days:'1.00',reason:'Synthetic permitted Leave',status:'pending'}).returning();
    const approved=await request('/api/hr/leave-requests/'+scopedLeave.id+'/actions/approve','POST',{},'scope-leave-approve-repeat');
    expect(approved.status).toBe(200);
    const approvedReplay=await request('/api/hr/leave-requests/'+scopedLeave.id+'/actions/approve','POST',{},'scope-leave-approve-repeat');
    expect(approvedReplay.status).toBe(200);expect(approvedReplay.headers.get('idempotency-replayed')).toBe('true');


    const [annualType]=await db.select().from(leaveType).where(and(eq(leaveType.companyFn,'C-SG'),eq(leaveType.code,'ANNUAL')));
    const manager={userId:actorId,canManage:true};
    const draft=await db.transaction(tx=>createLeaveDraftWithin(tx,scope,manager,targetId,{leaveTypeId:annualType.id,startDate:'2026-11-09',endDate:'2026-11-09',unit:'full_day',reason:'Synthetic scoped governed Leave'}));
    const submitted=await db.transaction(tx=>submitLeaveApplicationWithin(tx,scope,manager,draft.id,draft.version));
    const decided=await request('/api/hr/leave-applications/'+draft.id+'/actions/approve','POST',{expectedVersion:submitted.version,reason:'Synthetic governed approval'},'governed-scope-approval');
    expect(decided.status,await decided.clone().text()).toBe(200);
    const governed=(await decided.json()).data;
    const cancellation=await db.transaction(tx=>requestApprovedLeaveCancellationWithin(tx,scope,manager,draft.id,governed.version,'Synthetic cancellation'));
    const cancelBody={expectedVersion:1,reason:'Synthetic scoped cancellation approval'};
    const cancelled=await request('/api/hr/leave-cancellations/'+cancellation.cancellationId+'/actions/approve','POST',cancelBody,'scoped-cancel-repeat');
    expect(cancelled.status).toBe(200);expect((await cancelled.json()).data.status).toBe('cancelled');
    const cancelledReplay=await request('/api/hr/leave-cancellations/'+cancellation.cancellationId+'/actions/approve','POST',cancelBody,'scoped-cancel-repeat');
    expect(cancelledReplay.status).toBe(200);expect(cancelledReplay.headers.get('idempotency-replayed')).toBe('true');
    const deniedDraft=await db.transaction(tx=>createLeaveDraftWithin(tx,scope,manager,otherId,{leaveTypeId:annualType.id,startDate:'2026-11-10',endDate:'2026-11-10',unit:'full_day',reason:'Synthetic denied cancellation'}));
    const deniedSubmitted=await db.transaction(tx=>submitLeaveApplicationWithin(tx,scope,manager,deniedDraft.id,deniedDraft.version));
    const deniedApproved=await db.transaction(tx=>decideGovernedLeaveWithin(tx,scope,manager,deniedDraft.id,deniedSubmitted.version,'approved','Fixture approval'));
    const deniedCancellation=await db.transaction(tx=>requestApprovedLeaveCancellationWithin(tx,scope,manager,deniedDraft.id,deniedApproved.version,'Fixture cancellation'));
    expect((await request('/api/hr/leave-cancellations/'+deniedCancellation.cancellationId+'/actions/approve','POST',cancelBody)).status).toBe(403);

    const listing=await request('/api/hr/employees');expect(listing.status).toBe(200);
    const rows=(await listing.json()).data;
    expect(rows.map((row:{id:number})=>row.id)).toContain(targetId);
    expect(rows.map((row:{id:number})=>row.id)).not.toContain(otherId);
    expect((await request('/api/hr/employees/'+targetId)).status).toBe(200);
    expect((await request('/api/hr/employees/'+otherId)).status).toBe(404);
    expect((await request('/api/hr/employees/'+otherId+'/history')).status).toBe(403);
    expect((await request('/api/hr/employees/'+otherId,'PATCH',{})).status).toBe(403);
    const [staff]=await db.select().from(employee).where(eq(employee.id,targetId));
    const updated=await request('/api/hr/employees/'+targetId,'PATCH',{employeeNo:staff.employeeNo,fullName:staff.fullName,email:staff.email,phone:'555-0100',department:staff.department,jobTitle:staff.jobTitle,employmentType:staff.employmentType,startDate:staff.startDate,annualLeaveDays:staff.annualLeaveDays,baseSalary:staff.baseSalary,managerId:staff.managerId,expectedUpdatedAt:staff.updatedAt.toISOString()});
    expect(updated.status).toBe(200);
    await db.update(employee).set({managerId:targetId}).where(eq(employee.id,otherId));
    const [endTarget]=await db.select().from(employee).where(eq(employee.id,targetId));
    const deniedEnd=await request('/api/hr/employees/'+targetId+'/actions/end-employment','POST',{
      expectedUpdatedAt:endTarget.updatedAt.toISOString(),reason:'Synthetic out-of-scope report handoff',handoffEmployeeId:viewerEmployee,
    });
    expect(deniedEnd.status).toBe(403);
    const [unchangedReport]=await db.select().from(employee).where(eq(employee.id,otherId));
    expect(unchangedReport.managerId).toBe(targetId);
    expect((await db.select().from(employee).where(eq(employee.id,targetId)))[0].isActive).toBe(true);
    await db.update(employee).set({managerId:null}).where(eq(employee.id,otherId));
    const syntheticBase={...scope,fullName:'Fictional scoped handoff',email:'handoff@example.invalid',
      department:'Synthetic',jobTitle:'Synthetic',startDate:'2026-01-01',baseSalary:'1000.00',
      businessUnitId:unitId,positionId};
    const [scopedManager]=await db.insert(employee).values({...syntheticBase,employeeNo:'QA-SCOPE-MANAGER'}).returning();
    const [scopedReport]=await db.insert(employee).values({...syntheticBase,employeeNo:'QA-SCOPE-REPORT',managerId:scopedManager.id}).returning();
    const permittedEnd=await request('/api/hr/employees/'+scopedManager.id+'/actions/end-employment','POST',{
      expectedUpdatedAt:scopedManager.updatedAt.toISOString(),reason:'Synthetic scoped handoff',handoffEmployeeId:viewerEmployee,
    },'scoped-end');
    expect(permittedEnd.status).toBe(200);
    const replayedEnd=await request('/api/hr/employees/'+scopedManager.id+'/actions/end-employment','POST',{
      expectedUpdatedAt:scopedManager.updatedAt.toISOString(),reason:'Synthetic scoped handoff',handoffEmployeeId:viewerEmployee,
    },'scoped-end');
    expect(replayedEnd.status).toBe(200);expect(replayedEnd.headers.get('idempotency-replayed')).toBe('true');
    await db.update(userCompanyRole).set({revokedAt:new Date()}).where(eq(userCompanyRole.assignmentId,assignmentId));
    expect((await request('/api/hr/employees/'+scopedManager.id+'/actions/end-employment','POST',{
      expectedUpdatedAt:scopedManager.updatedAt.toISOString(),reason:'Synthetic scoped handoff',handoffEmployeeId:viewerEmployee,
    },'scoped-end')).status).toBe(403);
    await db.update(userCompanyRole).set({revokedAt:null}).where(eq(userCompanyRole.assignmentId,assignmentId));
    expect((await db.select().from(employee).where(eq(employee.id,scopedManager.id)))[0].isActive).toBe(false);
    expect((await db.select().from(employee).where(eq(employee.id,scopedReport.id)))[0].managerId).toBe(viewerEmployee);


    expect((await request('/api/hr/employees/'+viewerEmployee+'/organization','PUT',{businessUnitId:null,positionId:null,expectedVersion:1,reason:'Cannot widen own authority'})).status).toBe(403);
    expect((await request('/api/hr/organization/business_unit','POST',{code:'NO',name:'No grant',isActive:true,expectedVersion:0})).status).toBe(403);
  });
  it('does not combine an unrelated role Company scope with restricted HR permission',async()=>{
    const [unrelated]=await db.insert(role).values({...scope,name:'Synthetic unrelated company scope'}).returning();
    await db.insert(rolePermission).values({masterFn:'M1',roleId:unrelated.roleId,permissionKey:'sales.read',allowed:true});
    const [extra]=await db.insert(userCompanyRole).values({userId:viewerId,companyFn:'C-SG',roleId:unrelated.roleId,assignmentSource:'manual',assignedByUserId:actorId,assignmentReason:'Synthetic mixed-role regression',scopeBackfilledAt:new Date()}).returning();
    await db.insert(userCompanyRoleScope).values({...scope,assignmentId:extra.assignmentId,resourceKey:'hr/*',scope:'company',targetType:'company',targetId:'C-SG'});
    const staff=await request('/api/hr/employees');
    expect(staff.status).toBe(200);
    expect((await staff.json()).data.map((row:{id:number})=>row.id)).not.toContain(otherId);
    expect((await request('/api/hr/employees/'+targetId)).status).toBe(200);
    expect((await request('/api/hr/employees/'+otherId)).status).toBe(404);
    const [outsideLeave]=await db.insert(leaveRequest).values({...scope,employeeId:otherId,leaveType:'Unpaid',startDate:'2026-12-01',endDate:'2026-12-01',days:'1.00',reason:'Synthetic mixed-role outside Leave',status:'pending'}).returning();
    const list=await request('/api/hr/leave-requests');expect(list.status).toBe(200);
    expect((await list.json()).data.map((row:{id:number})=>row.id)).not.toContain(outsideLeave.id);
    expect((await request('/api/hr/leave-requests/'+outsideLeave.id)).status).toBe(404);
  });
  it('denies linked-account offboarding without permission-qualified Company scope and leaves all ownership unchanged',async()=>{
    const [seedUser]=await db.select().from(appUser).where(eq(appUser.userId,actorId));
    const [sourceUser]=await db.insert(appUser).values({masterFn:'M1',username:'synthetic-offboard-source',fullName:'Fictional linked manager',passwordHash:seedUser.passwordHash}).returning();
    const [actorRole]=await db.select().from(userCompanyRole).where(eq(userCompanyRole.assignmentId,assignmentId));
    await db.insert(userCompany).values({userId:sourceUser.userId,companyFn:'C-SG',roleId:actorRole.roleId});
    const [sourceStaff]=await db.insert(employee).values({...scope,employeeNo:'QA-LINKED-MANAGER',fullName:'Fictional linked manager',
      email:'linked@example.invalid',department:'Synthetic',jobTitle:'Synthetic',startDate:'2026-01-01',baseSalary:'1000.00',
      businessUnitId:unitId,positionId,userId:sourceUser.userId}).returning();
    await db.update(employee).set({managerId:sourceStaff.id}).where(eq(employee.id,otherId));
    const [ownedCustomer]=await db.select().from(customer).where(eq(customer.companyFn,'C-SG')).limit(1);
    await db.update(customer).set({ownerUserId:sourceUser.userId}).where(eq(customer.id,ownedCustomer.id));
    const beforeRoles=await db.select().from(userCompanyRole).where(eq(userCompanyRole.userId,viewerId));
    const denied=await request('/api/hr/employee-accounts/'+sourceStaff.id+'/actions/offboard','POST',{
      targetEmployeeId:viewerEmployee,reason:'Synthetic broad cross-scope handoff',
    },'deny-broad-offboard');
    expect(denied.status).toBe(403);
    expect((await db.select().from(employee).where(eq(employee.id,sourceStaff.id)))[0].isActive).toBe(true);
    expect((await db.select().from(appUser).where(eq(appUser.userId,sourceUser.userId)))[0].isActive).toBe(true);
    expect((await db.select().from(employee).where(eq(employee.id,otherId)))[0].managerId).toBe(sourceStaff.id);
    expect((await db.select().from(customer).where(eq(customer.id,ownedCustomer.id)))[0].ownerUserId).toBe(sourceUser.userId);
    expect(await db.select().from(userCompanyRole).where(eq(userCompanyRole.userId,viewerId))).toEqual(beforeRoles);
    await db.update(employee).set({managerId:null}).where(eq(employee.id,otherId));
  });
  it('rejects spoofed global subjects and authorizes persisted appointment old and new employees',async()=>{
    const before=await db.select().from(calendarHoliday);
    for(const [path,method] of [['/api/hr/calendar/holidays','POST'],['/api/hr/calendar/holidays/1','PUT'],
      ['/api/hr/calendar/holidays/1/actions/approve','POST'],['/api/hr/leave-workflows/1/actions/confirm','POST'],
      ['/api/hr/leave-workflows/1/actions/retire','POST']] as const){
      expect((await request(path,method,{employeeId:targetId,name:'Spoof',date:'2026-12-15',expectedVersion:1})).status).toBe(403);
    }
    expect(await db.select().from(calendarHoliday)).toEqual(before);
    const values={...scope,title:'Fictional appointment',startAt:new Date('2026-12-15T02:00:00Z'),endAt:new Date('2026-12-15T03:00:00Z'),createdByUserId:actorId,updatedByUserId:actorId};
    const [outside]=await db.insert(staffAppointment).values({...values,employeeId:otherId}).returning();
    const [inside]=await db.insert(staffAppointment).values({...values,employeeId:targetId}).returning();
    expect((await request('/api/hr/calendar/appointments/'+outside.id+'/actions/cancel','POST',{employeeId:targetId,expectedVersion:1})).status).toBe(403);
    expect((await request('/api/hr/calendar/appointments/'+outside.id,'PUT',{employeeId:targetId,expectedVersion:1})).status).toBe(403);
    expect((await request('/api/hr/calendar/appointments/'+inside.id,'PUT',{employeeId:otherId,expectedVersion:1})).status).toBe(403);
    expect((await db.select().from(staffAppointment).where(eq(staffAppointment.id,outside.id)))[0]).toEqual(outside);
    expect((await db.select().from(staffAppointment).where(eq(staffAppointment.id,inside.id)))[0]).toEqual(inside);
    expect((await request('/api/hr/calendar/appointments/'+inside.id+'/actions/cancel','POST',{expectedVersion:1})).status).toBe(200);
  });
  it('retains department, employee and BU subject denies through My approvals without decisions or events',async()=>{
    const [assignedRole]=await db.select().from(userCompanyRole).where(eq(userCompanyRole.assignmentId,assignmentId));
    await db.insert(rolePermission).values({masterFn:'M1',roleId:assignedRole.roleId,permissionKey:'employee.self.read',allowed:true});
    await db.update(userCompanyRoleScope).set({scope:'company',targetType:'company',targetId:'C-SG'}).where(eq(userCompanyRoleScope.assignmentId,assignmentId));
    const [subject]=await db.select().from(employee).where(eq(employee.id,targetId));
    const [annual]=await db.select().from(leaveType).where(and(eq(leaveType.companyFn,'C-SG'),eq(leaveType.code,'ANNUAL')));
    const manager={userId:actorId,canManage:true};
    const draft=await db.transaction(tx=>createLeaveDraftWithin(tx,scope,manager,targetId,{leaveTypeId:annual.id,startDate:'2026-12-21',endDate:'2026-12-21',unit:'full_day',reason:'Subject deny fixture'}));
    const submitted=await db.transaction(tx=>submitLeaveApplicationWithin(tx,scope,manager,draft.id,draft.version));
    const [instance]=await db.select().from(approvalInstance).where(and(eq(approvalInstance.entityId,draft.id),eq(approvalInstance.entityType,'leave_request')));
    const original=await db.select().from(leaveRequest).where(eq(leaveRequest.id,draft.id));
    const balances=await db.select().from(leaveBalanceEntry).where(eq(leaveBalanceEntry.employeeId,targetId));
    const events=await db.select().from(approvalInstanceEvent).where(eq(approvalInstanceEvent.instanceId,instance.id));
    for(const target of [
      {scope:'department',targetType:'department',targetId:subject.department},
      {scope:'self',targetType:'employee',targetId:String(targetId)},
      {scope:'business_unit',targetType:'business_unit',targetId:String(unitId)},
      {scope:'business_unit',targetType:'none',targetId:''},
      {scope:'position',targetType:'none',targetId:''},
    ]){
      const [deny]=await db.insert(userPermissionOverride).values({...scope,userId:viewerId,permissionKey:'hr.write',resourceKey:'hr/leave-requests',effect:'deny',...target,reason:'Synthetic subject deny',assignedByUserId:actorId}).returning();
      const response=await request('/api/my/approvals/'+draft.id+'/actions/approve','POST',{expectedVersion:submitted.version,reason:'Must not approve'});
      expect(response.status,await response.clone().text()).toBe(403);
      expect(await db.select().from(leaveRequest).where(eq(leaveRequest.id,draft.id))).toEqual(original);
      expect(await db.select().from(leaveBalanceEntry).where(eq(leaveBalanceEntry.employeeId,targetId))).toEqual(balances);
      expect(await db.select().from(approvalInstanceEvent).where(eq(approvalInstanceEvent.instanceId,instance.id))).toEqual(events);
      if (target.targetType === 'none') {
        const session={userId:viewerId,masterFn:'M1',activeCompanyFn:'C-SG',username:'viewer',email:null,fullName:null};
        const projection=()=>db.transaction(tx=>resolveHrEmployeeAccessWithin(tx,session,'hr/leave-requests','hr.write'));
        const allowed=await projection();expect(allowed).not.toBeNull();expect(allowed).not.toContain(targetId);expect(allowed).toContain(otherId);
        const field=target.scope==='business_unit'?'businessUnitId':'positionId';
        const table=target.scope==='business_unit'?businessUnit:hrPosition;
        const id=target.scope==='business_unit'?unitId:positionId;
        await db.update(employee).set({[field]:null}).where(eq(employee.id,viewerEmployee));
        expect(await projection()).toEqual([]);
        expect(await db.transaction(tx=>resolveHrEmployeeAccessWithin(tx,session,'hr/employees','hr.write'))).toBeNull();
        const unresolved=await request('/api/my/approvals/'+draft.id+'/actions/approve','POST',{expectedVersion:submitted.version,reason:'Unresolved relative deny'});
        expect(unresolved.status).toBe(403);
        await db.update(employee).set({[field]:id}).where(eq(employee.id,viewerEmployee));
        await db.update(table).set({isActive:false}).where(eq(table.id,id));
        expect(await projection()).toEqual([]);
        await db.update(table).set({isActive:true}).where(eq(table.id,id));
        const outsideDate=target.scope==='business_unit'?'2026-12-22':'2026-12-23';
        const outsideDraft=await db.transaction(tx=>createLeaveDraftWithin(tx,scope,manager,otherId,{leaveTypeId:annual.id,startDate:outsideDate,endDate:outsideDate,unit:'full_day',reason:'Outside relative deny fixture'}));
        const outsideSubmitted=await db.transaction(tx=>submitLeaveApplicationWithin(tx,scope,manager,outsideDraft.id,outsideDraft.version));
        const outsideAllowed=await request('/api/my/approvals/'+outsideDraft.id+'/actions/approve','POST',{expectedVersion:outsideSubmitted.version,reason:'Outside relative deny scope'});
        expect(outsideAllowed.status,await outsideAllowed.clone().text()).toBe(200);
        await db.update(userPermissionOverride).set({revokedAt:new Date(),revokedByUserId:actorId,revocationReason:'Synthetic revoked deny'}).where(eq(userPermissionOverride.id,deny.id));
        expect(await projection()).toBeNull();
        expect(await db.select().from(leaveRequest).where(eq(leaveRequest.id,draft.id))).toEqual(original);
        expect(await db.select().from(approvalInstanceEvent).where(eq(approvalInstanceEvent.instanceId,instance.id))).toEqual(events);
      }
      await db.delete(userPermissionOverride).where(eq(userPermissionOverride.id,deny.id));
    }
    const permitted=await request('/api/my/approvals/'+draft.id+'/actions/approve','POST',{expectedVersion:submitted.version,reason:'Subject permission restored'});
    expect(permitted.status,await permitted.clone().text()).toBe(200);
    await db.update(userCompanyRoleScope).set({scope:'business_unit',targetType:'business_unit',targetId:String(unitId)}).where(eq(userCompanyRoleScope.assignmentId,assignmentId));
  });
  it('fails closed for unresolved relative denies in a blank Company and honors revoked/resolved controls',async()=>{
    const blank={masterFn:'M1',companyFn:'QA-BLANK'};
    await db.insert(company).values({...blank,name:'Fictional blank Company',country:'SG',currency:'SGD',taxRegime:'GST'});
    const allocations=await db.select().from(companyModule).where(eq(companyModule.companyFn,'C-SG'));
    await db.insert(companyModule).values(allocations.map(row=>({...row,companyFn:blank.companyFn})));
    const [seedUser]=await db.select().from(appUser).where(eq(appUser.userId,viewerId));
    const [actor]=await db.insert(appUser).values({masterFn:'M1',username:'blank-company-actor',fullName:'Fictional blank actor',passwordHash:seedUser.passwordHash}).returning();
    const [companyRole]=await db.insert(role).values({...blank,name:'Explicit blank Company HR'}).returning();
    await db.insert(rolePermission).values(['hr.read','hr.write'].map(permissionKey=>({masterFn:'M1',roleId:companyRole.roleId,permissionKey,allowed:true})));
    await db.insert(userCompany).values({companyFn:blank.companyFn,userId:actor.userId,roleId:companyRole.roleId});
    const [assignment]=await db.insert(userCompanyRole).values({companyFn:blank.companyFn,userId:actor.userId,roleId:companyRole.roleId,scopeBackfilledAt:new Date()}).returning();
    await db.insert(userCompanyRoleScope).values({...blank,assignmentId:assignment.assignmentId,resourceKey:'hr/*',scope:'company',targetType:'company',targetId:blank.companyFn});
    const session={userId:actor.userId,masterFn:'M1',activeCompanyFn:blank.companyFn,username:'blank-company-actor',email:null,fullName:null};
    const projection=(resource:string,permission='hr.write')=>db.transaction(tx=>resolveHrEmployeeAccessWithin(tx,session,resource,permission));
    expect(await db.select().from(employee).where(eq(employee.companyFn,blank.companyFn))).toEqual([]);
    expect(await projection('hr/employees')).toBeNull();
    const auth=cookies(await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({organizationCode:'ACME',username:'blank-company-actor',password:'viewer1234'})}));
    for(const dimension of ['business_unit','position']){
      for(const resource of ['hr/employees','hr/leave-requests']){
        const [deny]=await db.insert(userPermissionOverride).values({...blank,userId:actor.userId,permissionKey:'hr.write',resourceKey:resource,effect:'deny',scope:dimension,targetType:'none',targetId:'',reason:'Synthetic blank relative deny',assignedByUserId:actorId}).returning();
        expect(await projection(resource)).toEqual([]);
        const path=resource==='hr/employees'?'/api/hr/organization/business_unit':'/api/hr/leave-workflows';
        const denied=await fetch(base+path,{method:'POST',headers:{cookie:auth.cookie,'content-type':'application/json','x-csrf-token':auth.csrf,'idempotency-key':'blank-'+dimension+'-'+resource},body:JSON.stringify({employeeId:targetId})});
        expect(denied.status,await denied.clone().text()).toBe(403);
        expect((await denied.json()).error.code).toBe('data_scope_denied');
        await db.update(userPermissionOverride).set({revokedAt:new Date(),revokedByUserId:actorId,revocationReason:'Synthetic revoked blank deny'}).where(eq(userPermissionOverride.id,deny.id));
        expect(await projection(resource)).toBeNull();
      }
    }
    const [unit]=await db.insert(businessUnit).values({...blank,code:'BLANK-UNIT',name:'Fictional Unit'}).returning();
    const [position]=await db.insert(hrPosition).values({...blank,code:'BLANK-POS',name:'Fictional Position'}).returning();
    const values={...blank,fullName:'Fictional resolved staff',email:'blank@example.invalid',department:'Synthetic',jobTitle:'Synthetic',startDate:'2026-01-01',baseSalary:'1000.00'};
    const [linked]=await db.insert(employee).values({...values,employeeNo:'QA-BLANK-ACTOR',userId:actor.userId,businessUnitId:unit.id,positionId:position.id}).returning();
    const [outside]=await db.insert(employee).values({...values,employeeNo:'QA-BLANK-OUTSIDE'}).returning();
    for(const dimension of ['business_unit','position']){
      const [deny]=await db.insert(userPermissionOverride).values({...blank,userId:actor.userId,permissionKey:'hr.write',resourceKey:'hr/employees',effect:'deny',scope:dimension,targetType:'none',targetId:'',reason:'Synthetic resolved deny',assignedByUserId:actorId}).returning();
      expect(await projection('hr/employees')).toEqual([outside.id]);
      expect(await projection('hr/employees')).not.toContain(linked.id);
      await db.delete(userPermissionOverride).where(eq(userPermissionOverride.id,deny.id));
    }
  });
  it('accepts canonical-only scoped reads and actions without widening to other staff',async()=>{
    const [assignedRole]=await db.select().from(userCompanyRole).where(eq(userCompanyRole.assignmentId,assignmentId));
    await db.delete(rolePermission).where(eq(rolePermission.roleId,assignedRole.roleId));
    await db.insert(rolePermission).values(['hr.employees.view','hr.leave_requests.view','hr.leave_requests.approve'].map(permissionKey=>({masterFn:'M1',roleId:assignedRole.roleId,permissionKey,allowed:true})));
    expect((await request('/api/hr/employees/'+targetId)).status).toBe(200);
    expect((await request('/api/hr/employees/'+otherId)).status).toBe(404);
    const [inside]=await db.insert(leaveRequest).values({...scope,employeeId:targetId,leaveType:'Unpaid',startDate:'2026-12-18',endDate:'2026-12-18',days:'1.00',reason:'Canonical fixture',status:'pending'}).returning();
    const [outside]=await db.insert(leaveRequest).values({...scope,employeeId:otherId,leaveType:'Unpaid',startDate:'2026-12-19',endDate:'2026-12-19',days:'1.00',reason:'Canonical fixture',status:'pending'}).returning();
    expect((await request('/api/hr/leave-requests/'+inside.id)).status).toBe(200);
    expect((await request('/api/hr/leave-requests/'+inside.id+'/actions/approve','POST',{})).status).toBe(200);
    expect((await request('/api/hr/leave-requests/'+outside.id+'/actions/approve','POST',{})).status).toBe(404);
    await db.delete(rolePermission).where(eq(rolePermission.roleId,assignedRole.roleId));
    await db.insert(rolePermission).values(['hr.read','hr.write'].map(permissionKey=>({masterFn:'M1',roleId:assignedRole.roleId,permissionKey,allowed:true})));
  });
  it('preserves explicit self/team projection and Company boundaries',async()=>{
    await db.update(userCompanyRoleScope).set({scope:'self',targetType:'none',targetId:''}).where(eq(userCompanyRoleScope.assignmentId,assignmentId));
    expect((await request('/api/hr/employees/'+viewerEmployee)).status).toBe(200);
    expect((await request('/api/hr/employees/'+targetId)).status).toBe(404);
    expect((await request('/api/hr/employees/'+targetId+'/history')).status).toBe(403);
    const linked={id:targetId};
    await db.update(employee).set({userId:actorId,managerId:viewerEmployee}).where(eq(employee.id,linked.id));
    await db.update(userCompanyRoleScope).set({scope:'team',targetType:'none',targetId:''}).where(eq(userCompanyRoleScope.assignmentId,assignmentId));
    expect((await request('/api/hr/employees/'+linked.id)).status).toBe(200);
    expect((await request('/api/hr/employees/'+linked.id+'/history')).status).toBe(200);
    expect((await request('/api/hr/employees/'+otherId)).status).toBe(404);
    await db.update(userCompanyRoleScope).set({scope:'company',targetType:'company',targetId:'C-SG'}).where(eq(userCompanyRoleScope.assignmentId,assignmentId));
    expect((await request('/api/hr/employees/'+otherId)).status).toBe(200);
    const [foreign]=await db.select().from(employee).where(eq(employee.companyFn,'C-MY')).limit(1);
    expect((await request('/api/hr/employees/'+foreign.id)).status).toBe(404);
    expect((await request('/api/hr/employees/'+foreign.id+'/history')).status).toBe(404);
  });
  it('supports explicit Position scope and removes access immediately on assignment/role changes',async()=>{
    await db.update(userCompanyRoleScope).set({scope:'position',targetType:'position',targetId:String(positionId)}).where(eq(userCompanyRoleScope.assignmentId,assignmentId));
    expect((await request('/api/hr/employees/'+targetId)).status).toBe(200);
    const [positionStaff]=await db.insert(employee).values({...scope,employeeNo:'QA-POSITION-END',fullName:'Fictional Position employee',email:'position-end@example.invalid',department:'Synthetic',jobTitle:'Synthetic',startDate:'2026-01-01',baseSalary:'1000.00',businessUnitId:unitId,positionId}).returning();
    const body={expectedUpdatedAt:positionStaff.updatedAt.toISOString(),reason:'Synthetic Position end'};
    expect((await request('/api/hr/employees/'+positionStaff.id+'/actions/end-employment','POST',body,'position-end')).status).toBe(200);
    const replay=await request('/api/hr/employees/'+positionStaff.id+'/actions/end-employment','POST',body,'position-end');
    expect(replay.status).toBe(200);expect(replay.headers.get('idempotency-replayed')).toBe('true');
    await assign(targetId,unitId,null,1);
    expect((await request('/api/hr/employees/'+targetId)).status).toBe(404);
    expect((await request('/api/hr/employees/'+targetId+'/history')).status).toBe(403);
    await db.update(userCompanyRole).set({revokedAt:new Date(),revokedByUserId:actorId,revocationReason:'Synthetic revocation'}).where(eq(userCompanyRole.assignmentId,assignmentId));
    expect((await request('/api/hr/employees')).status).toBe(403);
  });
});
