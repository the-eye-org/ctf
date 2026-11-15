# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Use glibc to match native modules built by the Ubuntu build job.
COPY app-build/ ./
RUN --mount=type=secret,id=runtime_env,required=true cp /run/secrets/runtime_env /app/runtime-env.json

COPY db/migrations /app/db/migrations
COPY compose.yaml /app/compose.yaml
ENV WORKSPACE_STORAGE_DIR=/data/workspaces
EXPOSE 3000
CMD ["node", "-e", "Object.assign(process.env, { ...require('./runtime-env.json'), ...process.env }); require('./server.js')"]
