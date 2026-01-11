import express from 'express';
import pg from 'pg';

const router = express.Router();
const { Client } = pg;

router.post('/', async (req, res) => {
    try {
        const { host, port, database, user, password } = req.body;

        const client = new Client({
            host: host || 'localhost',
            port: port || 5432,
            database: database || 'postgres',
            user: user || process.env.USER,
            password: password || '',
        });

        await client.connect();
        await client.query('SELECT NOW()');
        await client.end();

        res.json({
            success: true,
            message: 'Connection successful'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Connection Failed',
            message: error.message
        });
    }
});

export default router;

