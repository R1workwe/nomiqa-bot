require('dotenv').config();
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

const roleplaySessions = new Set();
const awaitingName = new Set(); // chat_ids ожидающих ввода имени

// ---------- Managers ----------

async function getManagerName(chatId) {
  const { data } = await supabase
    .from('managers')
    .select('name')
    .eq('chat_id', String(chatId))
    .single();
  return data?.name ?? null;
}

async function saveManager(chatId, name) {
  const { error } = await supabase
    .from('managers')
    .upsert({ chat_id: String(chatId), name }, { onConflict: 'chat_id' });
  if (error) throw error;
}

// ---------- Analytics ----------

async function saveAnalytics(chatId, managerName, queryText) {
  const { error } = await supabase
    .from('analytics')
    .insert({ chat_id: String(chatId), manager_name: managerName, query_text: queryText });
  if (error) console.error('Analytics save error:', error.message);
}

// ---------- Conversations ----------

async function getHistory(chatId) {
  const { data, error } = await supabase
    .from('conversations')
    .select('role, content')
    .eq('chat_id', String(chatId))
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;

  const messages = (data || []).reverse();
  while (messages.length > 0 && messages[0].role !== 'user') messages.shift();
  return messages;
}

async function saveMessage(chatId, role, content) {
  const { error } = await supabase
    .from('conversations')
    .insert({ chat_id: String(chatId), role, content });
  if (error) throw error;
}

async function clearHistory(chatId) {
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('chat_id', String(chatId));
  if (error) throw error;
}

// ---------- Claude ----------

async function askClaude(messages, systemPrompt) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    cache_control: { type: 'ephemeral' },
    system: systemPrompt,
    messages,
  });
  return response.content[0].text;
}

// ---------- Commands ----------

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const existingName = await getManagerName(chatId);
    if (existingName) {
      await bot.sendMessage(
        chatId,
        `👋 С возвращением, *${existingName}*!\n\nЯ готов помочь. Используйте /help для списка команд.`,
        { parse_mode: 'Markdown' }
      );
    } else {
      awaitingName.add(chatId);
      await bot.sendMessage(chatId, '👋 Привет! Я корпоративный ассистент компании *Nomiqa*.\n\nКак тебя зовут?', { parse_mode: 'Markdown' });
    }
  } catch (err) {
    console.error('/start error:', err);
    await bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
  }
});

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(
    chatId,
    'Привет! Я твой личный помощник по продажам 🤖\n\n' +
    'Я помогаю тебе работать с клиентами. Ты общаешься с клиентом сам — я подсказываю что делать и что писать.\n\n' +
    '━━━━━━━━━━━━━━━\n\n' +
    'КАК ПОЛЬЗОВАТЬСЯ:\n\n' +
    '1️⃣ Нажми на команду из меню (кнопка / внизу)\n\n' +
    '2️⃣ Бот спросит детали о клиенте\n\n' +
    '3️⃣ Отвечай подробно — чем больше напишешь, тем лучше совет\n\n' +
    '4️⃣ Получи готовый план или текст сообщения\n\n' +
    '━━━━━━━━━━━━━━━\n\n' +
    'ЧТО УМЕЮ:\n\n' +
    '/strategy — Не знаешь что делать с клиентом? Опиши его — дам план\n\n' +
    '/meeting — Провёл встречу? Расскажи как прошло — разберём ошибки и следующий шаг\n\n' +
    '/objection — Клиент сказал «дорого» или «подумаю»? Напиши что именно — дам ответ\n\n' +
    '/stuck — Клиент пропал или тянет время? Опиши ситуацию — найдём причину\n\n' +
    '/roleplay — Хочешь потренироваться? Сыграю роль клиента перед реальной встречей\n\n' +
    '/forget — Начинаешь новый вопрос? Нажми чтобы очистить историю\n\n' +
    '━━━━━━━━━━━━━━━\n\n' +
    '⚠️ ВАЖНО:\n\n' +
    'Всегда пиши КТО клиент, ОТКУДА, какой БЮДЖЕТ и что УЖЕ было.\n\n' +
    'Без деталей — совет будет бесполезным.',
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/forget/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    await clearHistory(chatId);
    roleplaySessions.delete(chatId);
    await bot.sendMessage(chatId, '🗑️ История диалога очищена. Начнём с чистого листа!');
  } catch (err) {
    console.error('/forget error:', err);
    await bot.sendMessage(chatId, '❌ Ошибка при очистке истории.');
  }
});

bot.onText(/\/strategy/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    await clearHistory(chatId);
    roleplaySessions.delete(chatId);
    await bot.sendMessage(
      chatId,
      'Опиши клиента: имя, откуда, бюджет, мотив, на каком этапе, что последнее было. Дам конкретный план.'
    );
  } catch (err) {
    console.error('/strategy error:', err);
    await bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
  }
});

bot.onText(/\/objection/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    await clearHistory(chatId);
    roleplaySessions.delete(chatId);
    await bot.sendMessage(
      chatId,
      'Какое возражение? Напиши точную фразу клиента и коротко контекст (кто клиент, этап).'
    );
  } catch (err) {
    console.error('/objection error:', err);
    await bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
  }
});

