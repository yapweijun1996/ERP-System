module.exports = {
    apps: [{
        name: 'nexus-erp-api',
        script: 'src/index.js',
        cwd: '/Users/yapweijun/Documents/GitHub/ERP-System/0_development/ERP-System/server',
        instances: 2,
        exec_mode: 'cluster',
        env: {
            NODE_ENV: 'development',
            PORT: 3001
        },
        env_production: {
            NODE_ENV: 'production',
            PORT: 3001
        },
        error_file: './logs/err.log',
        out_file: './logs/out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        merge_logs: true,
        autorestart: true,
        max_memory_restart: '1G',
        watch: false,
        ignore_watch: ['node_modules', 'logs'],
        max_restarts: 10,
        min_uptime: '10s'
    }]
};
