// Edge Function skeleton for syncing YCLIENTS visit status with the loyalty program.
// Adapt the request body to the exact webhook payload from your YCLIENTS application.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await request.json();

    // TODO:
    // 1. Validate the webhook signature if your YCLIENTS app provides one.
    // 2. Map these fields to the real payload schema.
    const visitStatus = payload?.visit_status ?? payload?.status;
    const clientPhone = payload?.client?.phone ?? payload?.phone;
    const visitId = String(payload?.visit_id ?? payload?.record_id ?? "");

    if (!visitStatus || !clientPhone) {
      return json({ ok: false, message: "Missing visit status or client phone." }, 400);
    }

    if (visitStatus !== "client_visited" && visitStatus !== "Клиент пришел") {
      return json({ ok: true, message: "Status does not начисляет бонусы." });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, message: "Supabase secrets are not configured." }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const normalizedPhone = String(clientPhone).replace(/[^\d+]/g, "");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, bonus_balance, visit_count")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (!profile) {
      return json({ ok: false, message: "Profile not found for phone.", phone: normalizedPhone }, 404);
    }

    const { data: existingEvent } = await supabase
      .from("loyalty_events")
      .select("id")
      .eq("visit_reference", visitId)
      .eq("source", "yclients")
      .maybeSingle();

    if (existingEvent) {
      return json({ ok: true, message: "Visit already credited." });
    }

    const points = 500;

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        bonus_balance: profile.bonus_balance + points,
        visit_count: profile.visit_count + 1,
      })
      .eq("id", profile.id);

    if (profileError) {
      throw profileError;
    }

    const { error: eventError } = await supabase.from("loyalty_events").insert({
      profile_id: profile.id,
      source: "yclients",
      title: "Начисление после визита",
      description: "Автоматическое начисление после статуса «Клиент пришел».",
      points_delta: points,
      visit_reference: visitId,
    });

    if (eventError) {
      throw eventError;
    }

    return json({ ok: true, message: "Bonuses credited.", points });
  } catch (error) {
    return json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
