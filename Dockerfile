# Lernheft as one long-running server with a persistent volume at /data.
# Database (nachhilfe.db) and uploaded material (uploads/) both live there.
FROM node:22-bookworm-slim AS build
WORKDIR /app
# better-sqlite3 usually installs a prebuilt binary; the tools are for when it has to compile
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/data/nachhilfe.db
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./
RUN mkdir -p /data && chown node:node /data
USER node
# no VOLUME line: Railway rejects it; the host mounts the volume at /data (docker run -v ...:/data)
EXPOSE 3000
CMD ["sh", "-c", "exec node_modules/.bin/next start -p ${PORT:-3000}"]
