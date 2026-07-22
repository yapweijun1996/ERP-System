import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { appUser, project, projectTimeEntry } from '../../data/schema';
import { seedDemo } from '../../data/seed';
import { freshDb } from '../../test/helpers';
import {
  createProjectTimeEntry,
  ProjectTimeEntryError,
  voidProjectTimeEntry,
} from './timeEntry';

const SCOPE = { masterFn: 'M1', companyFn: 'C-SG' };

async function fixture() {
  const db = await freshDb();
  await seedDemo(db);
  const [admin] = await db.select({ id: appUser.userId }).from(appUser).where(and(
    eq(appUser.masterFn, 'M1'),
    eq(appUser.email, 'admin@acme.co'),
  ));
  const [viewer] = await db.select({ id: appUser.userId }).from(appUser).where(and(
    eq(appUser.masterFn, 'M1'),
    eq(appUser.email, 'viewer@acme.co'),
  ));
  const projects = await db.select({ id: project.id, status: project.status }).from(project)
    .where(and(eq(project.masterFn, 'M1'), eq(project.companyFn, 'C-SG')));
  return {
    db,
    adminId: admin.id,
    viewerId: viewer.id,
    openProjectId: projects.find((row) => row.status === 'open')!.id,
    heldProjectId: projects.find((row) => row.status === 'on_hold')!.id,
  };
}

describe('project time entries', () => {
  it('records a tenant- and actor-scoped Decimal time fact', async () => {
    const { db, adminId, openProjectId } = await fixture();
    const created = await createProjectTimeEntry(db, SCOPE, adminId, {
      projectId: openProjectId,
      workDate: '2026-07-20',
      task: '  Commissioning review  ',
      hours: '2.50',
    });
    expect(created).toMatchObject({
      actorUserId: adminId,
      projectId: openProjectId,
      workDate: '2026-07-20',
      task: 'Commissioning review',
      hours: '2.50',
      status: 'active',
      version: 1,
    });
    expect(await db.select().from(projectTimeEntry).where(eq(projectTimeEntry.id, created.id)))
      .toEqual([expect.objectContaining({ masterFn: 'M1', companyFn: 'C-SG' })]);
  });

  it('rejects invalid dates, precision, daily hours and missing tasks', async () => {
    const { db, adminId, openProjectId } = await fixture();
    const base = { projectId: openProjectId, workDate: '2026-07-20', task: 'Review', hours: '1' };
    await expect(createProjectTimeEntry(db, SCOPE, adminId, { ...base, workDate: '2026-02-31' }))
      .rejects.toThrow(ProjectTimeEntryError);
    await expect(createProjectTimeEntry(db, SCOPE, adminId, { ...base, hours: '1.234' }))
      .rejects.toThrow(ProjectTimeEntryError);
    await expect(createProjectTimeEntry(db, SCOPE, adminId, { ...base, hours: '24.01' }))
      .rejects.toThrow(ProjectTimeEntryError);
    await expect(createProjectTimeEntry(db, SCOPE, adminId, { ...base, task: '   ' }))
      .rejects.toThrow(ProjectTimeEntryError);
  });

  it('rejects an unavailable or non-open project', async () => {
    const { db, adminId, heldProjectId } = await fixture();
    const base = { workDate: '2026-07-20', task: 'Review', hours: '1' };
    await expect(createProjectTimeEntry(db, SCOPE, adminId, {
      ...base, projectId: heldProjectId,
    })).rejects.toThrow('Time can only be logged to an open project.');
    await expect(createProjectTimeEntry(db, SCOPE, adminId, {
      ...base, projectId: 999_999,
    })).rejects.toThrow('Project is unavailable in this company.');
  });

  it('voids an owned entry without deleting or changing its hours', async () => {
    const { db, adminId, openProjectId } = await fixture();
    const created = await createProjectTimeEntry(db, SCOPE, adminId, {
      projectId: openProjectId, workDate: '2026-07-20', task: 'Incorrect code', hours: '3.25',
    });
    const voided = await voidProjectTimeEntry(
      db, SCOPE, adminId, created.id, 'Logged to the wrong task.',
    );
    expect(voided).toMatchObject({ status: 'voided', version: 2, voidReason: 'Logged to the wrong task.' });
    expect(voided.voidedAt).toBeInstanceOf(Date);
    expect(await db.select().from(projectTimeEntry).where(eq(projectTimeEntry.id, created.id)))
      .toEqual([expect.objectContaining({ hours: '3.25', status: 'voided' })]);
    await expect(voidProjectTimeEntry(db, SCOPE, adminId, created.id, 'Again'))
      .rejects.toThrow('Only an active time entry can be voided.');
  });

  it('does not let another company user void the actor-owned entry', async () => {
    const { db, adminId, viewerId, openProjectId } = await fixture();
    const created = await createProjectTimeEntry(db, SCOPE, adminId, {
      projectId: openProjectId, workDate: '2026-07-20', task: 'Owned work', hours: '1.50',
    });
    await expect(voidProjectTimeEntry(db, SCOPE, viewerId, created.id, 'Not mine'))
      .rejects.toThrow('Time entry is unavailable for this user.');
  });
});
