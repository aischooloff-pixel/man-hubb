import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_BOT_TOKEN = Deno.env.get('ADMIN_BOT_TOKEN')!;
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const TELEGRAM_ADMIN_CHAT_ID = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const USERS_PER_PAGE = 20;
const ARTICLES_PER_PAGE = 10;

// Send message via Admin Bot
async function sendAdminMessage(chatId: string | number, text: string, options: any = {}) {
  const url = `https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/sendMessage`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...options,
    }),
  });
  
  return response.json();
}

// Edit message
async function editAdminMessage(chatId: string | number, messageId: number, text: string, options: any = {}) {
  const url = `https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/editMessageText`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      ...options,
    }),
  });
  
  return response.json();
}

// Send message to user via User Bot
async function sendUserMessage(chatId: string | number, text: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }),
  });
  
  return response.json();
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  const url = `https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/answerCallbackQuery`;
  
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
    }),
  });
}

async function editMessageReplyMarkup(chatId: string | number, messageId: number) {
  const url = `https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/editMessageReplyMarkup`;
  
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    }),
  });
}

async function deleteMessage(chatId: string | number, messageId: number) {
  const url = `https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/deleteMessage`;
  
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
    }),
  });
}

// Check if user is admin
function isAdmin(userId: number): boolean {
  return userId.toString() === TELEGRAM_ADMIN_CHAT_ID;
}

// Handle /start command
async function handleStart(chatId: number, userId: number) {
  if (!isAdmin(userId)) {
    await sendAdminMessage(chatId, '⛔ Доступ запрещён. Этот бот только для администраторов.');
    return;
  }

  const welcomeMessage = `🔐 <b>BoysHub Admin Bot</b>

Добро пожаловать в админ-панель!

<b>Доступные команды:</b>

📊 /stats — Статистика проекта
👥 /users — Список пользователей
👑 /premium — Управление подписками
📝 /pending — Статьи на модерации
📰 /st — Список статей
❓ /questions — Вопросы в поддержку
📢 /broadcast — Рассылка всем пользователям
❓ /help — Справка

<b>Управление Premium:</b>
/extend [telegram_id] [дней] — Продлить Premium

<b>Поиск статей:</b>
/search_st [запрос] — Поиск по заголовку

<i>Уведомления о новых статьях и вопросах приходят автоматически.</i>`;

  await sendAdminMessage(chatId, welcomeMessage);
}

// Handle /stats command
async function handleStats(chatId: number, userId: number) {
  if (!isAdmin(userId)) return;

  console.log('Fetching stats...');

  // Get user count
  const { count: userCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  // Get premium user count
  const { count: premiumCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('is_premium', true);

  // Get blocked user count
  const { count: blockedCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('is_blocked', true);

  // Get article counts by status
  const { data: articles } = await supabase
    .from('articles')
    .select('status');

  const stats = {
    total: articles?.length || 0,
    pending: articles?.filter(a => a.status === 'pending').length || 0,
    approved: articles?.filter(a => a.status === 'approved').length || 0,
    rejected: articles?.filter(a => a.status === 'rejected').length || 0,
  };

  const message = `📊 <b>Статистика BoysHub</b>

👥 <b>Пользователей:</b> ${userCount || 0}
👑 <b>Premium:</b> ${premiumCount || 0}
🚫 <b>Заблокировано:</b> ${blockedCount || 0}

📝 <b>Статьи:</b>
├ Всего: ${stats.total}
├ ⏳ На модерации: ${stats.pending}
├ ✅ Опубликовано: ${stats.approved}
└ ❌ Отклонено: ${stats.rejected}`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '👥 Открыть список пользователей', callback_data: 'users:0' }],
      [{ text: '📰 Открыть список статей', callback_data: 'articles:0' }],
    ],
  };

  await sendAdminMessage(chatId, message, { reply_markup: keyboard });
}

