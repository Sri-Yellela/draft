# D100 P2 apply worker. ⛔ Its OWN Railway project (docs/APPLY_WORKER.md §1), with a volume at /data for the key store.
# Built from the REPOSITORY ROOT (Railway: root directory "/", RAILWAY_DOCKERFILE_PATH=apply-worker/Dockerfile) so it
# carries draft's fill engine itself — one engine, never a fork (d100OneFillEngine) — and NOTHING else of draft:
# no server.js, no routes, no database code, no migrations.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY apply-worker/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
# The fill engine and its import closure, at the same paths as in the repository.
COPY services/applyAutomation.js services/browserLauncher.js services/platformDetector.js ./services/
COPY shared/failureAttribution.js shared/savedAnswers.js shared/companyIdentity.js ./shared/
COPY crawler/lib/signature.js ./crawler/lib/signature.js
COPY apply-worker/ ./apply-worker/
# Non-root: a browser that holds a signed-in session never runs as root.
RUN useradd --create-home --uid 10002 worker && mkdir -p /data/keys && chown -R worker /app /data
USER worker
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium APPLY_NO_SCREENSHOTS=1 APPLY_WORKER_KEY_DIR=/data/keys NODE_ENV=production
EXPOSE 8080
CMD ["node", "apply-worker/worker.js"]
