// @ts-ignore -- Las Edge Functions resuelven imports URL mediante Deno.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { orderEmailHtml, sendTransactionalEmail } from "../_shared/email.ts";

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  let siteOrigin = origin;
  try {
    siteOrigin = new URL(Deno.env.get("SITE_URL") || origin).origin;
  } catch {
    // La validación del request devolverá el error correspondiente.
  }
  const cors = {
    "Access-Control-Allow-Origin": origin === siteOrigin ? origin : siteOrigin,
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
    const { data: authData } = await supabase.auth.getUser(token);
    if (!authData.user) throw new Error("Sesión inválida");
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .single();
    if (profile?.role !== "admin") throw new Error("Acceso denegado");
    const { orderId, type } = await req.json();
    if (type !== "in_transit") throw new Error("Notificación inválida");
    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();
    if (error || !order?.customer_email) throw new Error("Pedido sin email");
    if (order.shipment_email_sent_at) {
      return Response.json(
        { sent: true, alreadySent: true },
        { headers: cors },
      );
    }
    await sendTransactionalEmail({
      to: order.customer_email,
      subject: `Tu pedido ${String(order.id).slice(0, 8).toUpperCase()} está en camino`,
      html: orderEmailHtml(
        "Tu pedido está en camino",
        "Aceros Oeste ya despachó tu pedido. Nos comunicaremos con vos para coordinar la entrega.",
        order,
      ),
    });
    await supabase
      .from("orders")
      .update({ shipment_email_sent_at: new Date().toISOString() })
      .eq("id", order.id);
    return Response.json({ sent: true }, { headers: cors });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 400, headers: cors },
    );
  }
});