// Handle /users command - list users with pagination
async function handleUsers(chatId: number, userId: number, page: number = 0, messageId?: number) {
  if (!isAdmin(userId)) return;

  const from = page * USERS_PER_PAGE;
  
  // Get total count
  const { count: totalCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  // Get users for current page
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, telegram_id, username, first_name, last_name, is_premium, is_blocked, reputation, created_at')
    .order('created_at', { ascending: false })
    .range(from, from + USERS_PER_PAGE - 1);

  if (error) {
    console.error('Error fetching users:', error);
    await sendAdminMessage(chatId, '❌ Ошибка при загрузке пользователей');
    return;
  }

  const totalPages = Math.ceil((totalCount || 0) / USERS_PER_PAGE);

  let message = `👥 <b>Пользователи</b> (${totalCount || 0})\n`;
  message += `📄 Страница ${page + 1}/${totalPages || 1}\n\n`;

  if (!users || users.length === 0) {
    message += '<i>Пользователей нет</i>';
  } else {
    for (const user of users) {
      const premium = user.is_premium ? '👑' : '';
      const blocked = user.is_blocked ? '🚫' : '';
      const username = user.username ? `@${user.username}` : `ID:${user.telegram_id}`;
      message += `${premium}${blocked} <b>${username}</b>\n`;
      message += `   🆔 ${user.telegram_id || 'N/A'} | ⭐ ${user.reputation || 0}\n`;
    }
  }

  message += `\n🔍 Для поиска: <code>/search username</code> или <code>/search ID</code>`;

  // Create user buttons for quick actions
  const userButtons: any[][] = [];
  if (users) {
    for (const user of users) {
      const label = user.username ? `@${user.username}` : `${user.telegram_id}`;
      userButtons.push([{ text: `👤 ${label}`, callback_data: `user:${user.telegram_id}` }]);
    }
  }

  // Pagination buttons (всегда 2 кнопки, чтобы сообщение "перелистывалось")
  const prevPage = page > 0 ? page - 1 : page;
  const nextPage = page < totalPages - 1 ? page + 1 : page;

  const navRow = [
    { text: '⬅️ Назад', callback_data: `users:${prevPage}` },
    { text: 'Вперёд ➡️', callback_data: `users:${nextPage}` },
  ];

  const keyboard = {
    inline_keyboard: [...userButtons, navRow],
  };

  if (messageId) {
    await editAdminMessage(chatId, messageId, message, { reply_markup: keyboard });
  } else {
    await sendAdminMessage(chatId, message, { reply_markup: keyboard });
  }
}

// Handle user profile view
async function handleUserProfile(callbackQuery: any, telegramId: string) {
  const { id, message, from } = callbackQuery;

  const { data: user, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (error || !user) {
    await answerCallbackQuery(id, '❌ Пользователь не найден');
    return;
  }

  const premium = user.is_premium ? '👑 Premium' : '👤 Обычный';
  const blocked = user.is_blocked ? '\n🚫 <b>ЗАБЛОКИРОВАН</b>' : '';
  const premiumExpiry = user.premium_expires_at 
    ? `\n📅 Premium до: ${new Date(user.premium_expires_at).toLocaleDateString('ru-RU')}`
    : '';

  const profileMessage = `👤 <b>Профиль пользователя</b>${blocked}

📛 <b>Имя:</b> ${user.first_name || ''} ${user.last_name || ''}
🔗 <b>Username:</b> ${user.username ? `@${user.username}` : 'Не указан'}
🆔 <b>Telegram ID:</b> ${user.telegram_id}
⭐ <b>Репутация:</b> ${user.reputation || 0}
📊 <b>Статус:</b> ${premium}${premiumExpiry}
📅 <b>Регистрация:</b> ${new Date(user.created_at).toLocaleDateString('ru-RU')}`;

  // Build action buttons
  const buttons: any[][] = [];
  
  // Premium buttons
  if (user.is_premium) {
    buttons.push([{ text: '❌ Забрать Premium', callback_data: `premium_revoke:${user.telegram_id}` }]);
    buttons.push([{ text: '📅 Продлить на 30 дней', callback_data: `premium_extend:${user.telegram_id}:30` }]);
  } else {
    buttons.push([{ text: '👑 Выдать Premium (30 дней)', callback_data: `premium_grant:${user.telegram_id}` }]);
  }

  // Block/unblock buttons
  if (user.is_blocked) {
    buttons.push([{ text: '✅ Разблокировать', callback_data: `unblock:${user.telegram_id}` }]);
  } else {
    buttons.push([{ text: '🚫 Заблокировать', callback_data: `block:${user.telegram_id}` }]);
  }

  buttons.push([{ text: '◀️ Назад к списку', callback_data: 'users:0' }]);

  const keyboard = { inline_keyboard: buttons };

  await answerCallbackQuery(id);
  await editAdminMessage(message.chat.id, message.message_id, profileMessage, { reply_markup: keyboard });
}

// Handle /search command
async function handleSearch(chatId: number, userId: number, query: string) {
  if (!isAdmin(userId)) return;

  if (!query) {
    await sendAdminMessage(chatId, `🔍 <b>Поиск пользователей</b>

Используйте:
<code>/search username</code> — поиск по юзернейму
<code>/search 123456789</code> — поиск по Telegram ID`);
    return;
  }

  // Clean query - remove @ if present
  const cleanQuery = query.replace('@', '').trim();

  // Try to find by telegram_id or username
  let users;
  const isNumeric = /^\d+$/.test(cleanQuery);

  if (isNumeric) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('telegram_id', cleanQuery);
    users = data;
  } else {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${cleanQuery}%`);
    users = data;
  }

  if (!users || users.length === 0) {
    await sendAdminMessage(chatId, `🔍 Пользователь "<b>${query}</b>" не найден`);
    return;
  }

  for (const user of users) {
    const premium = user.is_premium ? '👑 Premium' : '👤 Обычный';
    const blocked = user.is_blocked ? '\n🚫 <b>ЗАБЛОКИРОВАН</b>' : '';
    const premiumExpiry = user.premium_expires_at 
      ? `\n📅 Premium до: ${new Date(user.premium_expires_at).toLocaleDateString('ru-RU')}`
      : '';

    const message = `👤 <b>Профиль пользователя</b>${blocked}

📛 <b>Имя:</b> ${user.first_name || ''} ${user.last_name || ''}
🔗 <b>Username:</b> ${user.username ? `@${user.username}` : 'Не указан'}
🆔 <b>Telegram ID:</b> ${user.telegram_id}
⭐ <b>Репутация:</b> ${user.reputation || 0}
📊 <b>Статус:</b> ${premium}${premiumExpiry}
📅 <b>Регистрация:</b> ${new Date(user.created_at).toLocaleDateString('ru-RU')}`;

    // Build action buttons
    const buttons: any[][] = [];
    
    if (user.is_premium) {
      buttons.push([{ text: '❌ Забрать Premium', callback_data: `premium_revoke:${user.telegram_id}` }]);
      buttons.push([{ text: '📅 Продлить на 30 дней', callback_data: `premium_extend:${user.telegram_id}:30` }]);
    } else {
      buttons.push([{ text: '👑 Выдать Premium (30 дней)', callback_data: `premium_grant:${user.telegram_id}` }]);
    }

    if (user.is_blocked) {
      buttons.push([{ text: '✅ Разблокировать', callback_data: `unblock:${user.telegram_id}` }]);
    } else {
      buttons.push([{ text: '🚫 Заблокировать', callback_data: `block:${user.telegram_id}` }]);
    }

    const keyboard = { inline_keyboard: buttons };

    await sendAdminMessage(chatId, message, { reply_markup: keyboard });
  }
}

// Handle /premium command
async function handlePremium(chatId: number, userId: number) {
  if (!isAdmin(userId)) return;

  const { count: premiumCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('is_premium', true);

  const { data: premiumUsers } = await supabase
    .from('profiles')
    .select('telegram_id, username, first_name, premium_expires_at')
    .eq('is_premium', true)
    .order('premium_expires_at', { ascending: true })
    .limit(10);

  let message = `👑 <b>Управление Premium</b>

Всего Premium пользователей: <b>${premiumCount || 0}</b>

<b>Команды:</b>
• /search [username/ID] — найти пользователя
• /extend [telegram_id] [дней] — продлить подписку
• Нажмите кнопку на карточке пользователя

<b>Premium пользователи:</b>\n`;

  if (premiumUsers && premiumUsers.length > 0) {
    for (const user of premiumUsers) {
      const username = user.username ? `@${user.username}` : `ID:${user.telegram_id}`;
      const expiry = user.premium_expires_at 
        ? new Date(user.premium_expires_at).toLocaleDateString('ru-RU')
        : '∞';
      message += `\n👑 <b>${username}</b>\n   📅 До: ${expiry}\n`;
    }
  } else {
    message += '\n<i>Пока нет Premium пользователей</i>';
  }

  await sendAdminMessage(chatId, message);
}

// Handle premium grant
async function handlePremiumGrant(callbackQuery: any, telegramId: string) {
  const { id, message } = callbackQuery;

  console.log('Granting premium to telegram_id:', telegramId);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  // Find profile first
  const { data: profile, error: findError } = await supabase
    .from('profiles')
    .select('id, telegram_id, username')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (findError || !profile) {
    console.error('Error finding profile:', findError);
    await answerCallbackQuery(id, '❌ Пользователь не найден');
    return;
  }

  console.log('Found profile:', profile.id, 'updating premium...');

  const { error } = await supabase
    .from('profiles')
    .update({ 
      is_premium: true,
      premium_expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', profile.id);

  if (error) {
    console.error('Error granting premium:', error);
    await answerCallbackQuery(id, '❌ Ошибка при обновлении');
    return;
  }

  console.log('Premium granted successfully');

  // Notify user
  await sendUserMessage(telegramId, `🎉 <b>Поздравляем!</b>

Вам выдана Premium подписка на 30 дней!

Теперь вам доступны:
👑 Продажа продуктов через профиль
📱 Соц сети в профиле  
🤖 ИИ ассистент
📚 Премиум материалы
♾ Безлимит публикаций
✨ PRO значок

Подписка активна до: ${expiresAt.toLocaleDateString('ru-RU')}`);

  await answerCallbackQuery(id, '✅ Premium выдан');
  await editMessageReplyMarkup(message.chat.id, message.message_id);
  
  const username = profile.username ? `@${profile.username}` : telegramId;
  await sendAdminMessage(message.chat.id, `✅ Premium выдан пользователю ${username} до ${expiresAt.toLocaleDateString('ru-RU')}`);
}

// Handle premium revoke
async function handlePremiumRevoke(callbackQuery: any, telegramId: string) {
  const { id, message } = callbackQuery;

  console.log('Revoking premium from telegram_id:', telegramId);

  const { data: profile, error: findError } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (findError || !profile) {
    console.error('Error finding profile:', findError);
    await answerCallbackQuery(id, '❌ Пользователь не найден');
    return;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ 
      is_premium: false,
      premium_expires_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', profile.id);

  if (error) {
    console.error('Error revoking premium:', error);
    await answerCallbackQuery(id, '❌ Ошибка');
    return;
  }

  // Notify user
  await sendUserMessage(telegramId, `ℹ️ <b>Уведомление</b>

Ваша Premium подписка была отменена.

Вы можете приобрести её снова в приложении BoysHub.`);

  await answerCallbackQuery(id, '✅ Premium отозван');
  await editMessageReplyMarkup(message.chat.id, message.message_id);
  
  const username = profile.username ? `@${profile.username}` : telegramId;
  await sendAdminMessage(message.chat.id, `❌ Premium отозван у пользователя ${username}`);
}

// Handle premium extend with custom days
async function handlePremiumExtend(callbackQuery: any, telegramId: string, days: number = 30) {
  const { id, message } = callbackQuery;

  console.log('Extending premium for telegram_id:', telegramId, 'days:', days);

  const { data: profile, error: findError } = await supabase
    .from('profiles')
    .select('id, premium_expires_at, is_premium, username')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (findError || !profile) {
    console.error('Error finding profile:', findError);
    await answerCallbackQuery(id, '❌ Пользователь не найден');
    return;
  }

  let newExpiry: Date;
  if (profile.premium_expires_at && new Date(profile.premium_expires_at) > new Date()) {
    newExpiry = new Date(profile.premium_expires_at);
  } else {
    newExpiry = new Date();
  }
  newExpiry.setDate(newExpiry.getDate() + days);

  const { error } = await supabase
    .from('profiles')
    .update({ 
      is_premium: true,
      premium_expires_at: newExpiry.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', profile.id);

  if (error) {
    console.error('Error extending premium:', error);
    await answerCallbackQuery(id, '❌ Ошибка');
    return;
  }

  // Notify user
  await sendUserMessage(telegramId, `🎉 <b>Premium продлён!</b>

Ваша подписка продлена на ${days} дней.
Новая дата окончания: ${newExpiry.toLocaleDateString('ru-RU')}`);

  await answerCallbackQuery(id, '✅ Premium продлён');
  await editMessageReplyMarkup(message.chat.id, message.message_id);
  
  const username = profile.username ? `@${profile.username}` : telegramId;
  await sendAdminMessage(message.chat.id, `✅ Premium продлён для ${username} на ${days} дней (до ${newExpiry.toLocaleDateString('ru-RU')})`);
}

// Handle /extend command - extend premium by custom days
async function handleExtendCommand(chatId: number, userId: number, args: string) {
  if (!isAdmin(userId)) return;

  const parts = args.trim().split(/\s+/);
  if (parts.length < 2) {
    await sendAdminMessage(chatId, `📅 <b>Продление Premium</b>

Используйте:
<code>/extend [telegram_id] [дней]</code>

Примеры:
<code>/extend 123456789 7</code> — продлить на 7 дней
<code>/extend 123456789 90</code> — продлить на 90 дней`);
    return;
  }

  const telegramId = parts[0];
  const days = parseInt(parts[1]);

  if (isNaN(days) || days <= 0 || days > 365) {
    await sendAdminMessage(chatId, '❌ Укажите количество дней от 1 до 365');
    return;
  }

  const { data: profile, error: findError } = await supabase
    .from('profiles')
    .select('id, premium_expires_at, is_premium, username')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (findError || !profile) {
    await sendAdminMessage(chatId, `❌ Пользователь с ID ${telegramId} не найден`);
    return;
  }

  let newExpiry: Date;
  if (profile.premium_expires_at && new Date(profile.premium_expires_at) > new Date()) {
    newExpiry = new Date(profile.premium_expires_at);
  } else {
    newExpiry = new Date();
  }
  newExpiry.setDate(newExpiry.getDate() + days);

  const { error } = await supabase
    .from('profiles')
    .update({ 
      is_premium: true,
      premium_expires_at: newExpiry.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', profile.id);

  if (error) {
    await sendAdminMessage(chatId, '❌ Ошибка при продлении');
    return;
  }

  await sendUserMessage(telegramId, `🎉 <b>Premium продлён!</b>

Ваша подписка продлена на ${days} дней.
Новая дата окончания: ${newExpiry.toLocaleDateString('ru-RU')}`);

  const username = profile.username ? `@${profile.username}` : telegramId;
  await sendAdminMessage(chatId, `✅ Premium продлён для ${username} на ${days} дней (до ${newExpiry.toLocaleDateString('ru-RU')})`);
}

// Handle block user
async function handleBlockUser(callbackQuery: any, telegramId: string) {
  const { id, message } = callbackQuery;

  const { data: profile, error: findError } = await supabase
    .from('profiles')
    .select('id, username, is_premium')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (findError || !profile) {
    await answerCallbackQuery(id, '❌ Пользователь не найден');
    return;
  }

  // Block user and revoke premium
  const { error } = await supabase
    .from('profiles')
    .update({ 
      is_blocked: true,
      blocked_at: new Date().toISOString(),
      is_premium: false,
      premium_expires_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', profile.id);

  if (error) {
    console.error('Error blocking user:', error);
    await answerCallbackQuery(id, '❌ Ошибка');
    return;
  }

  // Notify user
  await sendUserMessage(telegramId, `🚫 <b>Ваш аккаунт заблокирован</b>

Вы больше не можете использовать BoysHub.

Если вы считаете, что это ошибка, обратитесь в поддержку.`);

  await answerCallbackQuery(id, '🚫 Пользователь заблокирован');
  await editMessageReplyMarkup(message.chat.id, message.message_id);
  
  const username = profile.username ? `@${profile.username}` : telegramId;
  await sendAdminMessage(message.chat.id, `🚫 Пользователь ${username} заблокирован`);
}

// Handle unblock user
async function handleUnblockUser(callbackQuery: any, telegramId: string) {
  const { id, message } = callbackQuery;

  const { data: profile, error: findError } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (findError || !profile) {
    await answerCallbackQuery(id, '❌ Пользователь не найден');
    return;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ 
      is_blocked: false,
      blocked_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', profile.id);

  if (error) {
    console.error('Error unblocking user:', error);
    await answerCallbackQuery(id, '❌ Ошибка');
    return;
  }

  // Notify user
  await sendUserMessage(telegramId, `✅ <b>Ваш аккаунт разблокирован</b>

Вы снова можете использовать BoysHub.`);

  await answerCallbackQuery(id, '✅ Пользователь разблокирован');
  await editMessageReplyMarkup(message.chat.id, message.message_id);
  
  const username = profile.username ? `@${profile.username}` : telegramId;
  await sendAdminMessage(message.chat.id, `✅ Пользователь ${username} разблокирован`);
}

// Handle /pending command - show pending articles
async function handlePending(chatId: number, userId: number) {
  if (!isAdmin(userId)) return;

  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, title, preview, created_at, author:author_id(first_name, username, telegram_id)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching pending articles:', error);
    await sendAdminMessage(chatId, '❌ Ошибка при загрузке статей');
    return;
  }

  if (!articles || articles.length === 0) {
    await sendAdminMessage(chatId, '✨ Нет статей на модерации');
    return;
  }

  await sendAdminMessage(chatId, `📝 <b>Статьи на модерации (${articles.length}):</b>\n\nНажмите на статью для модерации:`);

  for (const article of articles) {
    const shortId = await getOrCreateShortId(article.id);
    const authorData = article.author as any;
    const authorDisplay = authorData?.username ? `@${authorData.username}` : `ID:${authorData?.telegram_id || 'N/A'}`;
    
    const message = `📄 <b>${article.title}</b>

👤 Автор: ${authorDisplay}

📝 ${article.preview?.substring(0, 150) || 'Нет превью'}...

🕐 ${new Date(article.created_at).toLocaleString('ru-RU')}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Принять', callback_data: `approve:${shortId}` },
          { text: '❌ Отклонить', callback_data: `reject:${shortId}` },
        ],
      ],
    };

    await sendAdminMessage(chatId, message, { reply_markup: keyboard });
  }
}

