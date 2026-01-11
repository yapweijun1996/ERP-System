import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { testConnection } from './db/index.js';
import { companyDbContextMiddleware } from './middleware/companyDbContext.js';
import { authenticate } from './middleware/auth.js';
import { csrfProtection } from './middleware/csrf.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// MIDDLEWARE
// ============================================

// Security headers
app.use(helmet());

// CORS configuration
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:6600',
    process.env.CORS_ORIGIN
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Per-request DB selection (by login url ?company=... or token companyId)
app.use(companyDbContextMiddleware);

// CSRF protection (only enforced when auth token is sent via cookie)
app.use(csrfProtection);

// Logging
app.use(morgan('dev'));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.path}`);
    next();
});

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// API info
app.get('/api', (req, res) => {
    res.json({
        name: 'Nexus ERP API',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            tenants: '/api/tenants',
            companies: '/api/companies',
            users: '/api/users',
            sales: '/api/sales',
            inventory: '/api/inventory',
            finance: '/api/finance'
        }
    });
});

// Setup routes (no auth required)
import setupRoutes from './routes/setup/index.js';
app.use('/api/setup', setupRoutes);

// Auth routes
import authRoutes from './routes/auth.js';
app.use('/api/auth', authRoutes);

// Tenant routes
import tenantRoutes from './routes/tenants.js';
app.use('/api/tenants', authenticate(), tenantRoutes);

// Company routes
import companyRoutes from './routes/companies.js';
app.use('/api/companies', authenticate(), companyRoutes);

// User routes
import userRoutes from './routes/users.js';
app.use('/api/users', authenticate(), userRoutes);

// Sales routes
import salesRoutes from './routes/sales.js';
import hrRoutes from './routes/hr.js';
import inventoryRoutes from './routes/inventory.js';
app.use('/api/sales', authenticate(), salesRoutes);
app.use('/api/hr', authenticate(), hrRoutes);
app.use('/api/inventory', inventoryRoutes);


// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`,
        path: req.path
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Error:', err);

    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';

    res.status(status).json({
        error: err.name || 'Error',
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ============================================
// SERVER STARTUP
// ============================================

const startServer = async () => {
    try {
        // Test database connection (but don't fail if database doesn't exist)
        console.log('🔍 Testing database connection...');
        const dbConnected = await testConnection();

        if (!dbConnected) {
            console.warn('⚠️  Database not connected. Setup wizard will be available.');
            console.warn('⚠️  Please configure database using the frontend setup wizard or run: cd .database && ./setup.sh');
        }

        // Start server regardless of database status
        app.listen(PORT, () => {
            console.log('');
            console.log('╔════════════════════════════════════════╗');
            console.log('║     Nexus ERP API Server Started      ║');
            console.log('╚════════════════════════════════════════╝');
            console.log('');
            console.log(`🚀 Server running on: http://localhost:${PORT}`);
            console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🗄️  Database: ${process.env.DB_NAME || 'nexus_erp'} ${dbConnected ? '✅' : '⚠️  (not connected)'}`);
            console.log(`🌐 CORS enabled for: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
            console.log('');
            console.log('📝 API Documentation: http://localhost:' + PORT + '/api');
            console.log('💚 Health Check: http://localhost:' + PORT + '/health');
            if (!dbConnected) {
                console.log('🔧 Database Setup: http://localhost:' + PORT + '/api/setup/status');
            }
            console.log('');
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('⚠️  SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('⚠️  SIGINT received, shutting down gracefully...');
    process.exit(0);
});

// Start the server
startServer();
