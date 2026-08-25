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

const normalizeEmail = (value: unknown) =>
  String(value || "").trim().toLowerCase();

const corsHeaders = (req: Request) => {
  const configured = Deno.env.get("SITE_URL") || "https://acerosoeste.com";
  const allowedOrigin = new URL(configured).origin;
  const origin = req.headers.get("origin") || allowedOrigin;
  return {
    "Access-Control-Allow-Origin": origin === allowedOrigin ? origin : allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  };
};

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const orderCode = String(body?.orderCode || "")
      .trim()
      .replace(/[^a-fA-F0-9-]/g, "")
      .toLowerCase();
    const email = normalizeEmail(body?.email);
    const reason = String(body?.reason || "").trim().slice(0, 2000) || null;
    const phone = String(body?.phone || "").trim().slice(0, 60) || null;
    if (orderCode.length < 8 || !email || !email.includes("@"))
      throw new Error("Ingresá el código del pedido y el email de la compra");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: candidates, error: orderError } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .ilike("customer_email", email)
      .in("status", ["deposit_paid", "paid", "in_transit", "fulfilled", "cancelled"])
      .order("created_at", { ascending: false })
      .limit(100);
    if (orderError) throw orderError;
    const order = (candidates || []).find((candidate) =>
      String(candidate.id).toLowerCase().startsWith(orderCode),
    );
    if (!order)
      throw new Error("No encontramos una compra que coincida con esos datos");

    const requestCode = `ARR-${new Date().getUTCFullYear()}-${crypto
      .randomUUID()
      .slice(0, 8)
      .toUpperCase()}`;
    const items = (order.order_items || []).map(
      (item: Record<string, unknown>) => ({
        order_item_id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        sale_type: item.sale_type || "standard",
      }),
    );
    const { data: requestRow, error: insertError } = await supabase
      .from("withdrawal_requests")
      .insert({
        request_code: requestCode,
        order_id: order.id,
        user_id: order.user_id,
        customer_name: order.customer_name || "Cliente",
        customer_email: email,
        customer_phone: phone || order.customer_phone,
        items,
        reason,
        status: "submitted",
      })
      .select("id,request_code,created_at")
      .single();
    if (insertError) {
      if (insertError.code === "23505")
        throw new Error("Ya existe una solicitud abierta para esta compra");
      throw insertError;
    }

    const products = items
      .map((item: Record<string, unknown>) =>
        `${Math.max(1, Number(item.quantity) || 1)}× ${String(item.product_name || "Producto")}`,
      )
      .join(" · ");
    try {
      await sendTransactionalEmail({
        to: email,
        subject: `Recibimos tu solicitud ${requestCode}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;background:#07111c;color:#eef4fa;padding:32px;border-radius:12px"><p style="color:#f56b18;font-weight:700;letter-spacing:1px">ACEROS OESTE</p><h1>Solicitud recibida</h1><p style="color:#b7c5d1;line-height:1.7">Registramos tu solicitud de arrepentimiento. Nuestro equipo revisará los datos de la operación y te informará los próximos pasos por este correo.</p><div style="margin:24px 0;padding:20px;background:#101d2a;border:1px solid #283d50;border-radius:10px"><p><b>Código:</b> ${escapeHtml(requestCode)}</p><p><b>Compra:</b> ${escapeHtml(products)}</p><p><b>Fecha:</b> ${escapeHtml(new Date(requestRow.created_at).toLocaleString("es-AR"))}</p></div><p style="color:#8fa1b1;font-size:12px;line-height:1.6">Conservá este código. También podés responder el correo o escribir a gestionacerosoestee@gmail.com.</p></div>`,
      });
    } catch (emailError) {
      console.error("La solicitud se creó, pero falló el email", emailError);
    }
    return Response.json(
      { created: true, requestCode: requestRow.request_code },
      { headers: cors },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo registrar la solicitud" },
      { status: 400, headers: cors },
    );
  }
});
