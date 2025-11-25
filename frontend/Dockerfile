FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_NETWORK=preprod
ENV VITE_NETWORK=${VITE_NETWORK}
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
