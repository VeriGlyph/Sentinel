FROM node:lts-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN NODE_ENV=development yarn install
EXPOSE 8080
CMD ["yarn", "serve"]
