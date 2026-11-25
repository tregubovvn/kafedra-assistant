# Ассистент кафедры ПМН — образ для сервера (tregubovvn.ru)
# Сборка: docker build -t kafedra-assistant .
# Запуск: docker run -d -p 3000:3000 -v kafedra-db:/app/db --env-file .env kafedra-assistant

FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# DEPLOY_MODE=server — обычная сборка под `next start`
RUN npx prisma generate && DEPLOY_MODE=server npm run build

ENV NODE_ENV=production \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1 \
    DEPLOY_MODE=server \
    DATABASE_URL=file:/app/db/custom.db

VOLUME ["/app/db"]

EXPOSE 3000

# При старте: применить схему к базе в volume и запустить сервер
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && npx next start -p 3000"]
