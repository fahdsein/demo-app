const fs = require('node:fs/promises');
const path = require('node:path');
const { Worker } = require('bullmq');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const pool = require('@app/shared');
const {
  buildMemeSvg,
  imageMimeType,
  resolveTemplatePath
} = require('./meme');

function requireEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const redisPort = Number.parseInt(process.env.REDIS_PORT || '6379', 10);
const bucketName = process.env.S3_BUCKET_NAME || 'memes-bucket';
const publicBaseUrl = requireEnvironment('S3_PUBLIC_BASE_URL').replace(/\/$/, '');
const s3 = new S3Client({
  endpoint: requireEnvironment('S3_ENDPOINT'),
  region: process.env.AWS_REGION || 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: requireEnvironment('AWS_ACCESS_KEY_ID'),
    secretAccessKey: requireEnvironment('AWS_SECRET_ACCESS_KEY')
  }
});

function validateJobData(data) {
  if (!data || !Number.isSafeInteger(Number(data.memeId)) || Number(data.memeId) <= 0) {
    throw new Error('Invalid meme job ID');
  }
  if (typeof data.templateName !== 'string') throw new Error('Invalid template name');
  if (typeof data.topText !== 'string' || typeof data.bottomText !== 'string') {
    throw new Error('Invalid meme text');
  }

  return {
    memeId: Number(data.memeId),
    templateName: data.templateName,
    topText: data.topText,
    bottomText: data.bottomText
  };
}

const worker = new Worker('meme-generation', async (job) => {
  const payload = validateJobData(job.data);
  const { memeId, templateName, topText, bottomText } = payload;

  try {
    await pool.query(
      `UPDATE memes
       SET status = 'PROCESSING', error_message = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [memeId]
    );

    const fixtureDirectory = path.join(__dirname, 'fixtures');
    const templatePath = resolveTemplatePath(templateName, fixtureDirectory);
    const templateBytes = await fs.readFile(templatePath);
    const imageDataUri = `data:${imageMimeType(templatePath)};base64,${templateBytes.toString('base64')}`;
    const svg = buildMemeSvg({ imageDataUri, topText, bottomText });
    const objectKey = `memes/${memeId}-${Date.now()}.svg`;

    await s3.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: svg,
      ContentType: 'image/svg+xml',
      CacheControl: 'public, max-age=31536000, immutable'
    }));

    const imageUrl = `${publicBaseUrl}/${bucketName}/${objectKey}`;
    await pool.query(
      `UPDATE memes
       SET status = 'COMPLETED', image_url = $1, error_message = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [imageUrl, memeId]
    );

    console.log('[WORKER] Meme completed', { memeId });
    return { memeId, imageUrl };
  } catch (error) {
    const maximumAttempts = Number(job.opts.attempts || 1);
    const isFinalAttempt = job.attemptsMade + 1 >= maximumAttempts;
    const status = isFinalAttempt ? 'FAILED' : 'PENDING';
    const safeMessage = isFinalAttempt ? String(error.message).slice(0, 500) : null;

    try {
      await pool.query(
        `UPDATE memes
         SET status = $1, error_message = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [status, safeMessage, memeId]
      );
    } catch (databaseError) {
      console.error('[WORKER] Failed to record processing error', {
        memeId,
        message: databaseError.message
      });
    }
    throw error;
  }
}, {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number.isFinite(redisPort) ? redisPort : 6379
  },
  concurrency: 2
});

worker.on('completed', (job) => {
  console.log('[WORKER] Job completed', { jobId: job.id });
});

worker.on('failed', (job, error) => {
  console.error('[WORKER] Job attempt failed', {
    jobId: job && job.id,
    attemptsMade: job && job.attemptsMade,
    message: error.message
  });
});

worker.on('error', (error) => {
  console.error('[WORKER] Runtime error', { message: error.message });
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[WORKER] Received ${signal}; shutting down`);
  await Promise.allSettled([worker.close(), pool.closeDatabase()]);
  s3.destroy();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
