// @ts-ignore -- Las Edge Functions resuelven imports URL mediante Deno.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTransactionalEmail } from "../_shared/email.ts";

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const normalize = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const inappropriatePatterns = [
  /\b(?:pelotud|bolud|tarad|imbecil|forr|put[ao]|mierd|verga|conchud|mogolic|idiot)[a-z]*\b/,
  /\bhij[oa]s?\s+de\s+put[a-z]*\b/,
  /\bla\s+concha\s+de\b/,
];

const categoryLabels: Record<string, string> = {
  producto: "Producto",
  atencion: "Atención",
  entrega: "Entrega o retiro",
  sitio: "Página web",
  general: "Sugerencia general",
};

function corsHeaders(req: Request) {
  const configured = Deno.env.get("SITE_URL") || "https://acerosoeste.com";
  const allowed = new URL(configured).origin;
  const origin = req.headers.get("origin") || allowed;
  return {
    "Access-Control-Allow-Origin": origin === allowed ? origin : allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  };
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    if (String(body?.website || "").trim())
      return Response.json({ received: true }, { headers: cors });

    const name = String(body?.name || "").trim().slice(0, 100);
    const email = String(body?.email || "").trim().toLowerCase().slice(0, 180);
    const category = String(body?.category || "general");
    const orderReference = String(body?.orderCode || "").trim().slice(0, 60) || null;
    const message = String(body?.message || "").trim().slice(0, 1800);
    if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email))
      throw new Error("Ingresá tu nombre y un email válido");
    if (!categoryLabels[category]) throw new Error("Elegí un tema válido");
    if (message.length < 20)
      throw new Error("Contanos la sugerencia con un poco más de detalle");
    if (inappropriatePatterns.some((pattern) => pattern.test(normalize(message))))
      throw new Error("Revisá el lenguaje. Este espacio es para críticas constructivas");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("feedback_submissions")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", since);
    if (Number(count || 0) >= 5)
      throw new Error("Alcanzaste el límite diario de sugerencias. Probá mañana");

    let userId: string | null = null;
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (token) {
      const { data } = await supabase.auth.getUser(token);
      userId = data.user?.id || null;
    }

    const { data: feedback, error: insertError } = await supabase
      .from("feedback_submissions")
      .insert({
        user_id: userId,
        name,
        email,
        category,
        order_reference: orderReference,
        message,
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    const adminEmail =
      Deno.env.get("ADMIN_EMAIL") || "gestionacerosoestee@gmail.com";
    try {
      await sendTransactionalEmail({
        to: adminEmail,
        bccAdmin: false,
        replyTo: email,
        subject: `Sugerencia sobre ${categoryLabels[category]} — ${name}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;background:#07111c;color:#eef4fa;padding:32px;border-radius:12px"><p style="color:#f56b18;font-weight:700;letter-spacing:1px">ACEROS OESTE</p><h1>Nueva sugerencia</h1><div style="padding:18px;background:#101d2a;border-left:4px solid #f56b18;border-radius:8px"><p><b>De:</b> ${escapeHtml(name)}</p><p><b>Email:</b> ${escapeHtml(email)}</p><p><b>Tema:</b> ${escapeHtml(categoryLabels[category])}</p>${orderReference ? `<p><b>Pedido:</b> ${escapeHtml(orderReference)}</p>` : ""}<p style="white-space:pre-wrap;line-height:1.7">${escapeHtml(message)}</p></div><p style="color:#8fa1b1;font-size:12px">Podés responder este correo para contactar a la persona.</p></div>`,
      });
      await supabase
        .from("feedback_submissions")
        .update({
          email_sent_at: new Date().toISOString(),
          email_error: null,
        })
        .eq("id", feedback.id);
      return Response.json(
        { received: true, emailSent: true, feedbackId: feedback.id },
        { headers: cors },
      );
    } catch (emailError) {
      const emailMessage =
        emailError instanceof Error ? emailError.message : "Correo no enviado";
      console.error("Sugerencia guardada; correo pendiente", emailError);
      await supabase
        .from("feedback_submissions")
        .update({ email_error: emailMessage.slice(0, 500) })
        .eq("id", feedback.id);
      return Response.json(
        {
          received: true,
          emailSent: false,
          feedbackId: feedback.id,
          warning:
            "La sugerencia quedó guardada, pero el correo de gestión está pendiente",
        },
        { headers: cors },
      );
    }
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo enviar la sugerencia" },
      { status: 400, headers: cors },
    );
  }
});
