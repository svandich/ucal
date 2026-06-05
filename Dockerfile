FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && \
    npx playwright install --with-deps chromium && \
    apt-get install -y xvfb && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["sh", "-c", "Xvfb :99 -screen 0 1280x720x24 -nolisten tcp & sleep 1 && DISPLAY=:99 node dist/main"]
