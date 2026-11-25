# Ассистент кафедры ПМН

Прототип приложения-ассистента заведующего кафедрой «Производственный менеджмент» СГТУ имени Гагарина Ю.А. Публикация планируется на [tregubovvn.ru](https://tregubovvn.ru/).

## Возможности

**Клиент преподавателя — мобильный интерфейс** (телефон, нижняя навигация):

- **Работа** — журнал выполненных работ с 5 видами (учебная, учебно-методическая, организационно-методическая, научно-исследовательская, воспитательная и социально-культурная) и необязательной ссылкой на новость; замены автоматически попадают в журнал отдельной записью «Учебная (замена)».
- **Поручения** — две подвкладки: «Активные» с цветовой индикацией (красный — срок сегодня, фиолетовый — меньше 3 дней, зелёный — остальные) и «Завершённые» (выполненные и просроченные, без отдельной пометки).
- **Расписание** — своё расписание на день с учётом замен; входящие просьбы о замене (согласиться / отклонить); пошаговый **мастер подбора замены**: преподаватель выбирает занятие, система показывает свободных коллег, отсортированных по приоритету:
  1. у кого следующей парой идёт занятие (уже в вузе),
  2. у кого предыдущая пара,
  3. у кого в этот день занятий нет,
  4. остальные свободные преподаватели.

  Просьбу можно отправить сразу нескольким кандидатам: первый согласившийся закрепляется за заменой, у остальных просьба автоматически пропадает.

**Клиент заведующего — десктопный интерфейс** (браузер на компьютере, боковое меню):

- **Поручения** — создание (всем кафедрой или выбранным, срок, помощь DeepSeek в формулировании), контроль «кто ещё не выполнил», цветовая индикация срочности.
- **Расписание** — просмотр по преподавателю или группе на конкретную дату или день недели (ближайшая дата дня недели).
- **Замены** — все текущие замены кафедры: дисциплина, дата, время, кто ведёт, кто заменяет, статус («поиск преподавателя» / «замена подобрана»); ручное назначение замены (занятость проверяется автоматически); экспорт в CSV (UTF-8, разделитель «;» — открывается в Excel).
- **Работа** — журнал работ всех преподавателей с фильтрами: преподаватель, месяц, вид работы.
- **Почта (исходящие)** — журнал писем: новые поручения, напоминания в последний день срока, просьбы о замене и их результат. В прототипе письма логируются, SMTP подключается при публикации.
- **Настройки** — преподаватели (ФИО, e-mail, добавление, сброс пароля, удаление), ключ DeepSeek, блок источников расписаний (подключение адаптера rasp.sstu.ru отложено).

## Демо-данные

Кафедра ПМН (по данным rasp.sstu.ru, department 204): 1 заведующий + 9 преподавателей, расписание на 3 недели, 5 поручений в разных статусах, 2 замены, журнал работ.

| Роль | Логин | Пароль |
|---|---|---|
| Заведующий (Трегубов В.Н.) | `tregubovvn@outlook.com` | `demo1234` |
| Преподаватель | `grimashevich@pmn.demo`, `goryacheva@pmn.demo`, … `makarova@pmn.demo` | `demo1234` |

На экране входа есть быстрый демо-выбор пользователя.

## Стек

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS 4 + shadcn/ui (только используемый набор компонентов)
- PostgreSQL (Supabase) + postgres.js — запросы явным SQL, без ORM
- lucide-react, sonner (уведомления)
- Внешние интеграции: DeepSeek API (ключ задаётся в настройках приложения)

## Локальный запуск

Нужен Node.js 20+ (или Bun) и PostgreSQL — проще всего облачный проект Supabase (см. раздел ниже).

```bash
npm install                 # или: bun install
cp .env.example .env        # вписать строки подключения Supabase
npm run db:push             # создать схему БД
npm run db:seed             # заполнить демо-данными кафедры ПМН
npm run dev                 # http://localhost:3000
```

Сброс к чистому демо-состоянию: `npm run db:seed` — скрипт **удаляет все данные** и заливает демо заново, поэтому на боевой базе его запускать нельзя.

## База данных в Supabase

Проект: [`jxhwppkpymdzgsqhmxgn`](https://supabase.com/dashboard/project/jxhwppkpymdzgsqhmxgn).

1. Supabase → **Project Settings → Database → Connection string** (кнопка **Connect**).
2. Скопируйте строку **Session pooler** (порт 5432) — она работает по IPv4 и поддерживает DDL, поэтому подходит и приложению, и `npm run db:push`.
3. Создайте `.env` из `.env.example` и подставьте пароль БД и регион пулера.
4. Примените схему: `npm run db:push` (выполняет `db/schema.sql`, повторный запуск безопасен).
5. Демо-данные (только для пустого проекта): `npm run db:seed`.

Прямое подключение `db.<ref>.supabase.co` доступно только по IPv6, поэтому по умолчанию используется пулер. Для transaction pooler (порт 6543) в `DATABASE_URL` добавьте `?pgbouncer=true&connection_limit=1` — клиент работает с `prepare: false`. DDL через порт 6543 не проходит: для `npm run db:push` временно берите Session pooler.

`.env` в репозиторий не попадает (см. `.gitignore`): в строке подключения лежит пароль БД.

> **Безопасность.** Supabase по умолчанию отдаёт схему `public` через REST API (ключи `anon`/`authenticated`), а таблицы приложения создаются без RLS. Если Data API проекта не нужен, закройте таблицы один раз в SQL Editor:
>
> ```sql
> revoke all on all tables in schema public from anon, authenticated;
> alter default privileges in schema public revoke all on tables from anon, authenticated;
> ```
>
> Приложение ходит в базу под ролью `postgres`, поэтому эти права ему не нужны.

## Развёртывание на сервере (tregubovvn.ru)

Приложение — это Node-сервер (Next.js), nginx только проксирует. База — PostgreSQL в Supabase: на сервере не нужны ни файл БД, ни volume, достаточно `DATABASE_URL` и `NEXT_PUBLIC_BASE_PATH` в `.env`.

Публикация: **https://tregubovvn.ru/kafedra-assistant/**, каталог приложения — `/var/www/html/kafedra-assistant`.

### 1. Переменные окружения

```bash
cd /var/www/html/kafedra-assistant
cp .env.example .env
```

В `.env`:

```ini
DATABASE_URL="postgresql://postgres.jxhwppkpymdzgsqhmxgn:...@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require"
NEXT_PUBLIC_BASE_PATH=/kafedra-assistant
```

`NEXT_PUBLIC_BASE_PATH` нужен и при сборке, и при запуске: с ним Next публикует страницы, статику и `/api` под подпутём. Для локального запуска на `localhost:3000` строку не задавайте.

### 2. Сборка и PM2

```bash
sudo apt install -y nodejs npm nginx
sudo npm i -g pm2

cd /var/www/html/kafedra-assistant
npm ci
npm run db:push          # схема идемпотентна
npm run build:server     # DEPLOY_MODE=server next build, basePath берётся из .env
pm2 start npm --name kafedra -- run start:server
pm2 save && pm2 startup
```

`start:server` поднимает `next start -p 3000`. Если порт занят — поменяйте его в `package.json` (скрипт `start:server`) и в nginx ниже.

### 3. nginx

В конфиг сайта `tregubovvn.ru` добавьте:

```nginx
location /kafedra-assistant {
    proxy_pass http://127.0.0.1:3000;   # без URI: префикс сохраняется, это basePath Next
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
}
```

Своих редиректов добавлять не нужно: `/kafedra-assistant/` со слэшем Next сам канонизирует на `/kafedra-assistant` (308).

`sudo nginx -t && sudo systemctl reload nginx`. Полный пример — `deploy/nginx.conf.example`.

Проверка: `curl -I https://tregubovvn.ru/kafedra-assistant` → 200,
`curl https://tregubovvn.ru/kafedra-assistant/api` → `{"message":"Hello, world!"}`.

### 4. Автодеплой

`.github/workflows/main.yml` на push в `main`: копирует репозиторий в `/var/www/html/kafedra-assistant`, затем по SSH выполняет `npm ci`, `npm run db:push`, `npm run build:server` и `pm2 restart kafedra`. Нужны секреты `HOST`, `USERNAME`, `SSH_PRIVATE_KEY`.

HTTPS: `sudo certbot --nginx -d tregubovvn.ru` (если ещё не настроен).

### Вариант 2: Docker

```bash
cp .env.example .env
docker compose up -d --build
```

Образ собирает приложение и запускает его на порту 3000; база — внешний PostgreSQL (Supabase), volume больше не используется. Для подпути собирайте так: `NEXT_PUBLIC_BASE_PATH=/kafedra-assistant docker compose up -d --build` — значение уходит и в build-arg, и в runtime. Схему применяйте вручную (`npm run db:push`) либо задайте `DB_PUSH=1` — тогда контейнер выполнит `node scripts/db-push.mjs` при старте. Перед контейнером положите nginx-прокси (пример выше).

## Настройка DeepSeek

1. Получите ключ на [platform.deepseek.com](https://platform.deepseek.com/).
2. Войдите как заведующий → «Настройки» → DeepSeek → вставьте ключ и сохраните.
3. В «Поручениях» → «Создать поручение» появится работающая кнопка «Улучшить через DeepSeek» (черновик переписывается кратко и официально). Ключ хранится на сервере и передаётся только в DeepSeek API.

## Напоминания о поручениях

Правило: e-mail в последний день срока тем, кто не выполнил. В прототипе — кнопка «Отправить напоминания» во вкладке «Почта» и запись в журнал; при публикации подключается SMTP и cron (`POST /api/mail {"action":"send-reminders"}` из планировщика).

## Модель данных (PostgreSQL)

- `User` — заведующий (HEAD) и преподаватели (TEACHER), пароли — scrypt
- `Session` — токены входа
- `Work` — журнал работ (5 видов, автозаписи из замен)
- `Assignment` / `AssignmentStatus` — поручения и отметки исполнения по адресатам
- `Replacement` / `ReplacementRequest` — замены и просьбы кандидатам (PENDING/ACCEPTED/CANCELLED/DECLINED)
- `ScheduleEntry` — кэш расписаний преподавателей и групп
- `Settings` — ключ DeepSeek
- `MailLog` — журнал исходящих писем

## Дорожная карта

- Адаптер загрузки расписаний с rasp.sstu.ru (страницы кафедр/преподавателей/групп, ежедневный кэш с инициацией первым открывшим)
- SMTP-отправка писем + cron для напоминаний
- Расширение применения DeepSeek (сводки, черновики ответов)
- Статистика по работам кафедры

## Структура

```
.env.example                # шаблон подключения к Supabase (DATABASE_URL)
db/schema.sql               # схема БД (применяется npm run db:push)
scripts/db-push.mjs         # применение схемы
scripts/seed.mjs            # демо-данные кафедры ПМН
src/app/page.tsx            # SPA: вход + маршрутизация по роли
src/app/api/                # REST API (auth, works, assignments, schedule, replacements, settings, deepseek, mail)
src/components/app/         # клиенты: teacher-app (мобильный), head-app (десктоп)
src/components/ui/          # используемый набор shadcn/ui
src/lib/                    # общие модули, API-клиент, авторизация
deploy/nginx.conf.example   # пример конфигурации nginx
```
