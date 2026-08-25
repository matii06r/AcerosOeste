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

    const { invoiceId } = await req.json();
    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("*, orders(customer_name,customer_email)")
      .eq("id", invoiceId)
      .single();
    if (error || !invoice?.orders?.customer_email)
      throw new Error("Factura o email no disponible");
    if (!invoice.pdf_path) throw new Error("La factura no tiene un PDF cargado");
    const { data: signed, error: signedError } = await supabase.storage
      .from("invoice-documents")
      .createSignedUrl(invoice.pdf_path, 60 * 60 * 24 * 7);
    if (signedError || !signed?.signedUrl) throw new Error("No se pudo preparar el PDF");
    const number = invoice.invoice_number
      ? `${String(invoice.point_of_sale || 0).padStart(5, "0")}-${String(invoice.invoice_number).padStart(8, "0")}`
      : "comprobante";
    await sendTransactionalEmail({
      to: invoice.orders.customer_email,
      subject: `Factura ${invoice.invoice_type} ${number} · Aceros Oeste`,
      html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;background:#07111c;color:#eef4fa;padding:32px;border-radius:12px"><p style="color:#f56b18;font-weight:700;letter-spacing:1px">ACEROS OESTE</p><h1>Tu factura está disponible</h1><p style="color:#b7c5d1;line-height:1.7">Hola ${escapeHtml(invoice.orders.customer_name || "")}. Registramos la factura ${escapeHtml(invoice.invoice_type)} ${escapeHtml(number)} por $${escapeHtml(Number(invoice.gross_amount).toLocaleString("es-AR"))}.</p><p><a href="${escapeHtml(signed.signedUrl)}" style="display:inline-block;padding:13px 17px;border-radius:6px;background:#f56b18;color:#fff;text-decoration:none;font-weight:700">Descargar factura PDF</a></p><p style="color:#8fa1b1;font-size:12px;line-height:1.6">El enlace estará disponible durante 7 días. La factura también permanecerá en la sección Mis compras de tu cuenta.</p></div>`,
    });
    await supabase
      .from("invoices")
      .update({ status: "sent", emailed_at: new Date().toISOString() })
      .eq("id", invoice.id);
    return Response.json({ sent: true }, { headers: cors });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 400, headers: cors },
    );
  }
});