bot.onText(/\/meeting/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    await clearHistory(chatId);
    roleplaySessions.delete(chatId);
    await bot.sendMessage(
      chatId,
      'Расскажи что было на встрече: кто клиент, что говорил, чем закончили, на что согласился или нет.'
    );
  } catch (err) {
    console.error('/meeting error:', err);
    await bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
  }
});

bot.onText(/\/stuck/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    await clearHistory(chatId);
    roleplaySessions.delete(chatId);
    await bot.sendMessage(
      chatId,
      'Опиши ситуацию: кто клиент, сколько касаний было, что последнее происходило, сколько дней молчит.'
    );
  } catch (err) {
    console.error('/stuck error:', err);
    await bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
  }
});

bot.onText(/\/roleplay/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    await clearHistory(chatId);
    roleplaySessions.add(chatId);
    await bot.sendMessage(
      chatId,
      '🎭 *Режим тренировки активирован!*\n\n' +
      'Теперь я играю роль потенциального клиента Nomiqa.\n' +
      'Потренируйтесь в продажах и работе с возражениями.\n\n' +
      'Для выхода используйте /forget.',
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('/roleplay error:', err);
    await bot.sendMessage(chatId, '❌ Ошибка при запуске режима тренировки.');
  }
});

bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  const adminId = process.env.ADMIN_CHAT_ID;

  if (!adminId || String(chatId) !== String(adminId)) {
    await bot.sendMessage(chatId, '⛔ У вас нет доступа к этой команде.');
    return;
  }

  try {
    await bot.sendChatAction(chatId, 'typing');

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: rows } = await supabase
      .from('analytics')
      .select('chat_id, manager_name, query_text, created_at')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false });

    const analytics = rows || [];

    // Топ-10 последних запросов
    const top10 = analytics.slice(0, 10);

    // Активность по менеджерам (первое вхождение = последний запрос, т.к. сортировка desc)
    const managerMap = {};
    for (const row of analytics) {
      if (!managerMap[row.manager_name]) {
        managerMap[row.manager_name] = { count: 0, lastQuery: row.query_text, lastAt: row.created_at };
      }
      managerMap[row.manager_name].count++;
    }

    // Формируем сообщение
    let text = '📊 *Статистика за последние 7 дней*\n\n';

    text += '🔝 *Топ-10 последних запросов:*\n';
    if (top10.length === 0) {
      text += '_Нет данных_\n';
    } else {
      top10.forEach((r, i) => {
        const preview = r.query_text.length > 60 ? r.query_text.slice(0, 60) + '…' : r.query_text;
        text += `${i + 1}. [${r.manager_name}] ${preview}\n`;
      });
    }

    text += '\n👥 *Активность менеджеров:*\n';
    const managers = Object.entries(managerMap).sort((a, b) => b[1].count - a[1].count);
    if (managers.length === 0) {
      text += '_Нет данных_\n';
    } else {
      for (const [name, info] of managers) {
        const date = new Date(info.lastAt).toLocaleDateString('ru-RU');
        const lastPreview = info.lastQuery.length > 50 ? info.lastQuery.slice(0, 50) + '…' : info.lastQuery;
        text += `\n*${name}* — ${info.count} запр.\n`;
        text += `└ последний (${date}): ${lastPreview}\n`;
      }
    }

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('/stats error:', err);
    await bot.sendMessage(chatId, '❌ Ошибка при получении статистики.');
  }
});

// ---------- Message handler ----------

bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const userMessage = msg.text;

  // Обработка ввода имени
  if (awaitingName.has(chatId)) {
    awaitingName.delete(chatId);
    const name = userMessage.trim();
    try {
      await saveManager(chatId, name);
      await bot.sendMessage(
        chatId,
        `Приятно познакомиться, *${name}*! 🤝\n\nЯ готов помочь. Используйте /help для списка команд.`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('Save manager error:', err);
      await bot.sendMessage(chatId, '❌ Не удалось сохранить имя. Попробуйте /start ещё раз.');
    }
    return;
  }

  try {
    await bot.sendChatAction(chatId, 'typing');

    const [history, managerName] = await Promise.all([
      getHistory(chatId),
      getManagerName(chatId),
    ]);

    await Promise.all([
      saveMessage(chatId, 'user', userMessage),
      saveAnalytics(chatId, managerName ?? 'Неизвестный', userMessage),
    ]);

    const messages = [...history, { role: 'user', content: userMessage }];

    const systemPrompt = roleplaySessions.has(chatId)
      ? `Ты играешь роль потенциального клиента компании Nomiqa. Ты заинтересован в продуктах и услугах, но задаёшь уточняющие вопросы и иногда возражаешь. Веди себя как реальный клиент: интересуйся ценами, сроками, гарантиями и условиями. Иногда будь скептичен, иногда заинтересован. Не раскрывай, что ты AI. Отвечай только на русском языке.`
      : process.env.SYSTEM_PROMPT;

    const reply = await askClaude(messages, systemPrompt);
    await saveMessage(chatId, 'assistant', reply);
    await bot.sendMessage(chatId, reply);
  } catch (err) {
    const errLine = `[${new Date().toISOString()}] chat_id=${chatId} ${err?.status ?? ''} ${err?.message ?? err}\n`;
    console.error('Error processing message:', err);
    fs.appendFileSync('error.log', errLine);
    await bot.sendMessage(chatId, '❌ Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

console.log('🤖 Nomiqa Bot запущен!');
