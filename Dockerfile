# Lex Detetive — imagem para servidor (modo local/escritório ou base do SaaS)
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund --foreground-scripts
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app/apps/api
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3333 LEX_DATA_DIR=/data
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/public ./public
COPY --from=build /app/apps/api/assets ./assets
COPY --from=build /app/apps/api/prisma ./prisma
COPY --from=build /app/apps/api/package.json ./
VOLUME ["/data"]
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3333/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
