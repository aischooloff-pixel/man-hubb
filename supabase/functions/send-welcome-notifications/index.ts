import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Send message via User Bot
async function sendUserMessage(chatId: string | number, text: string, options: any = {}) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
      ...options,
    }),
  });
  
  return response.json();
}

// Send photo via User Bot
async function sendUserPhoto(chatId: string | number, photoUrl: string, caption?: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: 'HTML',
    }),
  });
  
  return response.json();
}

// Send video via User Bot
async function sendUserVideo(chatId: string | number, videoUrl: string, caption?: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      video: videoUrl,
      caption,
      parse_mode: 'HTML',
    }),
  });
  
  return response.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Checking for pending welcome notifications...');

    // Get welcome message settings
    const { data: settings } = await supabase
      .from('admin_settings')
      .select('key, value')
      .in('key', ['welcome_message_text', 'welcome_message_media_url', 'welcome_message_media_type', 'welcome_message_delay_minutes', 'welcome_message_enabled']);

    const settingsMap: Record<string, string> = {};
    settings?.forEach(s => {
      if (s.value) settingsMap[s.key] = s.value;
    });

    const isEnabled = settingsMap['welcome_message_enabled'] !== 'false';
    const messageText = settingsMap['welcome_message_text'];
    const mediaUrl = settingsMap['welcome_message_media_url'];
    const mediaType = settingsMap['welcome_message_media_type'];

    if (!isEnabled) {
      console.log('Welcome message is disabled');
      return new Response(JSON.stringify({ sent: 0, message: 'Welcome message disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!messageText) {
      console.log('No welcome message configured');
      return new Response(JSON.stringify({ sent: 0, message: 'No welcome message configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get pending notifications that are due
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from('scheduled_notifications')
      .select(`
        id,
        user_profile_id,
        profiles!inner(telegram_id)
      `)
      .eq('notification_type', 'welcome')
      .is('sent_at', null)
      .lte('scheduled_at', new Date().toISOString())
      .limit(50);

    if (fetchError) {
      console.error('Error fetching notifications:', fetchError);
      throw fetchError;
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      console.log('No pending notifications');
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${pendingNotifications.length} pending notifications`);

    let sentCount = 0;
    const sentIds: string[] = [];

    for (const notification of pendingNotifications) {
      const profile = notification.profiles as any;
      const telegramId = profile?.telegram_id;

      if (!telegramId) {
        console.log(`No telegram_id for notification ${notification.id}`);
        sentIds.push(notification.id);
        continue;
      }

      try {
        // Send message with or without media
        if (mediaUrl && mediaType) {
          if (mediaType === 'photo') {
            await sendUserPhoto(telegramId, mediaUrl, messageText);
          } else if (mediaType === 'video') {
            await sendUserVideo(telegramId, mediaUrl, messageText);
          } else {
            await sendUserMessage(telegramId, messageText);
          }
        } else {
          await sendUserMessage(telegramId, messageText);
        }
        
        sentCount++;
        sentIds.push(notification.id);
        console.log(`Sent welcome message to ${telegramId}`);
      } catch (sendError) {
        console.error(`Failed to send to ${telegramId}:`, sendError);
        sentIds.push(notification.id); // Mark as sent anyway to avoid retrying
      }
    }

    // Mark notifications as sent
    if (sentIds.length > 0) {
      await supabase
        .from('scheduled_notifications')
        .update({ sent_at: new Date().toISOString() })
        .in('id', sentIds);
    }

    console.log(`Sent ${sentCount} welcome notifications`);

    return new Response(JSON.stringify({ sent: sentCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