// Handle /st command - show published articles with pagination
async function handleArticles(chatId: number, userId: number, page: number = 0, messageId?: number, searchQuery?: string) {
  if (!isAdmin(userId)) return;

  const from = page * ARTICLES_PER_PAGE;

  let query = supabase
    .from('articles')
    .select('id, title, created_at, status, author:author_id(username, telegram_id)', { count: 'exact' })
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (searchQuery) {
    query = query.ilike('title', `%${searchQuery}%`);
  }

  const { data: articles, count: totalCount, error } = await query.range(from, from + ARTICLES_PER_PAGE - 1);

  if (error) {
    console.error('Error fetching articles:', error);
    await sendAdminMessage(chatId, '❌ Ошибка при загрузке статей');
    return;
  }

  const totalPages = Math.ceil((totalCount || 0) / ARTICLES_PER_PAGE);

  let message = `📰 <b>Опубликованные статьи</b> (${totalCount || 0})`;
  if (searchQuery) {
    message += `\n🔍 Поиск: "${searchQuery}"`;
  }
  message += `\n📄 Страница ${page + 1}/${totalPages || 1}\n\n`;

  if (!articles || articles.length === 0) {
    message += searchQuery ? '<i>Статьи не найдены</i>' : '<i>Нет опубликованных статей</i>';
  } else {
    for (const article of articles) {
      const authorData = article.author as any;
      const authorDisplay = authorData?.username ? `@${authorData.username}` : `ID:${authorData?.telegram_id || 'N/A'}`;
      const date = new Date(article.created_at).toLocaleDateString('ru-RU');
      const time = new Date(article.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      
      message += `📄 <b>${article.title.substring(0, 40)}${article.title.length > 40 ? '...' : ''}</b>\n`;
      message += `   👤 ${authorDisplay} | 📅 ${date} ${time}\n\n`;
    }
  }

  message += `\n🔍 Поиск: <code>/search_st запрос</code>`;

  // Create article buttons (используем short_id из moderation_short_ids)
  const articleButtons: any[][] = [];
  if (articles) {
    for (const article of articles) {
      const shortId = await getOrCreateShortId(article.id);
      const shortTitle = article.title.length > 25 ? article.title.substring(0, 25) + '...' : article.title;
      articleButtons.push([{ text: `📄 ${shortTitle}`, callback_data: `article:${shortId}` }]);
    }
  }

  // Pagination buttons
  const navButtons: any[] = [];
  if (page > 0) {
    navButtons.push({ text: '⬅️ Назад', callback_data: `articles:${page - 1}` });
  }
  if (page < totalPages - 1) {
    navButtons.push({ text: 'Вперёд ➡️', callback_data: `articles:${page + 1}` });
  }

  const keyboard = {
    inline_keyboard: [...articleButtons, ...(navButtons.length > 0 ? [navButtons] : [])],
  };

  if (messageId) {
    await editAdminMessage(chatId, messageId, message, { reply_markup: keyboard });
  } else {
    await sendAdminMessage(chatId, message, { reply_markup: keyboard });
  }
}

// Handle article view
async function handleViewArticle(callbackQuery: any, articleShortId: string) {
  const { id, message } = callbackQuery;

  const articleId = await getArticleIdByShortId(articleShortId);
  if (!articleId) {
    await answerCallbackQuery(id, '❌ Статья не найдена');
    return;
  }

  const { data: article, error } = await supabase
    .from('articles')
    .select('id, title, preview, body, created_at, status, author:author_id(username, telegram_id, first_name)')
    .eq('id', articleId)
    .maybeSingle();

  if (error || !article) {
    await answerCallbackQuery(id, '❌ Статья не найдена');
    return;
  }

  const authorData = article.author as any;
  const authorDisplay = authorData?.username ? `@${authorData.username}` : `ID:${authorData?.telegram_id || 'N/A'}`;
  const date = new Date(article.created_at).toLocaleDateString('ru-RU');
  const time = new Date(article.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  const articleMessage = `📄 <b>${article.title}</b>

👤 <b>Автор:</b> ${authorDisplay}
📅 <b>Дата:</b> ${date} ${time}
📊 <b>Статус:</b> ${article.status === 'approved' ? '✅ Опубликована' : article.status}

📝 <b>Превью:</b>
${article.preview || article.body?.substring(0, 300) || 'Нет превью'}...`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '🗑 Удалить статью', callback_data: `delete_article:${articleShortId}` }],
      [{ text: '◀️ Назад к списку', callback_data: 'articles:0' }],
    ],
  };

  await answerCallbackQuery(id);
  await editAdminMessage(message.chat.id, message.message_id, articleMessage, { reply_markup: keyboard });
}

