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

const categoryLabels: Record<string, string> = {
  producto: "Producto",
  atencion: "Atención",
  entrega: "Entrega o retiro",
  sitio: "Página web",
  general: "Sugerencia general",
};

Deno.serve(async (req: Request) => {
  const configured = Deno.env.get("SITE_URL") || "https://acerosoeste.com";
  const allowedOrigin = new URL(configured).origin;
  const origin = req.headers.get("origin") || allowedOrigin;
  const cors = {
    "Access-Control-Allow-Origin": origin === allowedOrigin ? origin : allowedOrigin,
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
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: authData } = await supabase.auth.getUser(token);
    if (!authData.user) throw new Error("Sesión inválida");
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .single();
    if (profile?.role !== "admin") throw new Error("Acceso denegado");

    const { feedbackId } = await req.json();
    const { data: feedback, error } = await supabase
      .from("feedback_submissions")
      .select("*")
      .eq("id", String(feedbackId || ""))
      .single();
    if (error || !feedback) throw new Error("Sugerencia no encontrada");

    const adminEmail =
      Deno.env.get("ADMIN_EMAIL") || "gestionacerosoestee@gmail.com";
    const category = categoryLabels[feedback.category] || "Sugerencia general";
    try {
      await sendTransactionalEmail({
        to: adminEmail,
        replyTo: feedback.email,
        subject: `Sugerencia sobre ${category} — ${feedback.name}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;background:#07111c;color:#eef4fa;padding:32px;border-radius:12px"><p style="color:#f56b18;font-weight:700;letter-spacing:1px">ACEROS OESTE</p><h1>Nueva sugerencia</h1><div style="padding:18px;background:#101d2a;border-left:4px solid #f56b18;border-radius:8px"><p><b>De:</b> ${escapeHtml(feedback.name)}</p><p><b>Email:</b> ${escapeHtml(feedback.email)}</p><p><b>Tema:</b> ${escapeHtml(category)}</p>${feedback.order_reference ? `<p><b>Pedido:</b> ${escapeHtml(feedback.order_reference)}</p>` : ""}<p style="white-space:pre-wrap;line-height:1.7">${escapeHtml(feedback.message)}</p></div><p style="color:#8fa1b1;font-size:12px">Podés responder este correo para contactar a la persona.</p></div>`,
      });
    } catch (sendError) {
      const message =
        sendError instanceof Error ? sendError.message : "Correo no enviado";
      await supabase
        .from("feedback_submissions")
        .update({ email_error: message.slice(0, 500) })
        .eq("id", feedback.id);
      throw sendError;
    }
    await supabase
      .from("feedback_submissions")
      .update({
        email_sent_at: new Date().toISOString(),
        email_error: null,
      })
      .eq("id", feedback.id);
    return Response.json({ sent: true }, { headers: cors });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo reenviar" },
      { status: 400, headers: cors },
    );
  }
});
