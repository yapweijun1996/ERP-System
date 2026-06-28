/* ============================================================
   MasterStore — data access for the Super-Admin "Master Control"
   console. Backs the platform's master accounts (tenants), their
   company legal entities and users with real CRUD.

   Primary backend  : PGlite (in-browser PostgreSQL, persisted to
                      IndexedDB at idb://aria-erp — the same database
                      the Database Workbench reads/writes).
   Fallback backend : an in-memory mirror of DB.masters, used only
                      when the PGlite WASM can't be fetched (e.g. no
                      network). CRUD still works for the session.

   Every screen calls `await MasterStore.ready` once, then uses the
   async list()/create…/update…/delete… methods below.
   ============================================================ */
const MasterStore = (function () {
  const PLAN_MODULES = { Starter: 5, Business: 10, Enterprise: 16 };
  const PGLITE_URL = 'https://cdn.jsdelivr.net/npm/@electric-sql/pglite/dist/index.js';

  let db = null;
  let backend = 'memory';
  let resolveReady;
  let bootStarted = false;
  const ready = new Promise((r) => (resolveReady = r));

  /* session mirror — deep clone so edits don't mutate the seed data */
  const mem = JSON.parse(JSON.stringify(DB.masters));

  const DDL = `
    CREATE TABLE IF NOT EXISTS master_account (
      id text PRIMARY KEY, name text NOT NULL,
      plan text NOT NULL DEFAULT 'Starter', region text,
      status text NOT NULL DEFAULT 'Active', owner text,
      modules integer NOT NULL DEFAULT 0,
      is_current boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS master_company (
      id text PRIMARY KEY,
      master_id text NOT NULL REFERENCES master_account(id) ON DELETE CASCADE,
      name text NOT NULL, cur text NOT NULL DEFAULT 'USD',
      branches integer NOT NULL DEFAULT 1,
      status text NOT NULL DEFAULT 'Active',
      is_current boolean NOT NULL DEFAULT false);
    CREATE TABLE IF NOT EXISTS master_user (
      id text PRIMARY KEY,
      master_id text NOT NULL REFERENCES master_account(id) ON DELETE CASCADE,
      name text NOT NULL, email text, role text, access text,
      status text NOT NULL DEFAULT 'Active',
      last_active text DEFAULT 'Just now');`;

  function nextId(prefix, ids) {
    let max = 0;
    ids.forEach((s) => {
      const m = /(\d+)\s*$/.exec(s || '');
      if (m && +m[1] > max) max = +m[1];
    });
    return prefix + '-' + String(max + 1).padStart(4, '0');
  }

  /* seed the master_* tables from the in-memory DB.masters data */
  async function seedFromJs() {
    for (const m of DB.masters) {
      await db.query(
        'INSERT INTO master_account (id,name,plan,region,status,owner,modules,is_current) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING',
        [m.id, m.name, m.plan, m.region, m.status, m.owner, m.modules, !!m.current]
      );
      for (const c of m.companies)
        await db.query(
          'INSERT INTO master_company (id,master_id,name,cur,branches,status,is_current) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING',
          [c.id, m.id, c.name, c.cur, c.branches, c.status, !!c.current]
        );
      for (const u of m.users)
        await db.query(
          'INSERT INTO master_user (id,master_id,name,email,role,access,status,last_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING',
          [u.id, m.id, u.name, u.email, u.role, u.access, u.status, u.last]
        );
    }
  }

  async function boot() {
    try {
      const mod = await import(PGLITE_URL);
      db = new mod.PGlite('idb://aria-erp'); // shared, persisted to IndexedDB
      await db.waitReady;
      await db.exec(DDL);
      const n = (await db.query('SELECT count(*)::int AS n FROM master_account')).rows[0].n;
      if (!n) await seedFromJs();
      backend = 'pg';
    } catch (e) {
      backend = 'memory';
      console.warn('MasterStore: PGlite unavailable — using in-memory fallback.', e && e.message ? e.message : e);
    }
    resolveReady(backend);
  }

  function ensureReady() {
    if (!bootStarted) {
      bootStarted = true;
      boot();
    }
    return ready;
  }

  /* ---- reads ---- */
  async function list() {
    await ensureReady();
    if (backend === 'pg') {
      const ms = (await db.query('SELECT * FROM master_account ORDER BY created_at, id')).rows;
      const cs = (await db.query('SELECT * FROM master_company ORDER BY id')).rows;
      const us = (await db.query('SELECT * FROM master_user ORDER BY id')).rows;
      return ms.map((m) => ({
        id: m.id, name: m.name, plan: m.plan, region: m.region, status: m.status,
        owner: m.owner, modules: m.modules, current: m.is_current,
        companies: cs.filter((c) => c.master_id === m.id).map((c) => ({
          id: c.id, name: c.name, cur: c.cur, branches: c.branches, status: c.status, current: c.is_current,
        })),
        users: us.filter((u) => u.master_id === m.id).map((u) => ({
          id: u.id, name: u.name, email: u.email, role: u.role, access: u.access, status: u.status, last: u.last_active,
        })),
      }));
    }
    return JSON.parse(JSON.stringify(mem));
  }

  /* ---- master account CRUD ---- */
  async function createMaster(d) {
    await ensureReady();
    const modules = PLAN_MODULES[d.plan] || 5;
    if (backend === 'pg') {
      const ids = (await db.query('SELECT id FROM master_account')).rows.map((r) => r.id);
      const id = nextId('MST', ids);
      await db.query(
        'INSERT INTO master_account (id,name,plan,region,status,owner,modules) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [id, d.name, d.plan, d.region, d.status, d.owner, modules]
      );
      return id;
    }
    const id = nextId('MST', mem.map((m) => m.id));
    mem.push({ id, name: d.name, plan: d.plan, region: d.region, status: d.status, owner: d.owner, modules, current: false, companies: [], users: [] });
    return id;
  }

  async function updateMaster(id, d) {
    await ensureReady();
    if (backend === 'pg') {
      await db.query(
        'UPDATE master_account SET name=$2, plan=$3, region=$4, status=$5, owner=$6 WHERE id=$1',
        [id, d.name, d.plan, d.region, d.status, d.owner]
      );
      return;
    }
    const m = mem.find((x) => x.id === id);
    if (m) Object.assign(m, { name: d.name, plan: d.plan, region: d.region, status: d.status, owner: d.owner });
  }

  async function deleteMaster(id) {
    await ensureReady();
    if (backend === 'pg') { await db.query('DELETE FROM master_account WHERE id=$1', [id]); return; }
    const i = mem.findIndex((x) => x.id === id);
    if (i >= 0) mem.splice(i, 1);
  }

  /* ---- company CRUD ---- */
  async function addCompany(masterId, d) {
    await ensureReady();
    if (backend === 'pg') {
      const ids = (await db.query('SELECT id FROM master_company')).rows.map((r) => r.id);
      const id = nextId('CMP', ids);
      await db.query(
        'INSERT INTO master_company (id,master_id,name,cur,branches,status) VALUES ($1,$2,$3,$4,$5,$6)',
        [id, masterId, d.name, d.cur, d.branches, d.status]
      );
      return id;
    }
    const m = mem.find((x) => x.id === masterId);
    const id = nextId('CMP', mem.flatMap((x) => x.companies.map((c) => c.id)));
    if (m) m.companies.push({ id, name: d.name, cur: d.cur, branches: d.branches, status: d.status, current: false });
    return id;
  }

  async function deleteCompany(masterId, id) {
    await ensureReady();
    if (backend === 'pg') { await db.query('DELETE FROM master_company WHERE id=$1', [id]); return; }
    const m = mem.find((x) => x.id === masterId);
    if (m) m.companies = m.companies.filter((c) => c.id !== id);
  }

  /* ---- user CRUD ---- */
  async function addUser(masterId, d) {
    await ensureReady();
    if (backend === 'pg') {
      const ids = (await db.query('SELECT id FROM master_user')).rows.map((r) => r.id);
      const id = nextId('USR', ids);
      await db.query(
        'INSERT INTO master_user (id,master_id,name,email,role,access,status,last_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [id, masterId, d.name, d.email, d.role, d.access, 'Active', 'Invited']
      );
      return id;
    }
    const m = mem.find((x) => x.id === masterId);
    const id = nextId('USR', mem.flatMap((x) => x.users.map((u) => u.id)));
    if (m) m.users.push({ id, name: d.name, email: d.email, role: d.role, access: d.access, status: 'Active', last: 'Invited' });
    return id;
  }

  async function deleteUser(masterId, id) {
    await ensureReady();
    if (backend === 'pg') { await db.query('DELETE FROM master_user WHERE id=$1', [id]); return; }
    const m = mem.find((x) => x.id === masterId);
    if (m) m.users = m.users.filter((u) => u.id !== id);
  }

  return {
    ready,
    ensureReady,
    list,
    createMaster, updateMaster, deleteMaster,
    addCompany, deleteCompany,
    addUser, deleteUser,
    get backend() { return backend; },
    backendLabel() {
      return backend === 'pg' ? 'PGlite · persisted' : 'In-memory (offline)';
    },
  };
})();