// Handle delete article
async function handleDeleteArticle(callbackQuery: any, articleShortId: string) {
  const { id, message } = callbackQuery;

  const articleId = await getArticleIdByShortId(articleShortId);
  if (!articleId) {
    await answerCallbackQuery(id, '❌ Статья не найдена');
    return;
  }

  const { data: article, error: findError } = await supabase
    .from('articles')
    .select('id, title, author:author_id(telegram_id)')
    .eq('id', articleId)
    .maybeSingle();

  if (findError || !article) {
    await answerCallbackQuery(id, '❌ Статья не найдена');
    return;
  }

  const { error } = await supabase
    .from('articles')
    .delete()
    .eq('id', article.id);

  if (error) {
    console.error('Error deleting article:', error);
    await answerCallbackQuery(id, '❌ Ошибка при удалении');
    return;
  }

  // Notify author
  const authorData = article.author as any;
  if (authorData?.telegram_id) {
    await sendUserMessage(authorData.telegram_id, `ℹ️ <b>Уведомление</b>

Ваша статья "${article.title}" была удалена администратором.`);
  }

  await answerCallbackQuery(id, '✅ Статья удалена');
  await sendAdminMessage(message.chat.id, `🗑 Статья "${article.title}" удалена`);
  
  // Go back to articles list
  await handleArticles(message.chat.id, parseInt(TELEGRAM_ADMIN_CHAT_ID), 0);
}

