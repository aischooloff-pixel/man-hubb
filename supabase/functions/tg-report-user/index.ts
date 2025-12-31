import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_BOT_TOKEN = Deno.env.get("ADMIN_BOT_TOKEN")!;
const TELEGRAM_ADMIN_CHAT_ID = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function sendAdminMessage(text: string, options: any = {}) {
  const response = await fetch(
    `https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_ADMIN_CHAT_ID,
        text,
        parse_mode: "HTML",
        ...options,
      }),
    }
  );
  return response.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { initData, reportedUserId, reason } = await req.json();

    if (!initData || !reportedUserId || !reason) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse initData to get user info
    const params = new URLSearchParams(initData);
    const userStr = params.get("user");
    if (!userStr) {
      return new Response(
        JSON.stringify({ error: "Invalid initData" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const telegramUser = JSON.parse(userStr);
    const telegramId = telegramUser.id;

    // Get reporter profile
    const { data: reporter, error: reporterError } = await supabase
      .from("profiles")
      .select("id, username, first_name")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (reporterError || !reporter) {
      return new Response(
        JSON.stringify({ error: "Reporter not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get reported user profile
    const { data: reportedUser, error: reportedError } = await supabase
      .from("profiles")
      .select("id, username, first_name, telegram_id")
      .eq("id", reportedUserId)
      .maybeSingle();

    if (reportedError || !reportedUser) {
      return new Response(
        JSON.stringify({ error: "Reported user not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cannot report yourself
    if (reporter.id === reportedUserId) {
      return new Response(
        JSON.stringify({ error: "Cannot report yourself" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create report
    const { data: report, error: insertError } = await supabase
      .from("user_reports")
      .insert({
        reported_user_id: reportedUserId,
        reporter_profile_id: reporter.id,
        reason: reason.trim(),
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create report" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send notification to admin
    const reporterDisplay = reporter.username ? `@${reporter.username}` : reporter.first_name || `ID:${telegramId}`;
    const reportedDisplay = reportedUser.username ? `@${reportedUser.username}` : reportedUser.first_name || `ID:${reportedUser.telegram_id}`;

    const message = `🚨 <b>Жалоба на пользователя</b>

👤 <b>Нарушитель:</b> ${reportedDisplay}
🆔 <b>Telegram ID:</b> ${reportedUser.telegram_id || 'N/A'}

📋 <b>Причина:</b>
${reason.trim()}

👮 <b>Отправил:</b> ${reporterDisplay}
📅 <b>Дата:</b> ${new Date().toLocaleString('ru-RU')}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Рассмотрено', callback_data: `user_report_done:${report.id}` },
          { text: '🚫 Заблокировать', callback_data: `block:${reportedUser.telegram_id}` },
        ],
        [
          { text: '👤 Профиль', callback_data: `user:${reportedUser.telegram_id}` },
        ],
      ],
    };

    const result = await sendAdminMessage(message, { reply_markup: keyboard });

    // Save admin message id
    if (result.ok && result.result?.message_id) {
      await supabase
        .from("user_reports")
        .update({ admin_message_id: result.result.message_id })
        .eq("id", report.id);
    }

    console.log("User report created:", report.id);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
