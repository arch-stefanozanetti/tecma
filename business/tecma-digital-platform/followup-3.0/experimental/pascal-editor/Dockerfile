FROM oven/bun:1.3.0 AS base
WORKDIR /app

COPY . .
RUN bun install

WORKDIR /app/apps/editor
ENV NEXT_PUBLIC_BASE_PATH=/experimental/editor

EXPOSE 3002
CMD ["bun", "run", "dev"]
