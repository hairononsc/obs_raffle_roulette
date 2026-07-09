# ---- builder: full node image (toolchain available if better-sqlite3
# ever needs to compile instead of using its linux prebuild) ----
FROM node:20 AS builder
RUN corepack enable
WORKDIR /repo

# Manifests first so `pnpm install` stays cached across source changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/
COPY packages/widget/package.json packages/widget/
COPY packages/panel/package.json packages/panel/
RUN pnpm install --frozen-lockfile

COPY packages ./packages
COPY eslint.config.js ./
RUN pnpm build
# Production node_modules for the backend with @wheellive/shared resolved.
RUN pnpm --filter @wheellive/backend deploy --prod /out/backend

# ---- runtime ----
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /out/backend /app
COPY --from=builder /repo/packages/widget/dist /app/static/widget
COPY --from=builder /repo/packages/panel/dist /app/static/panel

ENV WHEELLIVE_WIDGET_DIST=/app/static/widget \
    WHEELLIVE_PANEL_DIST=/app/static/panel

EXPOSE 8710
CMD ["node", "dist/main.js"]
