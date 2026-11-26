// Настройки статического приложения.
// Файл лежит рядом с index.html и правится прямо на сервере — пересборка не нужна.

window.KAFEDRA_CONFIG = {
  // Проект Supabase
  SUPABASE_URL: 'https://jxhwppkpymdzgsqhmxgn.supabase.co',

  // Project Settings → API → anon public (длинный JWT, начинается на eyJ...)
  SUPABASE_ANON_KEY: 'ВСТАВЬТЕ_ANON_PUBLIC_KEY',

  // Общий пароль для входа в приложение
  SHARED_PASSWORD: 'demo1234',
}
