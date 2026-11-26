# Ассистент кафедры ПМН

Прототип приложения-ассистента заведующего кафедрой «Производственный менеджмент» СГТУ имени Гагарина Ю.А.
Публикация: [tregubovvn.ru/kafedra-assistant](https://tregubovvn.ru/kafedra-assistant)

**Статическое приложение без Node-сервера.** Браузер ходит в Supabase (PostgreSQL + REST) напрямую, вход — по общему паролю кафедры.

## Возможности

**Клиент преподавателя** — мобильный интерфейс:

- **Работа** — журнал выполненных работ (5 видов, ссылка на новость); замены автоматически попадают в журнал.
- **Поручения** — активные (цветовая индикация срочности) и завершённые.
- **Расписание** — своё расписание на день с учётом замен; входящие просьбы о замене (согласиться / отклонить); мастер подбора замены с приоритетом кандидатов (следующая пара → предыдущая → свободен весь день → остальные).

**Клиент заведующего** — десктопный интерфейс:

- **Поручения** — создание (всем или выбранным), контроль исполнения, помощь DeepSeek в формулировании.
- **Расписание** — по преподавателю или группе на дату.
- **Замены** — все замены кафедры, ручное назначение, экспорт в CSV.
- **Работа** — журнал работ всех преподавателей с фильтрами, экспорт CSV.
- **Почта** — журнал писем (в прототипе письма логируются, SMTP не подключён).
- **Настройки** — преподаватели и ключ DeepSeek.

## Демо-доступ

| Роль | Логин | Пароль |
|---|---|---|
| Заведующий | `tregubovvn@outlook.com` | общий пароль из `config.js` (`demo1234`) |
| Преподаватели | `grimashevich@pmn.demo`, `goryacheva@pmn.demo`, … | тот же |

На экране входа есть быстрый демо-выбор пользователя.

## Стек

- Next.js 16 (App Router), только клиентские компоненты; сборка — статический экспорт (`out/`)
- Tailwind CSS 4 + shadcn/ui
- Supabase: PostgreSQL + PostgREST, обращения из браузера по `anon` ключу
- DeepSeek API (ключ хранится в настройках приложения)

## Как это работает

Node-сервера нет: `next build` с `STATIC_EXPORT=1` собирает `out/` — HTML/CSS/JS, которые раздаёт nginx. Все операции (поручения, замены, журнал, почта) выполняются в браузере запросами к Supabase REST. Роли проверяются на клиенте, вход — по общему паролю.

Настройки приложения лежат в `public/config.js` (на сервере — `/var/www/html/kafedra-assistant/config.js`):

```js
window.KAFEDRA_CONFIG = {
  SUPABASE_URL: 'https://jxhwppkpymdzgsqhmxgn.supabase.co',
  SUPABASE_ANON_KEY: '...',   // Project Settings → API → anon public
  SHARED_PASSWORD: 'demo1234',
}
```

Файл не входит в репозиторий (`.gitignore`) и не перезаписывается при деплое — его правят прямо на сервере, пересборка не нужна.

## Локальный запуск

Нужен Node.js 20+ (только для сборки).

```bash
npm install
cp public/config.example.js public/config.js   # вписать anon key
npm run dev                                     # http://localhost:3000
```

Локальная разработка идёт без `basePath` — приложение открывается в корне.

## База данных

Схема — `db/schema.sql`, демо-данные — `scripts/seed.mjs`. Команды используют `DATABASE_URL` из `.env` (Session pooler Supabase):

```bash
cp .env.example .env     # строка подключения Supabase
npm run db:push          # схема, идемпотентно
npm run db:seed          # демо-данные (ОЧИЩАЕТ базу)
```

> **Безопасность.** Приложение работает по выбранной схеме «общий пароль без RLS»: RLS на таблицах отключён, `anon` ключ публичный и лежит в `config.js`. Любой, кто откроет сайт, видит и может менять данные. Это допустимо для прототипа, но не для персональных данных. Если понадобится закрыть доступ — включайте RLS и Supabase Auth (потребуется вернуть серверную логику или Edge Functions).

## Публикация на tregubovvn.ru/kafedra-assistant

Каталог на сервере: `/var/www/html/kafedra-assistant`, Node и PM2 не нужны.

**1. Сборка**

```bash
npm ci
npm run build:static      # out/
```

**2. Файлы на сервер**

Содержимое `out/` копируется в `/var/www/html/kafedra-assistant` (workflow делает это автоматически, см. `deploy/github-actions-main.yml`).

**3. config.js**

Один раз на сервере:

```bash
cd /var/www/html/kafedra-assistant
cp config.example.js config.js   # если файла ещё нет
nano config.js                   # SUPABASE_ANON_KEY, SHARED_PASSWORD
```

**4. nginx**

```nginx
location = /kafedra-assistant {
    return 301 /kafedra-assistant/;
}

location /kafedra-assistant/ {
    root /var/www/html;
    try_files $uri $uri/ /kafedra-assistant/index.html;
}

location = /kafedra-assistant/config.js {
    root /var/www/html;
    add_header Cache-Control "no-store";
}

# Обязательно: в каталоге лежат .env и исходники — закрываем dotfiles
location ~ /\.(?!well-known) {
    deny all;
}
```

`sudo nginx -t && sudo systemctl reload nginx`. Полный пример — `deploy/nginx.conf.example`.

**5. Проверка**

```bash
curl -I https://tregubovvn.ru/kafedra-assistant/     # 200
curl https://tregubovvn.ru/kafedra-assistant/config.js
```

Автодеплой: `.github/workflows/main.yml` собирает статику и копирует `out/` по SSH. Правка workflow требует токен со scope `workflow`; готовый файл — `deploy/github-actions-main.yml`.

## Структура

```
db/schema.sql                 # схема БД (PostgreSQL)
scripts/db-push.mjs           # применение схемы
scripts/seed.mjs              # демо-данные
src/lib/client.ts             # клиентский слой: Supabase REST вместо API
src/app/page.tsx              # SPA: вход + маршрутизация по роли
src/components/app/           # клиенты: teacher-app (мобильный), head-app (десктоп)
src/components/ui/            # набор shadcn/ui
public/config.example.js      # шаблон настроек (config.js создаётся на сервере)
deploy/nginx.conf.example     # пример конфигурации nginx
```
