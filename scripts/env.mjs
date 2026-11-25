import { readFileSync } from 'node:fs'

// Единая загрузка DATABASE_URL для скриптов (npm run db:push / db:seed).
// Приоритет: переменная окружения -> .env.local -> .env
export function loadEnv() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  for (const file of ['../.env.local', '../.env']) {
    try {
      const env = readFileSync(new URL(file, import.meta.url), 'utf8')
      const m = env.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/m)
      if (m) {
        // в .env значение может быть в кавычках
        const url = m[1].replace(/^["']|["']$/g, '')
        process.env.DATABASE_URL = url
        return url
      }
    } catch {}
  }

  throw new Error('DATABASE_URL не задан: скопируйте .env.example в .env и вставьте строку подключения Supabase')
}
