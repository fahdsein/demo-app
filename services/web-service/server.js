const express = require('express');
const cors = require('cors');
const { Queue } = require('bullmq');
const pool = require('@app/shared');
const {
  ValidationError,
  validateGeneratePayload
} = require('./validation');

const port = Number.parseInt(process.env.PORT || '4000', 10);
const redisPort = Number.parseInt(process.env.REDIS_PORT || '6379', 10);
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));

if (process.env.CORS_ORIGIN) {
  app.use(cors({
    origin: process.env.CORS_ORIGIN,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
  }));
}

const memeQueue = new Queue('meme-generation', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number.isFinite(redisPort) ? redisPort : 6379
  }
});

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.get('/ready', async (_request, response) => {
  try {
    await pool.checkDatabase();
    await memeQueue.waitUntilReady();
    response.json({ status: 'ready' });
  } catch (error) {
    console.error('[API] Readiness check failed', { message: error.message });
    response.status(503).json({ status: 'not_ready' });
  }
});

app.post('/api/generate', async (request, response) => {
  let memeId;

  try {
    const payload = validateGeneratePayload(request.body);
    const insertResult = await pool.query(
      `INSERT INTO memes (template_name, top_text, bottom_text, status)
       VALUES ($1, $2, $3, 'PENDING')
       RETURNING id`,
      [payload.templateName, payload.topText, payload.bottomText]
    );
    memeId = insertResult.rows[0].id;

    try {
      await memeQueue.add('generate-meme', { memeId, ...payload }, {
        jobId: `meme-${memeId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 100
      });
    } catch (queueError) {
      await pool.query(
        `UPDATE memes
         SET status = 'QUEUE_FAILED',
             error_message = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        ['Queue submission failed', memeId]
      );
      console.error('[API] Queue submission failed', {
        memeId,
        message: queueError.message
      });
      return response.status(503).json({
        error: 'Generation service is temporarily unavailable.'
      });
    }

    return response.status(202).json({
      success: true,
      memeId,
      status: 'PENDING',
      message: 'Meme generation queued.'
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return response.status(400).json({ error: error.message });
    }

    console.error('[API] Generate request failed', {
      memeId,
      message: error.message
    });
    return response.status(500).json({
      error: 'Unable to create the meme request.'
    });
  }
});

app.get('/api/memes', async (request, response) => {
  const requestedLimit = Number.parseInt(request.query.limit || '20', 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 100)
    : 20;

  try {
    const result = await pool.query(
      `SELECT id, template_name, status, image_url, created_at, updated_at
       FROM memes
       ORDER BY created_at DESC, id DESC
       LIMIT $1`,
      [limit]
    );
    return response.json(result.rows);
  } catch (error) {
    console.error('[API] Feed query failed', { message: error.message });
    return response.status(500).json({ error: 'Unable to load memes.' });
  }
});

app.get('/api/memes/:id', async (request, response) => {
  const id = Number.parseInt(request.params.id, 10);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return response.status(400).json({ error: 'Invalid meme ID.' });
  }

  try {
    const result = await pool.query(
      `SELECT id, template_name, status, image_url, created_at, updated_at
       FROM memes
       WHERE id = $1`,
      [id]
    );
    if (result.rowCount === 0) {
      return response.status(404).json({ error: 'Meme not found.' });
    }
    return response.json(result.rows[0]);
  } catch (error) {
    console.error('[API] Meme query failed', { id, message: error.message });
    return response.status(500).json({ error: 'Unable to load the meme.' });
  }
});

app.use((error, _request, response, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return response.status(400).json({ error: 'Request body must be valid JSON.' });
  }
  return next(error);
});

app.use((_request, response) => {
  response.status(404).json({ error: 'Not found.' });
});

app.use((error, _request, response, _next) => {
  console.error('[API] Unhandled request error', { message: error.message });
  response.status(500).json({ error: 'Unexpected server error.' });
});

const server = app.listen(port, () => {
  console.log(`[API] Listening on port ${port}`);
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[API] Received ${signal}; shutting down`);

  server.close(async () => {
    await Promise.allSettled([
      memeQueue.close(),
      pool.closeDatabase()
    ]);
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
