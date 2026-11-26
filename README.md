# Цифровой помощник зав. кафедрой

Прототип приложения-ассистента заведующего кафедрой «Производственный менеджмент» СГТУ имени Гагарина Ю.А.
Публикация: [tregubovvn.ru/kafedra-assistant](https://tregubovvn.ru/kafedra-assistant)

**Статическое приложение без Node-сервера.** Браузер ходит в Supabase (PostgreSQL + REST) напрямую, вход — по общему паролю кафедры.

## Возможности

**Клиент преподавателя** — мобильный интерфейс:

- **Работа** — журнал выполненных работ: описание создателем (название — первые 100 символов), ссылка на новость, дата и вид; у заведующего — полное редактирование и DeepSeek.
- **Поручения** — карточки с названием, описанием, критериями завершения и сроком (дата + время); при флаге «обязательно описать результат» без текста отметить нельзя.
- **Расписание** — только свои занятия с rasp.sstu.ru, сплошным списком по всем дням от сегодня (пара и время, дисциплина, группа, аудитория); рядом вкладка «Мои замены»: расписание на день с учётом замен, входящие просьбы и мастер подбора.

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
| Заведующая | `slavnetskova@pmn.demo` | общий пароль из `config.js` (`demo1234`) |
| Доцент (та же Славнецкова) | `slavnetskova.docent@pmn.demo` | тот же |
| Преподаватели | `tregubovvn@outlook.com`, `grimashevich@pmn.demo`, … | тот же |

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

Файл попадает в сборку и хранится в репозитории: `public/config.js` → `site/config.js`.

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
npm run sync:rasp        # расписание кафедры с rasp.sstu.ru → таблица RaspEntry
```

Расписание преподавателей берётся с https://rasp.sstu.ru/rasp/department/204. Скрипт `scripts/sync-rasp.mjs` разбирает страницу (27 преподавателей, все опубликованные дни) и перезаписывает `RaspEntry`; приложение читает её через `/api/rasp` и показывает все дни от сегодня. Автообновление — workflow `.github/workflows/sync-rasp.yml` (ежедневно в 06:00 по Саратову); для него нужен секрет репозитория `DATABASE_URL`.

> **Безопасность.** Приложение работает по выбранной схеме «общий пароль без RLS»: RLS на таблицах отключён, `anon` ключ публичный и лежит в `config.js`. Любой, кто откроет сайт, видит и может менять данные. Это допустимо для прототипа, но не для персональных данных. Если понадобится закрыть доступ — включайте RLS и Supabase Auth (потребуется вернуть серверную логику или Edge Functions).

## Публикация на tregubovvn.ru/kafedra-assistant

Каталог на сервере: `/var/www/html/kafedra-assistant`, Node и PM2 не нужны.

**1. Сборка и публикация в репозиторий**

Собранный сайт хранится в репозитории — каталог `site/`.

```bash
npm ci
npm run build:static     # out/
npm run publish:static   # out/ -> site/
git add site && git commit -m "Update static site" && git push
```

**2. Деплой на сервер**

Workflow `.github/workflows/main.yml` на push в `main` копирует `site/*` в `/var/www/html/kafedra-assistant` по SSH. Сборки и Node на сервере нет — только файлы.

**3. Настройки**

`public/config.js` попадает в сборку и в `site/config.js`: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (publishable) и `SHARED_PASSWORD`. Ключ публичный по определению, поэтому лежит в репозитории.

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

Обновление сайта: правки → `npm run build:static && npm run publish:static` → коммит `site/` → push. Правка `.github/workflows/main.yml` требует токен со scope `workflow`; готовый файл — `deploy/github-actions-main.yml`.

## Структура

```
db/schema.sql                 # схема БД (PostgreSQL)
scripts/db-push.mjs           # применение схемы
scripts/seed.mjs              # демо-данные
src/lib/client.ts             # клиентский слой: Supabase REST вместо API
src/app/page.tsx              # SPA: вход + маршрутизация по роли
src/components/app/           # клиенты: teacher-app (мобильный), head-app (десктоп)
src/components/ui/            # набор shadcn/ui
public/config.js              # настройки (Supabase URL, publishable key, пароль)
site/                         # собранная статика для публикации
scripts/publish-static.mjs    # out/ -> site/
deploy/nginx.conf.example     # пример конфигурации nginx
```
