# ── Tacit: single image, API + built web app, SQLite on a volume ──
FROM node:24-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @tacit/web build

FROM node:24-alpine
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
WORKDIR /app
COPY --from=build /app ./
ENV NODE_ENV=production PORT=8787 API_PORT=8787 DATABASE_PATH=/data/tacit.db WEB_DIST=/app/apps/web/dist
VOLUME ["/data"]
EXPOSE 8787
WORKDIR /app/apps/api
CMD ["pnpm", "start"]
