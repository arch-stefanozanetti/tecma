# Root Dockerfile per servizio Render "tecma" (build da repo root).
# Builda il backend FollowUp 3.0 (be-followup-v3).
# Alternativa: in Render Dashboard impostare Root Directory su
# business/tecma-digital-platform/followup-3.0/be-followup-v3 e usare il Dockerfile in quella cartella.
FROM node:20-alpine AS deps
WORKDIR /app
COPY business/tecma-digital-platform/followup-3.0/be-followup-v3/package*.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY business/tecma-digital-platform/followup-3.0/be-followup-v3 ./
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY business/tecma-digital-platform/followup-3.0/be-followup-v3/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 8080
CMD ["node", "dist/server.js"]