// Handle /search_st command
async function handleSearchArticles(chatId: number, userId: number, query: string) {
  if (!isAdmin(userId)) return;

  if (!query) {
    await sendAdminMessage(chatId, `🔍 <b>Поиск статей</b>

Используйте:
<code>/search_st заголовок</code>

Пример:
<code>/search_st криптовалюта</code>`);
    return;
  }

  await handleArticles(chatId, userId, 0, undefined, query);
}

// Handle /broadcast command
async function handleBroadcast(chatId: number, userId: number, text?: string) {
  if (!isAdmin(userId)) return;

  if (!text || text === '/broadcast') {
    await sendAdminMessage(chatId, `📢 <b>Рассылка</b>

Чтобы отправить сообщение всем пользователям, используйте:

<code>/broadcast Текст сообщения</code>

Пример:
<code>/broadcast Привет! У нас новый функционал!</code>`);
    return;
  }

  const { data: users, error } = await supabase
    .from('profiles')
    .select('telegram_id')
    .eq('is_blocked', false)
    .not('telegram_id', 'is', null);

  if (error) {
    console.error('Error fetching users:', error);
    await sendAdminMessage(chatId, '❌ Ошибка при загрузке пользователей');
    return;
  }

  if (!users || users.length === 0) {
    await sendAdminMessage(chatId, '❌ Нет пользователей для рассылки');
    return;
  }

  const broadcastText = text.replace('/broadcast ', '');
  let sent = 0;
  let failed = 0;

  await sendAdminMessage(chatId, `📤 Отправка сообщения ${users.length} пользователям...`);

  for (const user of users) {
    if (user.telegram_id) {
      try {
        const result = await sendUserMessage(user.telegram_id, `📢 <b>Объявление от BoysHub</b>\n\n${broadcastText}`);
        if (result.ok) {
          sent++;
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
      }
    }
  }

  await sendAdminMessage(chatId, `✅ <b>Рассылка завершена</b>

📤 Отправлено: ${sent}
❌ Не доставлено: ${failed}`);
}

// Handle /questions command - show pending support questions with inline buttons
async function handleQuestions(chatId: number, userId: number) {
  if (!isAdmin(userId)) return;

  const { data: questions, error } = await supabase
    .from('support_questions')
    .select('id, user_telegram_id, question, created_at, user_profile_id')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error fetching questions:', error);
    await sendAdminMessage(chatId, '❌ Ошибка при загрузке вопросов');
    return;
  }

  if (!questions || questions.length === 0) {
    await sendAdminMessage(chatId, '✨ Нет вопросов в поддержку');
    return;
  }

  // Create inline buttons for each question
  const buttons = questions.map(q => {
    const shortQuestion = q.question.length > 30 
      ? q.question.substring(0, 30) + '...' 
      : q.question;
    return [{ text: `❓ ${shortQuestion}`, callback_data: `question:${q.id.substring(0, 8)}` }];
  });

  const keyboard = {
    inline_keyboard: buttons,
  };

  await sendAdminMessage(chatId, `❓ <b>Вопросы в поддержку (${questions.length}):</b>\n\n<i>Нажмите на вопрос, чтобы открыть его. Для ответа используйте функцию "Ответить" (свайп влево) на сообщение с вопросом.</i>`, { reply_markup: keyboard });
}

