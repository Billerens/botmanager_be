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

HEALTHCHECK --interval=15s --timeout=5s --start-period=120s --retries=5 CMD ["node", "-e", "const http=require('http');const port=process.env.PORT||3000;const req=http.get({host:'127.0.0.1',port,path:'/health/ready',timeout:4000},(res)=>process.exit(res.statusCode===200?0:1));req.on('error',()=>process.exit(1));req.on('timeout',()=>{req.destroy();process.exit(1);});"]

CMD ["/app/start.sh"]
