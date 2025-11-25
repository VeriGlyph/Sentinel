FROM node:20-alpine

WORKDIR /app

COPY package*.json tsconfig.json jest.config.ts ./
COPY src ./src
COPY migrations ./migrations
COPY knexfile.js ./knexfile.js

RUN npm ci

RUN npm run build

ENV NODE_ENV=production

CMD ["sh", "-c", "npm run migrate && node dist/index.js"]
