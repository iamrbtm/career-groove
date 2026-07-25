# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS builder
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN --mount=type=cache,target=/root/.npm npm ci
COPY tsconfig.base.json turbo.json ./
COPY packages/shared packages/shared
COPY apps/mobile apps/mobile
ARG EXPO_PUBLIC_API_URL=
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
RUN npm run build --workspace @career-groove/mobile

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runner
COPY deploy/nginx.expo.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /workspace/apps/mobile/dist /usr/share/nginx/html
EXPOSE 8080
