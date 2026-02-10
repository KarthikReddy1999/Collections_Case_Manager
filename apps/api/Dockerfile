FROM node:20-bookworm-slim AS build

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
  chromium \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm install

COPY . .

RUN npm run prisma:generate -w apps/api && npm run build -w apps/api

EXPOSE 3000

WORKDIR /app/apps/api

CMD ["sh", "-c", "npm run prisma:generate && npm run prisma:migrate && npm run prisma:seed && node dist/main.js"]
