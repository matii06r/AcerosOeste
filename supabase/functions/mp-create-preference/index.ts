import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
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
    if (!Deno.env.get("MP_ACCESS_TOKEN"))
      throw new Error("Mercado Pago no está configurado");
    if (!configuredSite) throw new Error("SITE_URL no está configurado");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
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
    const percentage = Number(settings?.deposit_percentage || 30);
    const amount =
      paymentType === "deposit"
        ? Math.round(subtotal * percentage) / 100
        : subtotal;
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "");
    const {
      data: { user },
    } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user?.id || null,
        status: "pending",
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
        Authorization: `Bearer ${Deno.env.get("MP_ACCESS_TOKEN")}`,
        "Content-Type": "application/json",
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
