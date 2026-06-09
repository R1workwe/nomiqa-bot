# Nomiqa Telegram Bot

Корпоративный Telegram-бот на базе Claude AI с хранением истории диалогов в Supabase.

## Возможности

- Изолированные диалоги для каждого менеджера (по `chat_id`)
- История последних 20 сообщений подгружается автоматически
- Команда `/roleplay` — режим тренировки, где AI играет роль клиента
- Команда `/forget` — сброс истории диалога

---

## Шаг 1. Создание Telegram-бота

1. Откройте Telegram и найдите [@BotFather](https://t.me/BotFather)
2. Отправьте команду `/newbot`
3. Введите название бота (например: `Nomiqa Assistant`)
4. Введите username бота (например: `nomiqa_assistant_bot`)
5. Скопируйте выданный **Bot Token** — он понадобится позже

---

## Шаг 2. Настройка Supabase

1. Зайдите на [supabase.com](https://supabase.com) и создайте новый проект
2. После создания перейдите в **SQL Editor**
3. Вставьте содержимое файла `schema.sql` и выполните запрос
4. Перейдите в **Project Settings → API**
5. Скопируйте:
   - **Project URL** (`SUPABASE_URL`)
   - **anon / public key** (`SUPABASE_KEY`)

---

## Шаг 3. Получение Claude API Key

1. Зайдите на [console.anthropic.com](https://console.anthropic.com)
2. Перейдите в **API Keys** и создайте новый ключ
3. Скопируйте ключ (`CLAUDE_API_KEY`)

---

## Шаг 4. Локальный запуск (для теста)

```bash
# Установить зависимости
npm install

# Скопировать файл переменных окружения
cp .env.example .env

# Заполнить .env своими значениями
nano .env  # или откройте в любом редакторе

# Запустить бота
node index.js
```

---

## Шаг 5. Деплой на Railway

### 5.1. Подготовка репозитория

```bash
git init
git add .
git commit -m "Initial commit"
```

Создайте репозиторий на [github.com](https://github.com) и запушьте код:

```bash
git remote add origin https://github.com/ВАШ_USERNAME/nomiqa-bot.git
git push -u origin main
```

### 5.2. Создание проекта на Railway

1. Зайдите на [railway.app](https://railway.app) и войдите через GitHub
2. Нажмите **New Project → Deploy from GitHub repo**
3. Выберите репозиторий `nomiqa-bot`
4. Railway автоматически обнаружит `package.json` и запустит `npm start`

### 5.3. Настройка переменных окружения на Railway

1. В проекте Railway перейдите в **Variables**
2. Добавьте следующие переменные (значения из шагов 1–3):

| Переменная | Значение |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token от @BotFather |
| `CLAUDE_API_KEY` | Ключ Anthropic |
| `SUPABASE_URL` | URL вашего Supabase проекта |
| `SUPABASE_KEY` | anon key из Supabase |
| `SYSTEM_PROMPT` | Инструкции для AI (см. пример ниже) |

**Пример SYSTEM_PROMPT:**
```
Ты корпоративный ассистент компании Nomiqa. Помогаешь менеджерам по продажам с вопросами о продуктах, скриптами переговоров и обработкой возражений. Отвечай профессионально, конкретно и только на русском языке.
```

### 5.4. Деплой

После добавления переменных Railway автоматически перезапустит сервис. Бот начнёт работать в течение 1–2 минут.

Проверить логи можно в разделе **Deployments → Logs**.

---

## Команды бота

| Команда | Описание |
|---|---|
| `/start` | Приветствие |
| `/help` | Список команд |
| `/forget` | Очистить историю диалога |
| `/roleplay` | Режим тренировки (AI — клиент) |

---

## Структура проекта

```
nomiqa-bot/
├── index.js        # Основной файл бота
├── package.json    # Зависимости
├── schema.sql      # SQL-схема для Supabase
├── .env.example    # Шаблон переменных окружения
└── README.md       # Эта инструкция
```
