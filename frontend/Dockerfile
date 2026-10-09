FROM oven/bun:1.3.4 AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN --mount=type=secret,id=build_ca,required=false \
    --mount=type=secret,id=build_proxy,required=false \
    if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; \
    if [ -f /run/secrets/build_proxy ]; then export HTTPS_PROXY="$(cat /run/secrets/build_proxy)"; fi; \
    bun install --frozen-lockfile

FROM node:22.21.1-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22.21.1-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
