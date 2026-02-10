FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm install

COPY . .

RUN npm run build -w apps/web

EXPOSE 3000

WORKDIR /app/apps/web

CMD ["npm", "run", "start"]
