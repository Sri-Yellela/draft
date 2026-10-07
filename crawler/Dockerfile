# D75 crawler worker. Deployed from crawler/ alone: it imports nothing from draft and mounts no volume.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
# Non-root: a browser that opens hostile pages never runs as root.
RUN useradd --create-home --uid 10001 crawler && chown -R crawler /app
USER crawler
ENV CRAWLER_CHROME_PATH=/usr/bin/chromium NODE_ENV=production
EXPOSE 8080
CMD ["node", "worker.js"]
