# NEO App deployment fixture

This directory is the complete uploadable repository for testing NEO App. Upload **the contents of this directory as the repository root**. Do not upload the parent QA workspace.

The fixture contains four application services plus PostgreSQL, Redis, and MinIO dependencies:

- `web-service`: Node.js API on port `4000`
- `static-web`: Nginx frontend on port `8080`
- `worker`: background queue worker
- `cron`: scheduled reporting worker

## Safe GitHub upload

Create a dedicated **private** GitHub repository and upload everything in this directory, including dotfiles. Keep the repository isolated from production code and credentials.

Before every upload, confirm that `.env`, `node_modules`, test evidence, and real credentials are absent. `.env.example` contains local-only defaults and must not be reused as production credentials.

When connecting the repository to NEO, select **Only select repositories** in GitHub and authorize only this repository. Prefer repository contents and metadata read-only access. Do not approve repository administration, organization administration, secrets access, workflow write access, or source-code write access unless NEO documents a specific requirement.

## NEO Web Service settings

For the API service using **Build file**:

```text
Repository URL: https://github.com/<owner>/<repository>.git
Branch: main
Root directory: leave blank
Dockerfile path: Dockerfile
Container port: 4000
Health check path: /health
Readiness path: /ready
```

The API is not a standalone system. Configure PostgreSQL and Redis first, then add these NEO environment variables using NEO's secret/environment settings:

```text
DATABASE_URL=<NEO PostgreSQL connection URL>
DB_POOL_MAX=10
REDIS_HOST=<NEO Redis hostname>
REDIS_PORT=<NEO Redis port>
PORT=4000
CORS_ORIGIN=https://<deployed-frontend-hostname>
```

Do not commit those real values to GitHub.

Additional Dockerfile paths are:

```text
Frontend: services/static-web/Dockerfile (port 8080, health /healthz)
Worker:   services/worker/Dockerfile (no public port)
Cron:     services/cron/Dockerfile (no public port)
```

`services/web-service/Dockerfile` is retained as the original API-specific build file. The root `Dockerfile` builds the same API and is the recommended upload entry point because platforms commonly detect it automatically.

The worker also requires MinIO or another S3-compatible object store. Configure its endpoint, public URL, bucket, region, and credentials as NEO secrets. The static frontend proxies `/api/` to `web-service:4000`; adjust `services/static-web/nginx.conf` if NEO assigns a different internal API hostname.

## Local verification

Requirements: Docker Desktop with Compose v2, or Node.js 24 with pnpm 11 for unit tests.

```powershell
Copy-Item '.env.example' '.env'
docker compose config
docker compose up --build -d
docker compose ps
```

Open `http://localhost:3000`. API health is available through `http://localhost:3000/api/health` and directly at `http://localhost:4000/health`.

Run repository validation and unit tests:

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm validate
pnpm test
```

Stop the fixture while preserving its volumes:

```powershell
docker compose down
```

## Important limitations

- A single NEO Web Service deployment runs only one Dockerfile; `compose.yaml` describes the complete local stack and is not automatically deployed as one Web Service.
- Deploy the API, frontend, worker, and cron separately unless NEO offers a Compose or multi-service deployment feature.
- The images under `services/worker/fixtures` came from the existing QA fixture. Keep the repository private until their origin and redistribution rights are confirmed.
- Use disposable test databases, buckets, and credentials. Never connect this fixture to production resources.
