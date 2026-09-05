const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('yaml');

const root = path.resolve(__dirname, '..');

function requiredFile(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Required file is missing: ${relativePath}`);
  }
}

const requiredFiles = [
  '.env.example',
  '.gitignore',
  'Dockerfile',
  'compose.yaml',
  'pnpm-lock.yaml',
  'db/migrations/001-create-memes.sql',
  'services/static-web/Dockerfile',
  'services/static-web/nginx.conf',
  'services/static-web/public/index.html',
  'services/web-service/Dockerfile',
  'services/web-service/server.js',
  'services/worker/Dockerfile',
  'services/worker/worker.js',
  'services/cron/Dockerfile',
  'services/cron/cron.js'
];
requiredFiles.forEach(requiredFile);

const compose = parse(fs.readFileSync(path.join(root, 'compose.yaml'), 'utf8'));
const requiredServices = [
  'postgres',
  'redis',
  'minio',
  'minio-init',
  'web-service',
  'worker',
  'cron',
  'static-web'
];

if (!compose || typeof compose.services !== 'object') {
  throw new Error('compose.yaml must contain a services mapping');
}

for (const service of requiredServices) {
  if (!compose.services[service]) {
    throw new Error(`compose.yaml is missing service: ${service}`);
  }
}

for (const manifest of [
  'package.json',
  'packages/shared/package.json',
  'services/web-service/package.json',
  'services/worker/package.json',
  'services/cron/package.json',
  'services/static-web/package.json'
]) {
  JSON.parse(fs.readFileSync(path.join(root, manifest), 'utf8'));
}

console.log('Repository structure, manifests, and Compose YAML are valid.');
