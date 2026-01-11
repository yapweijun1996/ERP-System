import pg from 'pg';
import dotenv from 'dotenv';
import { getCurrentDatabaseName } from './context.js';

dotenv.config();

const { Pool } = pg;

function envInt(name, fallback) {
    const raw = process.env[name];
    if (raw === undefined || raw === null || raw === '') return fallback;
    const n = Number.parseInt(String(raw), 10);
    return Number.isFinite(n) ? n : fallback;
}

function envBool(name, fallback = false) {
    const raw = process.env[name];
    if (raw === undefined || raw === null || raw === '') return fallback;
    const v = String(raw).trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(v)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(v)) return false;
    return fallback;
}

const logQueries = envBool('DB_LOG_QUERIES', false);
const exitOnPoolError = envBool('DB_EXIT_ON_POOL_ERROR', true);
const sslEnabled = envBool('DB_SSL', false) || String(process.env.PGSSLMODE || '').toLowerCase() === 'require';

function basePoolConfig(database) {
    return {
        host: process.env.DB_HOST || 'localhost',
        port: envInt('DB_PORT', 5432),
        database: database || process.env.DB_NAME || 'nexus_erp',
        user: process.env.DB_USER || process.env.USER,
        password: process.env.DB_PASSWORD || '',
        ssl: sslEnabled
            ? { rejectUnauthorized: envBool('DB_SSL_REJECT_UNAUTHORIZED', true) }
            : undefined,
        max: envInt('DB_POOL_MAX', 20),
        idleTimeoutMillis: envInt('DB_IDLE_TIMEOUT_MS', 30000),
        connectionTimeoutMillis: envInt('DB_CONN_TIMEOUT_MS', 5000),
    };
}

const pools = new Map();
const poolOrder = [];
const poolCacheMax = envInt('DB_POOL_CACHE_MAX', 20);

function attachPoolLogging(pool, label) {
    let didLogFirstConnect = false;
    pool.on('connect', () => {
        if (didLogFirstConnect) return;
        didLogFirstConnect = true;
        console.log(`✅ Database pool connected${label ? `: ${label}` : ''}`);
    });
    pool.on('error', (err) => {
        console.error('❌ Unexpected database error:', err);
        if (exitOnPoolError) process.exit(1);
    });
}

function getPool(databaseName) {
    const db = databaseName || process.env.DB_NAME || 'nexus_erp';
    const cached = pools.get(db);
    if (cached) return cached;

    const pool = new Pool(basePoolConfig(db));
    attachPoolLogging(pool, db);
    pools.set(db, pool);
    poolOrder.push(db);

    while (poolOrder.length > poolCacheMax) {
        const oldest = poolOrder.shift();
        if (!oldest) break;
        const oldPool = pools.get(oldest);
        pools.delete(oldest);
        if (oldPool) oldPool.end().catch(() => { });
    }

    return pool;
}

function getCurrentPool() {
    const dbFromContext = getCurrentDatabaseName();
    return getPool(dbFromContext);
}

/**
 * Execute a query
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
export const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await getCurrentPool().query(text, params);
        const duration = Date.now() - start;
        if (logQueries) {
            console.log('📊 Query executed', {
                text: String(text).substring(0, 80),
                durationMs: duration,
                rows: res.rowCount
            });
        }
        return res;
    } catch (error) {
        console.error('❌ Query error:', error);
        throw error;
    }
};

/**
 * Get a client from the pool for transactions
 * @returns {Promise<Object>} Database client
 */
export const getClient = async () => {
    const client = await getCurrentPool().connect();
    const query = client.query;
    const release = client.release;

    // Set a timeout of 5 seconds, after which we will log this client's last query
    const timeout = setTimeout(() => {
        console.error('⚠️  A client has been checked out for more than 5 seconds!');
    }, 5000);

    // Monkey patch the query method to keep track of the last query executed
    client.query = (...args) => {
        client.lastQuery = args;
        return query.apply(client, args);
    };

    client.release = () => {
        clearTimeout(timeout);
        client.query = query;
        client.release = release;
        return release.apply(client);
    };

    return client;
};

/**
 * Execute a transaction
 * @param {Function} callback - Transaction callback function
 * @returns {Promise<any>} Transaction result
 */
export const transaction = async (callback) => {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Test database connection
 * @returns {Promise<boolean>} Connection status
 */
export const testConnection = async () => {
    try {
        const result = await query('SELECT NOW() as now');
        console.log('✅ Database connection test successful:', result.rows[0].now);
        return true;
    } catch (error) {
        console.error('❌ Database connection test failed:', error.message);
        return false;
    }
};

export default {
    query,
    getClient,
    transaction,
    testConnection,
    getPool
};
