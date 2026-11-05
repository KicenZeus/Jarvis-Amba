const { Pool } = require('pg');

let poolConfig = {};

if (process.env.DATABASE_URL) {
    const isLocalhost = process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1');
    poolConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: isLocalhost || process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    };
} else {
    poolConfig = {
        host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
        port: parseInt(process.env.DB_PORT || process.env.PGPORT, 10) || 5433,
        user: process.env.DB_USER || process.env.PGUSER || 'jarvis',
        password: process.env.DB_PASSWORD || process.env.PGPASSWORD || 'jarvis_secure_pass_2026',
        database: process.env.DB_NAME || process.env.PGDATABASE || 'jarvis',
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };
}

poolConfig.max = 10;
poolConfig.idleTimeoutMillis = 30000;

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
    console.error('❌ PostgreSQL Pool error:', err.message);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
