import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function parseInitData(initData: string) {
  return new URLSearchParams(initData);
}

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
  const params = parseInitData(initData);

  const hash = params.get('hash');
  if (!hash) {
    return { user: null };
  }

  const pairs: string[] = [];
  params.forEach((value, key) => {
    if (key === 'hash') return;
    pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = await hmacSha256Raw('WebAppData', TELEGRAM_BOT_TOKEN);
  const checkHash = await hmacSha256Hex(secretKey, dataCheckString);

  if (checkHash !== hash) {
    return { user: null };
  }

  const userJson = params.get('user');
  if (!userJson) {
    return { user: null };
  }

  try {
    const user = JSON.parse(userJson);
    return { user };
  } catch {
    return { user: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { initData, articleId, updates } = await req.json();
    
    if (!initData) {
      return new Response(JSON.stringify({ error: 'initData is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!articleId || !updates) {
      return new Response(JSON.stringify({ error: 'articleId and updates are required' }), {
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

    // Get user's profile
    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('telegram_id', tgUser.id)
      .maybeSingle();

    if (pErr || !profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the article to verify ownership
    const { data: article, error: aErr } = await supabase
      .from('articles')
      .select('*')
      .eq('id', articleId)
      .maybeSingle();

    if (aErr || !article) {
      return new Response(JSON.stringify({ error: 'Article not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user owns the article
    if (article.author_id !== profile.id) {
      return new Response(JSON.stringify({ error: 'You can only edit your own articles' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Store the pending edit data
    const pendingEdit = {
      title: updates.title,
      topic: updates.topic,
      body: updates.body,
      media_url: updates.media_url,
      is_anonymous: updates.is_anonymous,
      sources: updates.sources,
      submitted_at: new Date().toISOString(),
    };

    // Update article with pending edit
    const { error: updateErr } = await supabase
      .from('articles')
      .update({
        pending_edit: pendingEdit,
        updated_at: new Date().toISOString(),
      })
      .eq('id', articleId);

    if (updateErr) {
      console.error('Error updating article:', updateErr);
      return new Response(JSON.stringify({ error: 'Failed to submit edit' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send moderation request for the edit via direct HTTP call
    try {
      const sendEditModerationUrl = `${SUPABASE_URL}/functions/v1/send-edit-moderation`;
      const modResponse = await fetch(sendEditModerationUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ articleId }),
      });
      const modResult = await modResponse.json();
      console.log('[tg-update-article] send-edit-moderation response:', modResult);
    } catch (modError) {
      console.error('Error sending edit moderation request:', modError);
    }

    console.log(`[tg-update-article] Article ${articleId} edit submitted for moderation`);

    return new Response(JSON.stringify({ success: true, message: 'Edit submitted for moderation' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('tg-update-article error:', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