// Handle question view callback
async function handleViewQuestion(callbackQuery: any, questionShortId: string) {
  const { id, message, from } = callbackQuery;

  const { data: question, error } = await supabase
    .from('support_questions')
    .select('id, user_telegram_id, question, created_at')
    .ilike('id', `${questionShortId}%`)
    .eq('status', 'pending')
    .maybeSingle();

  if (error || !question) {
    await answerCallbackQuery(id, '❌ Вопрос не найден');
    return;
  }

  // Get user profile for username
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, telegram_id')
    .eq('telegram_id', question.user_telegram_id)
    .maybeSingle();

  const userDisplay = profile?.username ? `@${profile.username}` : `ID:${question.user_telegram_id}`;

  const questionMessage = `❓ <b>Новый вопрос в поддержку</b>

👤 <b>От:</b> ${userDisplay}
🆔 <b>Telegram ID:</b> ${question.user_telegram_id}

📝 <b>Вопрос:</b>
${question.question}

<i>Чтобы ответить, используйте функцию "Ответить" на это сообщение.</i>`;

  await answerCallbackQuery(id);
  
  const result = await sendAdminMessage(message.chat.id, questionMessage);
  
  // Save message ID for reply tracking
  if (result.ok && result.result?.message_id) {
    await supabase
      .from('support_questions')
      .update({ admin_message_id: result.result.message_id })
      .eq('id', question.id);
  }
}

