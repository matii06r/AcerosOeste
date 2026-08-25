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

    const body = await req.json();
    const requestId = String(body?.requestId || "");
    const status = String(body?.status || "");
    const allowed = [
      "under_review", "awaiting_return", "refund_pending", "refunded",
      "rejected", "closed",
    ];
    if (!requestId || !allowed.includes(status))
      throw new Error("Actualización inválida");
    const changes: Record<string, unknown> = {
      status,
      resolution_reason: String(body?.resolutionReason || "").trim().slice(0, 2000) || null,
      refund_amount:
        body?.refundAmount === "" || body?.refundAmount == null
          ? null
          : Number(body.refundAmount),
      mp_refund_id: String(body?.mpRefundId || "").trim().slice(0, 200) || null,
      reviewed_by: authData.user.id,
      reviewed_at: new Date().toISOString(),
    };
    const { data: requestRow, error } = await supabase
      .from("withdrawal_requests")
      .update(changes)
      .eq("id", requestId)
      .select("*")
      .single();
    if (error) throw error;

    const labels: Record<string, string> = {
      under_review: "Tu solicitud está en revisión",
      awaiting_return: "Coordinemos la devolución",
      refund_pending: "Tu reintegro está en proceso",
      refunded: "Reintegro confirmado",
      rejected: "Resolución de tu solicitud",
      closed: "Solicitud finalizada",
    };
    const explanation = requestRow.resolution_reason
      ? `<p style="color:#b7c5d1;line-height:1.7">${escapeHtml(requestRow.resolution_reason)}</p>`
      : '<p style="color:#b7c5d1;line-height:1.7">Ingresá a tu cuenta o respondé este correo si necesitás más información.</p>';
    await sendTransactionalEmail({
      to: requestRow.customer_email,
      subject: `${labels[status]} · ${requestRow.request_code}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;background:#07111c;color:#eef4fa;padding:32px;border-radius:12px"><p style="color:#f56b18;font-weight:700;letter-spacing:1px">ACEROS OESTE</p><h1>${escapeHtml(labels[status])}</h1>${explanation}<div style="margin:24px 0;padding:18px;background:#101d2a;border:1px solid #283d50;border-radius:10px"><b>${escapeHtml(requestRow.request_code)}</b>${requestRow.refund_amount ? `<p>Importe registrado: $${escapeHtml(Number(requestRow.refund_amount).toLocaleString("es-AR"))}</p>` : ""}</div><a href="https://acerosoeste.com/#cuenta" style="display:inline-block;padding:13px 17px;border-radius:6px;background:#f56b18;color:#fff;text-decoration:none;font-weight:700">Ir a Mi cuenta</a></div>`,
    });
    if (requestRow.user_id) {
      await supabase.from("user_notifications").insert({
        user_id: requestRow.user_id,
        type: "withdrawal",
        title: labels[status],
        body: requestRow.resolution_reason || requestRow.request_code,
        order_id: requestRow.order_id,
      });
    }
    return Response.json({ updated: true }, { headers: cors });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 400, headers: cors },
    );
  }
});
