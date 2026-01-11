import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage();

export function runWithDbContext(context, fn) {
    return storage.run(context, fn);
}

export function getDbContext() {
    return storage.getStore() || null;
}

export function getCurrentCompanyId() {
    return getDbContext()?.companyId || null;
}

export function getCurrentDatabaseName() {
    return getDbContext()?.databaseName || null;
}

