# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS dependencies
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY packages/api/package.json packages/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN --mount=type=cache,target=/root/.npm npm ci

FROM dependencies AS builder
COPY tsconfig.base.json turbo.json ./
COPY packages/shared packages/shared
COPY packages/api packages/api
COPY db db
RUN npm run build --workspace @career-groove/shared \
 && npm run build --workspace @career-groove/api \
 && cp packages/api/package.json /tmp/api-package.json \
 && npm pkg delete dependencies.@career-groove/shared --prefix packages/api \
 && npm install --omit=dev --ignore-scripts \
    --workspaces=false --prefix packages/api \
 && cp /tmp/api-package.json packages/api/package.json

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /workspace
RUN addgroup -S app && adduser -S -G app app
COPY --from=builder --chown=app:app /workspace/package.json package.json
COPY --from=builder --chown=app:app /workspace/package-lock.json package-lock.json
COPY --from=builder --chown=app:app /workspace/packages/api/package.json packages/api/package.json
COPY --from=builder --chown=app:app /workspace/packages/api/package-lock.json packages/api/package-lock.json
COPY --from=builder --chown=app:app /workspace/packages/api/dist packages/api/dist
COPY --from=builder --chown=app:app /workspace/packages/api/node_modules packages/api/node_modules
COPY --from=builder --chown=app:app /workspace/packages/shared/package.json packages/shared/package.json
COPY --from=builder --chown=app:app /workspace/packages/shared/dist packages/shared/dist
COPY --from=builder --chown=app:app /workspace/db db
RUN mkdir -p packages/api/node_modules/@career-groove \
 && ln -s /workspace/packages/shared packages/api/node_modules/@career-groove/shared \
 && ln -s /workspace/packages/api/node_modules packages/shared/node_modules
USER app
EXPOSE 3001
CMD ["node", "--enable-source-maps", "packages/api/dist/server.js"]
