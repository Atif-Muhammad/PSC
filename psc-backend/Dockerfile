# -------- Builder --------
FROM node:20-slim AS builder

RUN apt-get update -y && apt-get install -y openssl libssl-dev

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build project and generate Prisma client for production stage
RUN npx prisma generate
RUN npm run build

# -------- Production --------
FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl libssl-dev

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
COPY entrypoint.sh ./entrypoint.sh

EXPOSE 3000

# Use entrypoint to run migrations and start app
ENTRYPOINT ["./entrypoint.sh"]
