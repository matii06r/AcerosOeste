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

function notificationEmailHtml(
  heading: string,
  actor: string,
  content: string,
  actionUrl: string,
) {
  return `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;background:#07111c;color:#eef4fa;padding:32px;border-radius:12px"><p style="margin:0 0 10px;color:#f56b18;font-size:12px;font-weight:700;letter-spacing:1px">ACEROS OESTE</p><h1 style="margin:0 0 18px;font-size:25px">${escapeHtml(heading)}</h1><p style="color:#aebdca">Enviado por <b style="color:#fff">${escapeHtml(actor)}</b></p><div style="margin:20px 0;padding:18px;background:#101d2a;border-left:4px solid #f56b18;border-radius:8px;line-height:1.6">${escapeHtml(content)}</div><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:13px 18px;background:#f56b18;color:#fff;text-decoration:none;border-radius:6px;font-weight:700">Abrir en el panel</a><p style="margin-top:24px;color:#8192a2;font-size:12px">También vas a encontrar este aviso en la campana de notificaciones de la tienda.</p></div>`;
}

Deno.serve(async (req: Request) => {
  const configuredSite = Deno.env.get("SITE_URL") || "https://acerosoeste.com";
  let siteOrigin = "https://acerosoeste.com";
  try {
    siteOrigin = new URL(configuredSite).origin;
  } catch {
    // El valor seguro predeterminado se conserva.
  }
  const requestOrigin = req.headers.get("origin") || siteOrigin;
  const cors = {
    "Access-Control-Allow-Origin":
      requestOrigin === siteOrigin ? requestOrigin : siteOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = (req.headers.get("Authorization") || "").replace(
      "Bearer ",
      "",
    );
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) throw new Error("Sesión inválida");

    const { eventType, recordId } = await req.json();
    if (!recordId || !["question", "message"].includes(eventType))
      throw new Error("Notificación inválida");

    const { data: actorProfile } = await supabase
      .from("profiles")
      .select("full_name,role")
      .eq("id", authData.user.id)
      .single();
    if (actorProfile?.role === "admin")
      return Response.json({ sent: false, skipped: "admin" }, { headers: cors });

    const actor =
      actorProfile?.full_name?.trim() || authData.user.email || "Un cliente";
    const adminEmail =
      Deno.env.get("ADMIN_EMAIL") || "gestionacerosoeste@gmail.com";
    let subject = "Nueva consulta en Aceros Oeste";
    let heading = "Nueva consulta";
    let content = "";
    let actionUrl = `${siteOrigin}/#panel-general`;

    if (eventType === "question") {
      const { data: question, error } = await supabase
        .from("questions")
        .select("id,user_id,product_id,question,admin_email_sent_at")
        .eq("id", recordId)
        .single();
      if (error || question?.user_id !== authData.user.id)
        throw new Error("Pregunta no autorizada");
      if (question.admin_email_sent_at)
        return Response.json({ sent: true, alreadySent: true }, { headers: cors });

      const { data: product } = await supabase
        .from("products")
        .select("name,slug")
        .eq("id", question.product_id)
        .single();
      const productName = product?.name || "un producto";
      subject = `Nueva pregunta en ${productName}`;
      heading = subject;
      content = question.question;
      if (product?.slug)
        actionUrl = `${siteOrigin}/#producto/${encodeURIComponent(product.slug)}`;

      await sendTransactionalEmail({
        to: adminEmail,
        subject,
        html: notificationEmailHtml(heading, actor, content, actionUrl),
        bccAdmin: false,
      });
      await supabase
        .from("questions")
        .update({ admin_email_sent_at: new Date().toISOString() })
        .eq("id", question.id);
    } else {
      const { data: message, error } = await supabase
        .from("support_messages")
        .select("id,sender_id,conversation_id,body,admin_email_sent_at")
        .eq("id", recordId)
        .single();
      if (error || message?.sender_id !== authData.user.id)
        throw new Error("Mensaje no autorizado");
      if (message.admin_email_sent_at)
        return Response.json({ sent: true, alreadySent: true }, { headers: cors });

      subject = `Nuevo mensaje privado de ${actor}`;
      heading = "Nuevo mensaje privado";
      content = message.body;
      await sendTransactionalEmail({
        to: adminEmail,
        subject,
        html: notificationEmailHtml(heading, actor, content, actionUrl),
        bccAdmin: false,
      });
      await supabase
        .from("support_messages")
        .update({ admin_email_sent_at: new Date().toISOString() })
        .eq("id", message.id);
    }

    return Response.json({ sent: true }, { headers: cors });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 400, headers: cors },
    );
  }
});

