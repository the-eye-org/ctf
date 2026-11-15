FROM node:24-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Use glibc to match native modules built by the Ubuntu build job.
COPY app-build/ ./

EXPOSE 3000
CMD ["node", "server.js"]
