import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function enc(text: string) {
  return new TextEncoder().encode(text);
}

async function hmacSha256Raw(key: string, data: string) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, enc(data));
}

async function hmacSha256Hex(key: ArrayBuffer, data: string) {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verifyTelegramInitData(initData: string): Promise<{ user: any | null }> {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { user: null };

  const pairs: string[] = [];
  params.forEach((value, key) => {
    if (key === 'hash') return;
    pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = await hmacSha256Raw('WebAppData', TELEGRAM_BOT_TOKEN);
  const checkHash = await hmacSha256Hex(secretKey, dataCheckString);

  if (checkHash !== hash) return { user: null };

  const userJson = params.get('user');
  if (!userJson) return { user: null };

  try {
    return { user: JSON.parse(userJson) };
  } catch {
    return { user: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { initData, targetUserId, value } = await req.json();
    
    if (!initData) {
      return new Response(JSON.stringify({ error: 'initData is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { user: tgUser } = await verifyTelegramInitData(initData);
    if (!tgUser?.id) {
      return new Response(JSON.stringify({ error: 'Invalid Telegram initData' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get sender profile
    const { data: senderProfile, error: senderErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('telegram_id', tgUser.id)
      .maybeSingle();

    if (senderErr || !senderProfile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate value is 1 or -1
    const repValue = value === 1 ? 1 : value === -1 ? -1 : null;
    if (!targetUserId || repValue === null) {
      return new Response(JSON.stringify({ error: 'targetUserId and value (1 or -1) are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if target user exists
    const { data: targetProfile, error: targetErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .maybeSingle();

    if (targetErr || !targetProfile) {
      return new Response(JSON.stringify({ error: 'Target user not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Can't give rep to yourself
    if (senderProfile.id === targetUserId) {
      return new Response(JSON.stringify({ error: 'Нельзя дать репутацию самому себе' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user already gave reputation to this user recently (within 24 hours)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { data: recentRep } = await supabase
      .from('reputation_history')
      .select('id')
      .eq('from_user_id', senderProfile.id)
      .eq('user_id', targetUserId)
      .gte('created_at', oneDayAgo.toISOString())
      .limit(1);

    if (recentRep && recentRep.length > 0) {
      return new Response(JSON.stringify({ error: 'Вы уже давали репутацию этому пользователю за последние 24 часа' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert reputation history entry
    const { error: insertErr } = await supabase
      .from('reputation_history')
      .insert({
        user_id: targetUserId,
        from_user_id: senderProfile.id,
        value: repValue,
      });

    if (insertErr) {
      console.error('Error inserting reputation:', insertErr);
      throw insertErr;
    }

    // Update profile reputation
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ reputation: (targetProfile.reputation || 0) + repValue })
      .eq('id', targetUserId);

    if (updateErr) {
      console.error('Error updating reputation:', updateErr);
    }

    // Create notification
    const senderName = senderProfile.username 
      ? `@${senderProfile.username}` 
      : senderProfile.first_name || 'Пользователь';

    const repText = repValue > 0 ? '+1 rep' : '-1 rep';
    
    await supabase
      .from('notifications')
      .insert({
        user_profile_id: targetUserId,
        from_user_id: senderProfile.id,
        type: 'reputation',
        message: `${senderName} дал вам ${repText}`,
        is_read: false,
      });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('tg-give-reputation error:', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