// Handle reply to support question
async function handleSupportReply(chatId: number, userId: number, text: string, replyToMessageId: number): Promise<boolean> {
  if (!isAdmin(userId)) return false;

  console.log('Checking for support question with admin_message_id:', replyToMessageId);

  const { data: question, error } = await supabase
    .from('support_questions')
    .select('id, user_telegram_id, question')
    .eq('admin_message_id', replyToMessageId)
    .eq('status', 'pending')
    .maybeSingle();

  if (error) {
    console.error('Error finding question:', error);
    return false;
  }
  
  if (!question) {
    console.log('No pending question found for message_id:', replyToMessageId);
    return false;
  }

  console.log('Found question:', question.id, 'sending reply to user:', question.user_telegram_id);

  // Update question status
  const { error: updateError } = await supabase
    .from('support_questions')
    .update({
      answer: text,
      answered_by_telegram_id: userId,
      status: 'answered',
      answered_at: new Date().toISOString(),
    })
    .eq('id', question.id);

  if (updateError) {
    console.error('Error updating question:', updateError);
    await sendAdminMessage(chatId, '❌ Ошибка при сохранении ответа');
    return true;
  }

  // Send reply to user
  const sendResult = await sendUserMessage(
    question.user_telegram_id,
    `💬 <b>Ответ от поддержки BoysHub</b>

<b>Ваш вопрос:</b>
${question.question}

<b>Ответ:</b>
${text}

<i>Если у вас есть ещё вопросы, напишите /start и выберите поддержку.</i>`
  );

  console.log('Send result:', sendResult);

  await sendAdminMessage(chatId, `✅ Ответ отправлен пользователю ${question.user_telegram_id}`);
  return true;
}

// Get or create short ID for article
async function getOrCreateShortId(articleId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_short_id', { p_article_id: articleId });
  
  if (error) {
    console.error('Error getting short ID:', error);
    return articleId.substring(0, 8);
  }
  
  return data;
}

// Get article ID by short ID
async function getArticleIdByShortId(shortId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('moderation_short_ids')
    .select('article_id')
    .eq('short_id', shortId)
    .maybeSingle();

  if (error || !data) {
    console.error('Error finding article by short ID:', error);
    return null;
  }

  return data.article_id;
}

// Handle approve callback
async function handleApprove(callbackQuery: any, shortId: string) {
  const { id, message, from } = callbackQuery;

  const articleId = await getArticleIdByShortId(shortId);
  if (!articleId) {
    await answerCallbackQuery(id, '❌ Статья не найдена');
    return;
  }

  const { error } = await supabase
    .from('articles')
    .update({ status: 'approved' })
    .eq('id', articleId);

  if (error) {
    console.error('Error approving article:', error);
    await answerCallbackQuery(id, '❌ Ошибка при одобрении');
    return;
  }

  const { data: article } = await supabase
    .from('articles')
    .select('title, author:author_id(telegram_id, first_name, username)')
    .eq('id', articleId)
    .maybeSingle();

  const authorData = article?.author as any;

  await supabase.from('moderation_logs').insert({
    article_id: articleId,
    moderator_telegram_id: from.id,
    action: 'approved',
  });

  if (authorData?.telegram_id) {
    await sendUserMessage(
      authorData.telegram_id,
      `✅ <b>Ваша статья одобрена!</b>

📝 "${article?.title}"

Статья опубликована и доступна для всех пользователей в приложении BoysHub.`
    );
  }

  await answerCallbackQuery(id, '✅ Статья одобрена');
  await editMessageReplyMarkup(message.chat.id, message.message_id);
  await sendAdminMessage(message.chat.id, `✅ Статья "${article?.title}" одобрена и опубликована`);
}

// Handle reject callback
async function handleReject(callbackQuery: any, shortId: string) {
  const { id, message, from } = callbackQuery;

  const articleId = await getArticleIdByShortId(shortId);
  if (!articleId) {
    await answerCallbackQuery(id, '❌ Статья не найдена');
    return;
  }

  await supabase.from('pending_rejections').insert({
    short_id: shortId,
    article_id: articleId,
    admin_telegram_id: from.id,
  });

  await answerCallbackQuery(id, '📝 Напишите причину отклонения');
  await editMessageReplyMarkup(message.chat.id, message.message_id);
  await sendAdminMessage(message.chat.id, `📝 <b>Укажите причину отклонения:</b>\n\nОтправьте текст причины следующим сообщением.`);
}

// Handle rejection reason text
async function handleRejectionReason(chatId: number, userId: number, text: string): Promise<boolean> {
  const { data: pending, error } = await supabase
    .from('pending_rejections')
    .select('article_id, short_id')
    .eq('admin_telegram_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !pending) {
    return false;
  }

  const { error: updateError } = await supabase
    .from('articles')
    .update({
      status: 'rejected',
      rejection_reason: text,
    })
    .eq('id', pending.article_id);

  if (updateError) {
    console.error('Error rejecting article:', updateError);
    await sendAdminMessage(chatId, '❌ Ошибка при отклонении статьи');
    return true;
  }

  const { data: article } = await supabase
    .from('articles')
    .select('title, author:author_id(telegram_id, first_name, username)')
    .eq('id', pending.article_id)
    .maybeSingle();

  const authorData = article?.author as any;

  await supabase.from('moderation_logs').insert({
    article_id: pending.article_id,
    moderator_telegram_id: userId,
    action: 'rejected',
    reason: text,
  });

  if (authorData?.telegram_id) {
    await sendUserMessage(
      authorData.telegram_id,
      `❌ <b>Ваша статья отклонена</b>

📝 "${article?.title}"

<b>Причина:</b> ${text}

Вы можете исправить статью и отправить на модерацию повторно.`
    );
  }

  await supabase
    .from('pending_rejections')
    .delete()
    .eq('article_id', pending.article_id);

  await sendAdminMessage(chatId, `❌ Статья "${article?.title}" отклонена\n\n<b>Причина:</b> ${text}`);
  return true;
}

