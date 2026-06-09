-- Таблица для хранения истории диалогов
CREATE TABLE IF NOT EXISTS conversations (
  id         BIGSERIAL PRIMARY KEY,
  chat_id    TEXT        NOT NULL,
  role       TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индекс для быстрой выборки по chat_id
CREATE INDEX IF NOT EXISTS idx_conversations_chat_id
  ON conversations (chat_id);

-- Составной индекс для сортировки по времени внутри диалога
CREATE INDEX IF NOT EXISTS idx_conversations_chat_id_created_at
  ON conversations (chat_id, created_at DESC);

-- Таблица менеджеров
CREATE TABLE IF NOT EXISTS managers (
  chat_id    TEXT        PRIMARY KEY,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Таблица аналитики запросов
CREATE TABLE IF NOT EXISTS analytics (
  id           BIGSERIAL   PRIMARY KEY,
  chat_id      TEXT        NOT NULL,
  manager_name TEXT        NOT NULL,
  query_text   TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_chat_id
  ON analytics (chat_id);

CREATE INDEX IF NOT EXISTS idx_analytics_created_at
  ON analytics (created_at DESC);
