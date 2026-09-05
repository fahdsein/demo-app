FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/web-service/package.json services/web-service/package.json
COPY services/worker/package.json services/worker/package.json
COPY services/cron/package.json services/cron/package.json
COPY services/static-web/package.json services/static-web/package.json
RUN corepack enable && pnpm install --frozen-lockfile --prod

COPY packages/shared/src packages/shared/src
COPY services/web-service services/web-service

USER node
EXPOSE 4000
CMD ["node", "services/web-service/server.js"]

