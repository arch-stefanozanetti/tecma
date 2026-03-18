FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY followup-3.0/fe-followup-v3/package.json followup-3.0/fe-followup-v3/pnpm-lock.yaml ./
COPY design-system ./design-system
RUN pnpm install --frozen-lockfile

FROM deps AS build
WORKDIR /app
COPY followup-3.0/fe-followup-v3/ ./
COPY design-system ./design-system
RUN pnpm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

FROM deps AS dev
WORKDIR /app
COPY followup-3.0/fe-followup-v3/ ./
COPY design-system ./design-system
EXPOSE 5177
CMD ["pnpm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5177"]
