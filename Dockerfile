FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY db ./db
COPY scripts ./scripts
USER node
CMD ["node", "scripts/document-worker.mjs"]

FROM node:22-alpine AS backup-scheduler
WORKDIR /workspace
ENV NODE_ENV=production
RUN apk add --no-cache bash git postgresql-client tar tzdata
CMD ["node", "scripts/backup/scheduler.mjs"]

FROM node:22-alpine AS all-in-one
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
ENV PGDATA=/var/lib/postgresql/data/pgdata TZ=America/Los_Angeles
RUN apk add --no-cache postgresql17 postgresql17-client redis supervisor bash git tar tzdata \
    && rm -f /etc/supervisord.conf \
    && mkdir -p /var/lib/postgresql /run/postgresql /data /app/backups \
    && chown -R postgres:postgres /var/lib/postgresql /run/postgresql \
    && chown -R redis:redis /data \
    && chown node:node /app/backups
WORKDIR /app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/db ./db
COPY --from=builder /app/scripts ./scripts
COPY --from=deps /app/node_modules ./node_modules
COPY deploy/supervisord.conf /etc/supervisord.conf
COPY deploy/cg-entrypoint.sh deploy/db-init.sh deploy/after-db.sh /app/deploy/
RUN chmod +x /app/deploy/*.sh
EXPOSE 3000 5432 6379
ENTRYPOINT ["/app/deploy/cg-entrypoint.sh"]

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/db ./db
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
USER nextjs
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
