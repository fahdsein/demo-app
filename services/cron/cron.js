const cron = require('node-cron');
const pool = require('@app/shared');

async function runDailyReport() {
  const result = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
      COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed,
      COUNT(*) FILTER (WHERE status IN ('PENDING', 'PROCESSING'))::int AS active
    FROM memes
    WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
  `);
  const summary = result.rows[0];
  console.log('[CRON] Rolling 24-hour report', summary);
  return summary;
}

let task;
let shuttingDown = false;

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (task) task.stop();
  console.log(`[CRON] Received ${signal}; shutting down`);
  await pool.closeDatabase();
  process.exit(exitCode);
}

async function main() {
  if (process.argv.includes('--run-once')) {
    await runDailyReport();
    await shutdown('run-once');
    return;
  }

  task = cron.schedule('0 0 * * *', () => {
    runDailyReport().catch((error) => {
      console.error('[CRON] Report failed', { message: error.message });
    });
  }, {
    timezone: process.env.CRON_TIMEZONE || 'UTC'
  });
  console.log('[CRON] Service active', {
    timezone: process.env.CRON_TIMEZONE || 'UTC'
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch(async (error) => {
  console.error('[CRON] Startup failed', { message: error.message });
  await shutdown('startup-error', 1);
});

module.exports = { runDailyReport };
