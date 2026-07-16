# Production web image (TASK-012). Context = web/ — it is already a fully
# independent workspace (own package.json/package-lock.json), same as the GitHub
# Pages demo build, just with VITE_DATA_MODE=api instead of =demo.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_DATA_MODE=api
ENV VITE_DATA_MODE=$VITE_DATA_MODE
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
