// @ts-ignore -- Las Edge Functions resuelven imports URL mediante Deno.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  orderEmailHtml,
  orderSummaryText,
  sendTransactionalEmail,
} from "../_shared/email.ts";

async function validSignature(req: Request, dataId: string) {
  const signature = req.headers.get("x-signature") || "";
  const requestId = req.headers.get("x-request-id") || "";
  const secret = Deno.env.get("MP_WEBHOOK_SECRET");

  // Si no hay secreto configurado, no podemos validar la firma.
  if (!secret || !signature || !requestId || !dataId) {
    return false;
  }

  const parts = Object.fromEntries(
    signature.split(",").map((x) => x.split("=").map((v) => v.trim())),
  );

  if (!parts.ts || !parts.v1) {
    return false;
  }

  const manifest =
    `id:${dataId.toLowerCase()};` +
    `request-id:${requestId};` +
    `ts:${parts.ts};`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(manifest),
  );

  const hex = [...new Uint8Array(signed)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hex === parts.v1;
}

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);

    const body = await req.json().catch(() => ({}));

    const dataId = String(
      body?.data?.id || url.searchParams.get("data.id") || "",
    );

    const eventType =
      body?.type || body?.action || url.searchParams.get("type") || "";

    console.log("Mercado Pago webhook:", {
      eventType,
      dataId,
    });

    // --------------------------------------------------
    // 1. Si no tenemos ID, respondemos OK.
    // --------------------------------------------------

    if (!dataId) {
      return new Response(
        JSON.stringify({
          received: true,
          message: "Sin payment ID",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // --------------------------------------------------
    // 2. Validar firma
    // --------------------------------------------------

    const signatureIsValid = await validSignature(req, dataId);

    if (!signatureIsValid) {
      console.error("Firma inválida");

      return new Response(
        JSON.stringify({
          error: "Firma inválida",
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // --------------------------------------------------
    // 3. Consultar el pago real en Mercado Pago
    // --------------------------------------------------

    const accessToken = Deno.env.get("MP_ACCESS_TOKEN");

    if (!accessToken) {
      throw new Error("MP_ACCESS_TOKEN no está configurado");
    }

    const paymentResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${dataId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    // --------------------------------------------------
    // 4. Si el pago de prueba no existe,
    //    no rompemos el webhook.
    // --------------------------------------------------

    if (!paymentResponse.ok) {
      const errorText = await paymentResponse.text();

      console.error(
        "Mercado Pago no pudo encontrar/validar el pago:",
        dataId,
        errorText,
      );

      // Mercado Pago puede probar el webhook con IDs ficticios.
      // Respondemos 200 para indicar que el endpoint funciona.
      return new Response(
        JSON.stringify({
          received: true,
          message: "Webhook recibido, pago no encontrado",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const payment = await paymentResponse.json();

    console.log("Pago recibido:", {
      id: payment.id,
      status: payment.status,
      external_reference: payment.external_reference,
    });

    // --------------------------------------------------
    // 5. Conectar con Supabase
    // --------------------------------------------------

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const orderId = payment.external_reference;

    if (!orderId) {
      console.error("El pago no tiene external_reference");

      return new Response(
        JSON.stringify({
          received: true,
          message: "Pago sin order ID",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // --------------------------------------------------
    // 6. Marcar como pagado y descontar stock una sola vez
    // --------------------------------------------------

    if (payment.status === "approved") {
      const { error: finalizeError } = await supabase.rpc(
        "finalize_paid_order",
        { p_order_id: orderId, p_payment_id: String(payment.id) },
      );
      if (finalizeError) throw finalizeError;
      console.log(`Orden ${orderId} confirmada y stock actualizado`);
      const { data: order } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", orderId)
        .single();
      if (order && !order.payment_email_sent_at) {
        let recipientEmail = String(order.customer_email || "")
          .trim()
          .toLowerCase();
        if (order.user_id) {
          const { data: accountData } = await supabase.auth.admin.getUserById(
            order.user_id,
          );
          const accountEmail = String(accountData?.user?.email || "")
            .trim()
            .toLowerCase();
          if (accountEmail) recipientEmail = accountEmail;
        }
        if (!/^\S+@\S+\.\S+$/.test(recipientEmail))
          throw new Error("Pedido sin email válido del comprador");
        const delivery = await sendTransactionalEmail({
          to: recipientEmail,
          subject: `Pago confirmado · ${orderSummaryText(order).slice(0, 100)}`,
          html: orderEmailHtml(
            "Pago confirmado",
            order.payment_type === "deposit"
              ? "Recibimos correctamente la seña de tu pedido. Abajo vas a encontrar el detalle, el saldo restante y cómo continuamos."
              : "Recibimos correctamente el pago completo de tu pedido. Abajo vas a encontrar el detalle y cómo continuamos.",
            order,
          ),
        });
        await supabase
          .from("orders")
          .update({
            customer_email: recipientEmail,
            payment_email_sent_at: new Date().toISOString(),
          })
          .eq("id", order.id);
        console.log("Confirmación enviada al comprador", {
          orderId: order.id,
          resendId: delivery.id,
        });
      }
    }

    // --------------------------------------------------
    // 7. Respuesta correcta
    // --------------------------------------------------

    return new Response(
      JSON.stringify({
        received: true,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (e) {
    console.error("Webhook Mercado Pago error:", e);

    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Error interno",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
});
