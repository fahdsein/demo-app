const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const poolSize = Number.parseInt(process.env.DB_POOL_MAX || '10', 10);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number.isFinite(poolSize) && poolSize > 0 ? poolSize : 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000
});

pool.on('error', (error) => {
  console.error('[DB] Unexpected idle-client error', {
    message: error.message
  });
});

async function checkDatabase() {
  await pool.query('SELECT 1');
}

async function closeDatabase() {
  await pool.end();
}

module.exports = {
  query: (...args) => pool.query(...args),
  checkDatabase,
  closeDatabase
};
