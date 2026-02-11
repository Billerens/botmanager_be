# Сборка
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY backend/package.json backend/yarn.lock* ./
COPY backend/ ./
RUN yarn install --frozen-lockfile
RUN yarn build

# Runtime: только артефакты + COPY --chown → без тяжёлого chown -R по десяткам тысяч файлов
FROM node:20-alpine
RUN corepack enable
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001 -G nodejs

COPY --chown=nestjs:nodejs --from=builder /app/node_modules ./node_modules
COPY --chown=nestjs:nodejs --from=builder /app/dist ./dist
COPY --chown=nestjs:nodejs --from=builder /app/package.json ./
COPY --chown=nestjs:nodejs backend/package.json backend/yarn.lock* ./
COPY --chown=nestjs:nodejs backend/src ./src
COPY --chown=nestjs:nodejs backend/scripts/start-with-migrations.sh /app/start.sh
RUN chmod +x /app/start.sh

USER nestjs

EXPOSE 3000

CMD ["/app/start.sh"]
