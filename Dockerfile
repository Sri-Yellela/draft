# ⛔ PINNED (10-13): a moving `node:20-bookworm-slim` tag rolled to Node 20.20.2 and every build failed in
# `npm install`. better-sqlite3 12.11.1 ships no prebuilt binary for Node 20 (ABI 115 — its Linux x64 prebuilds
# are ABI 127 / 137 / 141 / 147: Node 22 / 24 / 25 / 26), so on Node 20 it compiles from source, and node-gyp
# fetches Node's headers from nodejs.org — which answered 502 during two deploys (939cff4, ece6731). Node 22 has
# the prebuilt binary, so the build no longer depends on nodejs.org; the digest pins the exact image, so a tag
# that moves cannot change the build under us. Move it on purpose, with a better-sqlite3 prebuild for its ABI.
FROM node:22.23.2-bookworm-slim@sha256:48e4b67d85f87bd551df43704e24d252f56cc5f8e9718841aace50f19948f0f9

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget ca-certificates gnupg \
    python3 make g++ \
    chromium \
    libnspr4 \
    libnss3 \
    libnss3-dev \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxfixes3 \
    libxext6 \
    libx11-xcb1 \
    libxcb-dri3-0 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libpangocairo-1.0-0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxi6 \
    libxtst6 \
    fonts-liberation \
    fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Server dependencies. packages/ comes first: @draft/ats-scorer is a file: dependency, so npm
# install needs its directory present — including packages/ats-scorer/data, the scorer's registries.
COPY package*.json ./
COPY packages/ ./packages/
RUN npm install

# Client dependencies and build
COPY client/package*.json ./client/
RUN cd client && npm install
COPY client/ ./client/
COPY shared/ ./shared/
# Static registries: the client bundles ROLE_ALIAS_MAP.json. They live in registry/, NOT data/ —
# data/ is the runtime volume in production and hides anything the image puts under it.
COPY registry/ ./registry/
# D190: Ask draft bundles the assistant's command vocabulary (content/assistant/commands-v1.json — shared with the PDF-tools
# site). test/dockerClientBuildInputs.test.js fails when the client imports a folder that is not copied before the build.
COPY content/assistant/ ./content/assistant/
# D198 E1: the gallery's explainer reads the pilot script (client/src/plate/registry.js imports it)
COPY content/explainers/ ./content/explainers/
RUN cd client && npm run build

# Copy remaining server source
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
