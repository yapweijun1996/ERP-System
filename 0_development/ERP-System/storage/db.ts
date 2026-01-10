import { User } from '../types';
import { MOCK_USERS } from '../constants';

const DB_NAME = 'NexusERP_v1';
const STORE_USERS = 'users';
const DB_VERSION = 1;

export const initDB = async (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_USERS)) {
        const store = db.createObjectStore(STORE_USERS, { keyPath: 'id' });
        store.createIndex('email', 'email', { unique: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getAllUsers = async (): Promise<User[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_USERS, 'readonly');
    const store = tx.objectStore(STORE_USERS);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

export const saveUser = async (user: User): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_USERS, 'readwrite');
    const store = tx.objectStore(STORE_USERS);
    const req = store.put(user);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export const seedUsersIfEmpty = async (): Promise<User[]> => {
    try {
        const users = await getAllUsers();
        if (users.length > 0) return users;

        // Seed MOCK_USERS with default password if empty
        const seeded = MOCK_USERS.map(u => ({
            ...u, 
            password: 'password' // Default mock password
        }));
        
        for (const u of seeded) {
            await saveUser(u);
        }
        return seeded;
    } catch (e) {
        console.error("DB Seed Error:", e);
        return [];
    }
};