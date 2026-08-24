// @ts-ignore -- Las Edge Functions resuelven imports URL mediante Deno.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const configuredSite = Deno.env.get("SITE_URL") || "";
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { items, paymentType = "full", customer } = await req.json();
    if (!Array.isArray(items) || !items.length)
      throw new Error("El carrito está vacío");
    if (!["full", "deposit"].includes(paymentType))
      throw new Error("Tipo de pago inválido");
    if (!customer?.name || !customer?.email || !customer?.phone)
      throw new Error("Faltan datos del comprador");
    const mpAccessToken = Deno.env.get("MP_ACCESS_TOKEN") || "";
    if (!mpAccessToken)
      throw new Error("Mercado Pago no está configurado");
    if (Deno.env.get("MP_ENVIRONMENT") !== "production")
      throw new Error("Mercado Pago está configurado en modo de prueba");
    if (!configuredSite) throw new Error("SITE_URL no está configurado");
    if (!/^https:\/\/acerosoeste\.com\/?$/i.test(configuredSite))
      throw new Error("SITE_URL debe ser https://acerosoeste.com en producción");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = token
      ? await supabase.auth.getUser(token)
      : { data: { user: null }, error: new Error("Sin sesión") };
    if (authError || !user)
      throw new Error("Iniciá sesión antes de continuar con el pago");
    const ids = items.map((i: { productId: string }) => i.productId);
    const { data: products, error } = await supabase
      .from("products")
      .select("id,name,price,stock_quantity")
      .in("id", ids)
      .eq("is_active", true);
    if (error) throw error;
    const normalized = items.map(
      (item: { productId: string; quantity: number }) => {
        const p = products?.find((x) => x.id === item.productId);
        const q = Math.max(1, Math.floor(item.quantity || 0));
        if (!p || p.stock_quantity < q)
          throw new Error("Producto o stock inválido");
        return { ...p, quantity: q, subtotal: Number(p.price) * q };
      },
    );
    const subtotal = normalized.reduce((s, x) => s + x.subtotal, 0);
    const { data: settings } = await supabase
      .from("store_settings")
      .select("deposit_percentage")
      .eq("id", 1)
      .single();
    const percentage = Number(settings?.deposit_percentage || 50);
    const amount =
      paymentType === "deposit"
        ? Math.round(subtotal * percentage) / 100
        : subtotal;
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        status: "awaiting_payment",
        payment_type: paymentType,
        subtotal,
        deposit_percentage: paymentType === "deposit" ? percentage : null,
        amount_to_pay: amount,
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
      })
      .select()
      .single();
    if (orderError) throw orderError;
    const { error: itemsError } = await supabase.from("order_items").insert(
      normalized.map((x) => ({
        order_id: order.id,
        product_id: x.id,
        product_name: x.name,
        unit_price: x.price,
        quantity: x.quantity,
        subtotal: x.subtotal,
      })),
    );
    if (itemsError) {
      await supabase.from("orders").delete().eq("id", order.id);
      throw itemsError;
    }
    const site = configuredSite.replace(/\/$/, "");
    const cartDescription = normalized
      .map((product) => `${product.quantity}× ${product.name}`)
      .join(" + ");
    const visibleTitle = `${
      paymentType === "deposit" ? `Seña ${percentage}% · ` : ""
    }${cartDescription}`.slice(0, 250);
    const mercadoPagoItems = [
      {
        title: visibleTitle,
        description: `Compra en Aceros Oeste: ${cartDescription}`.slice(0, 250),
        quantity: 1,
        currency_id: "ARS",
        unit_price: amount,
      },
    ];
    const mp = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpAccessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": order.id,
      },
      body: JSON.stringify({
        items: mercadoPagoItems,
        payer: { name: customer.name, email: customer.email },
        external_reference: order.id,
        back_urls: {
          success: `${site}/#checkout/exito`,
          failure: `${site}/#checkout/error`,
          pending: `${site}/#checkout/pendiente`,
        },
        auto_return: "approved",
        statement_descriptor: "ACEROS OESTE",
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook`,
      }),
    });
    const preference = await mp.json();
    if (!mp.ok) {
      await supabase.from("orders").delete().eq("id", order.id);
      throw new Error(
        preference.message || "Mercado Pago rechazó la preferencia",
      );
    }
    await supabase
      .from("orders")
      .update({ mp_preference_id: preference.id })
      .eq("id", order.id);
    return Response.json(
      { orderId: order.id, initPoint: preference.init_point },
      { headers: cors },
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Error inesperado" },
      { status: 400, headers: cors },
    );
  }
});
