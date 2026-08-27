// @ts-ignore -- Las Edge Functions resuelven imports URL mediante Deno.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const configuredSite = Deno.env.get("SITE_URL") || "https://acerosoeste.com";
  let allowedOrigin = "https://acerosoeste.com";
  try {
    allowedOrigin = new URL(configuredSite).origin;
  } catch {
    // Se conserva el dominio productivo si SITE_URL no es válido.
  }
  const origin = req.headers.get("origin") || allowedOrigin;
  const cors = {
    "Access-Control-Allow-Origin":
      origin === allowedOrigin ? origin : allowedOrigin,
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
    const { data: authData, error: authError } =
      await supabase.auth.getUser(token);
    if (authError || !authData.user) throw new Error("Sesión inválida");

    const { data: requester } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .single();
    if (requester?.role !== "admin") throw new Error("Acceso denegado");

    const { invoiceId } = await req.json();
    if (!invoiceId || typeof invoiceId !== "string")
      throw new Error("Comprobante inválido");

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id,order_id,user_id,pdf_path,invoice_type,invoice_number,orders(status,subtotal)")
      .eq("id", invoiceId)
      .single();
    if (invoiceError || !invoice) throw new Error("Comprobante no encontrado");

    const order = Array.isArray(invoice.orders)
      ? invoice.orders[0]
      : invoice.orders;
    if (!order || order.status !== "cancelled")
      throw new Error(
        "Sólo se puede eliminar el comprobante de una compra cancelada",
      );

    const { error: deleteError } = await supabase
      .from("invoices")
      .delete()
      .eq("id", invoice.id);
    if (deleteError) throw deleteError;

    let storageWarning: string | null = null;
    if (invoice.pdf_path) {
      const { error: storageError } = await supabase.storage
        .from("invoice-documents")
        .remove([invoice.pdf_path]);
      if (storageError) {
        storageWarning =
          "El registro se eliminó, pero el PDF no pudo limpiarse del almacenamiento.";
        console.error("PDF huérfano de comprobante", storageError);
      }
    }

    const { data: remaining, error: remainingError } = await supabase
      .from("invoices")
      .select("gross_amount,status")
      .eq("order_id", invoice.order_id);
    const activeInvoices = (remaining || []).filter(
      (item) => item.status !== "cancelled",
    );
    const registeredTotal = activeInvoices.reduce(
      (sum, item) => sum + Number(item.gross_amount || 0),
      0,
    );
    const billingStatus = activeInvoices.length
      ? registeredTotal >= Number(order.subtotal || 0)
        ? "invoiced"
        : "partial"
      : "not_applicable";

    let updateWarning: string | null = null;
    if (remainingError) {
      updateWarning =
        "El comprobante se eliminó, pero no se pudo recalcular el estado de facturación.";
      console.error("No se pudieron consultar comprobantes restantes", remainingError);
    } else {
      const { error: updateError } = await supabase
        .from("orders")
        .update({ billing_status: billingStatus, billing_archived_at: null })
        .eq("id", invoice.order_id);
      if (updateError) {
        updateWarning =
          "El comprobante se eliminó, pero no se pudo actualizar el estado de facturación.";
        console.error("No se pudo actualizar la facturación", updateError);
      }
    }

    if (!activeInvoices.length) {
      await supabase
        .from("user_notifications")
        .delete()
        .eq("order_id", invoice.order_id)
        .eq("type", "invoice");
    }

    return Response.json(
      {
        deleted: true,
        invoiceId: invoice.id,
        billingStatus,
        warning: updateWarning || storageWarning,
      },
      { headers: cors },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 400, headers: cors },
    );
  }
});
