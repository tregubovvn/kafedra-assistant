// Применение схемы БД (db/schema.sql) к PostgreSQL в Supabase.
// Запуск: npm run db:push
import postgres from 'postgres'
import { fileURLToPath } from 'node:url'
import { loadEnv } from './env.mjs'

const sql = postgres(loadEnv(), { max: 1, prepare: false, onnotice: () => {} })

try {
  const schemaPath = fileURLToPath(new URL('../db/schema.sql', import.meta.url))
  await sql.file(schemaPath)
  console.log('Схема применена: ' + schemaPath)
} finally {
  await sql.end()
}
