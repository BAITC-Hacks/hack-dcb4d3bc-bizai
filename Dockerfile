# syntax=docker/dockerfile:1

# Node 22.13+ is required by the application's built-in node:sqlite usage.
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
# Limit the build's JS heap on small hosts. This does not affect runtime limits.
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN npm run build

# Optional validation target; test tooling is not copied into the runtime image.
FROM builder AS test
RUN npm run typecheck && npm run lint && npm test && npm run test:http && npm run test:ai && npm run test:reviews && npm run test:identity

FROM base AS runner
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/app/.data/career-quest.sqlite \
    DATASET_DIR=/app/case_source/case_1/career_quest_dataset \
    COOKIE_SECURE=false

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# Loaded at runtime via fs; also required by the HR dataset-reset operation.
COPY --from=builder --chown=node:node /app/case_source/case_1/career_quest_dataset ./case_source/case_1/career_quest_dataset
RUN mkdir -p /app/.data && chown node:node /app/.data

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '3000') + '/', { signal: AbortSignal.timeout(4000) }).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]
