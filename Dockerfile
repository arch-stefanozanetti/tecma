# Root Dockerfile — solo per un Web Service Docker manuale su Render (es. nome "tecma").
#
# Deploy canonico FollowUp 3.0: servizio Node `followup-3-be` (render.yaml + scripts/render-build-be.sh).
# Se non ti serve un secondo BE, in Dashboard disattiva Auto-Deploy su "tecma" oppure elimina il servizio
# (vedi docs/RENDER_DEPLOY.md §2b e scripts/render-disable-docker-duplicate-autodeploy.sh).
#
# Builda be-followup-v3 da contesto repo root. Alternativa: Root Directory = .../be-followup-v3 e Dockerfile locale.
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
