# Production web image (TASK-012). Context = repo root, NOT web/ alone (see
# docker-compose.yml): erp-demo-runtime-impl.ts imports business modules straight
# from ../../src (the same modules the browser/PGlite demo path uses), and some of
# those transitively need root-only packages (e.g. decimal.js). Both workspaces'
# deps and source must be laid out exactly as in a real checkout (web/ next to
# src/ next to node_modules/) so Node/tsc/Vite's upward module resolution finds
# them, the same way it already does for local dev and `npm run build:demo`.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY web/package.json web/package-lock.json ./web/
RUN npm --prefix web ci
COPY src ./src
COPY web ./web
ARG VITE_DATA_MODE=api
ENV VITE_DATA_MODE=$VITE_DATA_MODE
ARG VITE_PLATFORM_DEMO_AUTOFILL=false
ENV VITE_PLATFORM_DEMO_AUTOFILL=$VITE_PLATFORM_DEMO_AUTOFILL
WORKDIR /app/web
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/web/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
