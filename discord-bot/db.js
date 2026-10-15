const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5433,
    user: process.env.DB_USER || 'jarvis',
    password: process.env.DB_PASSWORD || 'jarvis_secure_pass_2026',
    database: process.env.DB_NAME || 'jarvis',
    max: 10,
    idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
    console.error('❌ PostgreSQL Pool error:', err.message);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
