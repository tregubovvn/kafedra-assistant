# Ассистент кафедры ПМН — образ для сервера (tregubovvn.ru)
# Сборка: docker build -t kafedra-assistant .
# Запуск: docker run -d -p 3000:3000 --env-file .env kafedra-assistant
# (база — внешний PostgreSQL в Supabase, файловый volume не нужен)

FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# Подпуть публикации запекается в сборку (для /kafedra-assistant — build-arg)
ARG NEXT_PUBLIC_BASE_PATH=
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH

# DEPLOY_MODE=server/db: next build без standalone-копирования
RUN npm run build:server

ENV NODE_ENV=production \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1 \
    DEPLOY_MODE=server

# DATABASE_URL приходит из --env-file / docker-compose
EXPOSE 3000

# При старте только запускаем сервер. Схему в Supabase применяем вручную:
# `npm run db:push` (или задайте DB_PUSH=1 — тогда схема применится на старте)
CMD ["sh", "-c", "if [ \"$DB_PUSH\" = \"1\" ]; then node scripts/db-push.mjs; fi; npx next start -p 3000"]
