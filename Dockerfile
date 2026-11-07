# --- build stage -------------------------------------------------------------
FROM oven/bun:1.2 AS build
WORKDIR /app

# Nitro must emit a plain Node server for Railway (default target is Cloudflare)
ENV NITRO_PRESET=node-server
ENV NODE_ENV=production

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

# Public (VITE_*) values are inlined at build time, so they must be present here.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID

RUN bun run build

# --- runtime stage -----------------------------------------------------------
FROM oven/bun:1.2 AS runtime
WORKDIR /app
# pg_dump 17 (matches Supabase Postgres 17) for Super Admin full dump downloads
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
 && . /etc/os-release \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $VERSION_CODENAME-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update && apt-get install -y --no-install-recommends postgresql-client-17 \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules/postgres ./node_modules/postgres

EXPOSE 3000
CMD ["sh", "-c", "export CRON_SECRET=\"${CRON_SECRET:-$(head -c 24 /dev/urandom | od -An -tx1 | tr -d \" \\n\")}\" && bun run scripts/migrate.mjs && (bun scripts/scheduler.mjs &) && bun dist/server/index.mjs"]
