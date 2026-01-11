import pg from 'pg';

const { Client } = pg;

export function getBaseDbConfig() {
    return {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER || process.env.USER,
        password: process.env.DB_PASSWORD || '',
    };
}

export function createClient(database) {
    return new Client({
        ...getBaseDbConfig(),
        database,
    });
}

