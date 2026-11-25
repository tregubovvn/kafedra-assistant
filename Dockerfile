# Ассистент кафедры ПМН — образ для сервера (tregubovvn.ru)
# Сборка: docker build -t kafedra-assistant .
# Запуск: docker run -d -p 3000:3000 --env-file .env kafedra-assistant
# (база — внешний PostgreSQL в Supabase, файловый volume не нужен)

FROM node:22-alpine

# Prisma-движок для PostgreSQL требует libssl
RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# DEPLOY_MODE=server — обычная сборка под `next start`
RUN npx prisma generate && DEPLOY_MODE=server npm run build

ENV NODE_ENV=production \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1 \
    DEPLOY_MODE=server

# DATABASE_URL и DIRECT_URL приходят из --env-file / docker-compose
EXPOSE 3000

# При старте только запускаем сервер. Схему в Supabase применяем вручную:
# `npm run db:push` (или задайте PRISMA_DB_PUSH=1 — тогда push выполнится на старте)
CMD ["sh", "-c", "if [ \"$PRISMA_DB_PUSH\" = \"1\" ]; then npx prisma db push --skip-generate; fi; npx next start -p 3000"]