// Handle callback queries
async function handleCallbackQuery(callbackQuery: any) {
  const { data, from, message } = callbackQuery;
  
  if (!isAdmin(from.id)) {
    await answerCallbackQuery(callbackQuery.id, '⛔ Доступ запрещён');
    return;
  }

  console.log('Handling callback:', data);
  const parts = data.split(':');
  const action = parts[0];
  const param = parts[1];
  const param2 = parts[2];

  if (action === 'approve') {
    await handleApprove(callbackQuery, param);
  } else if (action === 'reject') {
    await handleReject(callbackQuery, param);
  } else if (action === 'users') {
    await answerCallbackQuery(callbackQuery.id);
    await handleUsers(message.chat.id, from.id, parseInt(param), message.message_id);
  } else if (action === 'user') {
    await handleUserProfile(callbackQuery, param);
  } else if (action === 'premium_grant') {
    await handlePremiumGrant(callbackQuery, param);
  } else if (action === 'premium_revoke') {
    await handlePremiumRevoke(callbackQuery, param);
  } else if (action === 'premium_extend') {
    const days = param2 ? parseInt(param2) : 30;
    await handlePremiumExtend(callbackQuery, param, days);
  } else if (action === 'block') {
    await handleBlockUser(callbackQuery, param);
  } else if (action === 'unblock') {
    await handleUnblockUser(callbackQuery, param);
  } else if (action === 'question') {
    await handleViewQuestion(callbackQuery, param);
  } else if (action === 'articles') {
    await answerCallbackQuery(callbackQuery.id);
    await handleArticles(message.chat.id, from.id, parseInt(param), message.message_id);
  } else if (action === 'article') {
    await handleViewArticle(callbackQuery, param);
  } else if (action === 'delete_article') {
    await handleDeleteArticle(callbackQuery, param);
  }
}

// Send new article notification to admin
export async function sendModerationNotification(article: any) {
  const shortId = await getOrCreateShortId(article.id);
  const authorDisplay = article.author?.username ? `@${article.author.username}` : `ID:${article.author?.telegram_id || 'N/A'}`;

  const message = `🆕 <b>Новая статья на модерации</b>

📝 <b>Заголовок:</b> ${article.title}

👤 <b>Автор:</b> ${article.is_anonymous ? 'Аноним' : authorDisplay}
🆔 <b>Telegram ID:</b> ${article.author?.telegram_id || 'N/A'}

📂 <b>Категория:</b> ${article.category_id || 'Без категории'}

📄 <b>Превью:</b>
${article.preview || article.body?.substring(0, 200) || 'Нет превью'}...

${article.media_url ? `🎬 <b>Медиа:</b> ${article.media_url}` : ''}

⏳ <b>Статус:</b> Ожидает модерации`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Принять', callback_data: `approve:${shortId}` },
        { text: '❌ Отклонить', callback_data: `reject:${shortId}` },
      ],
    ],
  };

  const result = await sendAdminMessage(TELEGRAM_ADMIN_CHAT_ID, message, {
    reply_markup: keyboard,
  });

  return result;
}

// Main handler
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const update = await req.json();
    console.log('Admin bot received update:', JSON.stringify(update));

    // Handle callback queries (button presses)
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
      return new Response('OK', { headers: corsHeaders });
    }

    // Handle messages
    if (update.message) {
      const { chat, text, from } = update.message;

      // Check admin access
      if (!isAdmin(from.id)) {
        await sendAdminMessage(chat.id, '⛔ Доступ запрещён. Этот бот только для администраторов.');
        return new Response('OK', { headers: corsHeaders });
      }

      // Commands
      if (text === '/start') {
        await handleStart(chat.id, from.id);
      } else if (text === '/stats') {
        await handleStats(chat.id, from.id);
      } else if (text === '/users') {
        await handleUsers(chat.id, from.id);
      } else if (text?.startsWith('/search ')) {
        const query = text.replace('/search ', '').trim();
        await handleSearch(chat.id, from.id, query);
      } else if (text === '/search') {
        await handleSearch(chat.id, from.id, '');
      } else if (text === '/premium') {
        await handlePremium(chat.id, from.id);
      } else if (text?.startsWith('/extend ')) {
        const args = text.replace('/extend ', '').trim();
        await handleExtendCommand(chat.id, from.id, args);
      } else if (text === '/extend') {
        await handleExtendCommand(chat.id, from.id, '');
      } else if (text === '/pending') {
        await handlePending(chat.id, from.id);
      } else if (text === '/st') {
        await handleArticles(chat.id, from.id);
      } else if (text?.startsWith('/search_st ')) {
        const query = text.replace('/search_st ', '').trim();
        await handleSearchArticles(chat.id, from.id, query);
      } else if (text === '/search_st') {
        await handleSearchArticles(chat.id, from.id, '');
      } else if (text === '/questions') {
        await handleQuestions(chat.id, from.id);
      } else if (text?.startsWith('/broadcast')) {
        await handleBroadcast(chat.id, from.id, text);
      } else if (text === '/help') {
        await handleStart(chat.id, from.id);
      } else {
        // Check if this is a reply to a support question
        const replyToMessageId = update.message.reply_to_message?.message_id;
        if (replyToMessageId) {
          const handled = await handleSupportReply(chat.id, from.id, text, replyToMessageId);
          if (handled) {
            return new Response('OK', { headers: corsHeaders });
          }
        }
        
        // Check if this is a rejection reason
        const handled = await handleRejectionReason(chat.id, from.id, text);
        if (!handled) {
          await sendAdminMessage(chat.id, 'Используйте /help для списка команд.');
        }
      }
    }

    return new Response('OK', { headers: corsHeaders });
  } catch (error) {
    console.error('Admin bot error:', error);
    return new Response('Error', { status: 500, headers: corsHeaders });
  }
});
