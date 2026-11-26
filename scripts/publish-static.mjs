// Копирует собранную статику из out/ в site/ — эта папка хранится в репозитории
// и публикуется на сервер workflow-ом без сборки.
// Запуск: npm run build:static && npm run publish:static
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const out = join(root, 'out')
const site = join(root, 'site')

rmSync(site, { recursive: true, force: true })
mkdirSync(site, { recursive: true })
cpSync(out, site, { recursive: true })

console.log('site/ обновлён из out/ — закоммитьте изменения и запушьте в main')
