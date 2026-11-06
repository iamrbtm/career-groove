FROM postgres:17-alpine AS base

RUN apk add --no-cache curl bash
RUN curl -fsSL https://bun.sh/install | bash
ENV BUN_INSTALL=/root/.bun
ENV PATH="$BUN_INSTALL/bin:$PATH"

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

ENV PGDATA=/var/lib/postgresql/data
ENV POSTGRES_PASSWORD=career_groove
ENV POSTGRES_DB=careergroove
ENV DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}
ENV AUTH_SECRET=career_groove_v2_default_secret
ENV BETTER_AUTH_SECRET=career_groove_v2_default_secret
ENV ENCRYPTION_KEY=career_groove_v2_default_encryption
ENV BOOTSTRAP_ADMIN_EMAIL=rbtm2006@me.com
ENV BETTER_AUTH_URL=http://localhost:3000
ENV SELF_ORIGIN=http://localhost:3000
ENV PORT=3000

COPY scripts/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]