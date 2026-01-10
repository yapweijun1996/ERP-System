
import { SystemLog, BackgroundJob } from '../types';

export const MOCK_SYSTEM_LOGS: SystemLog[] = [
    { 
        id: 'log-10293', timestamp: new Date().toISOString(), level: 'ERROR', 
        module: 'BILLING', message: 'Failed to generate PDF for INV-2023-001. Timeout waiting for renderer.', 
        traceId: 'req-99812aa', clientId: 'client-a'
    },
    { 
        id: 'log-10292', timestamp: new Date(Date.now() - 5000).toISOString(), level: 'INFO', 
        module: 'AUTH', message: 'User Alice Admin logged in successfully.', 
        traceId: 'req-99812ab', clientId: 'client-a'
    },
    { 
        id: 'log-10291', timestamp: new Date(Date.now() - 15000).toISOString(), level: 'WARN', 
        module: 'INVENTORY', message: 'Negative stock detected during adjustment transaction.', 
        traceId: 'req-99812ac', clientId: 'client-b'
    },
    { 
        id: 'log-10290', timestamp: new Date(Date.now() - 60000).toISOString(), level: 'DEBUG', 
        module: 'API', message: 'Incoming webhook from Stripe. Payload size: 4kb.', 
        traceId: 'req-99812ad'
    },
    { 
        id: 'log-10289', timestamp: new Date(Date.now() - 120000).toISOString(), level: 'INFO', 
        module: 'JOBS', message: 'Nightly reconciliation job started.', 
        traceId: 'req-99812ae'
    },
];

export const MOCK_BACKGROUND_JOBS: BackgroundJob[] = [
    {
        id: 'job-551', name: 'E-Commerce Order Sync', status: 'FAILED', progress: 45,
        clientId: 'client-a', startedAt: new Date(Date.now() - 3600000).toISOString(),
        retries: 3, error: 'Connection reset by peer (Shopify API)', nextRetry: new Date(Date.now() + 600000).toISOString()
    },
    {
        id: 'job-552', name: 'Monthly Invoice Generation', status: 'COMPLETED', progress: 100,
        clientId: 'client-a', startedAt: new Date(Date.now() - 7200000).toISOString(),
        retries: 0
    },
    {
        id: 'job-553', name: 'Data Export (Audit)', status: 'RUNNING', progress: 62,
        clientId: 'client-b', startedAt: new Date(Date.now() - 300000).toISOString(),
        retries: 0
    }
];