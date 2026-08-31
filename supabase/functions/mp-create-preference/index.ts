// @ts-ignore -- Las Edge Functions resuelven imports URL mediante Deno.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TERMS_VERSION = "2026-08-31-v1";

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
    const { items, paymentType = "full", customer, terms } = await req.json();
    if (!Array.isArray(items) || !items.length)
      throw new Error("El carrito está vacío");
    if (!["full", "deposit"].includes(paymentType))
      throw new Error("Tipo de pago inválido");
    if (!customer?.name || !customer?.phone)
      throw new Error("Faltan datos del comprador");
    if (terms?.accepted !== true || terms?.version !== TERMS_VERSION)
      throw new Error(
        "Debés aceptar la versión vigente de los términos y condiciones",
      );
    const billing = customer?.billing || {};
    const billingCondition = String(
      billing.condition || "consumer_final",
    );
    if (
      ![
        "consumer_final",
        "monotributista",
        "responsable_inscripto",
        "exento",
      ].includes(billingCondition)
    )
      throw new Error("Condición fiscal inválida");
    if (
      billingCondition !== "consumer_final" &&
      (!billing.name || !billing.documentNumber)
    )
      throw new Error("Completá la razón social y el CUIT para facturar");
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
    const accountEmail = String(user.email || "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(accountEmail))
      throw new Error("Tu cuenta no tiene un email válido");
    const ids = items.map((i: { productId: string }) => i.productId);
    const { data: products, error } = await supabase
      .from("products")
      .select("id,name,price,stock_quantity,images,sale_type")
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
        customer_email: accountEmail,
        customer_phone: customer.phone,
        billing_condition: billingCondition,
        billing_name: String(billing.name || customer.name).trim(),
        billing_document_type: String(
          billing.documentType ||
            (billingCondition === "consumer_final" ? "DNI" : "CUIT"),
        ).trim(),
        billing_document_number:
          String(billing.documentNumber || "").replace(/[^0-9]/g, "") || null,
        billing_address: String(billing.address || "").trim() || null,
        billing_status: "pending",
        terms_accepted_at: new Date().toISOString(),
        terms_version: TERMS_VERSION,
      })
      .select()
      .single();
    if (orderError) throw orderError;
    const { data: defaultSettings } = await supabase
      .from("store_settings")
      .select("vat_rate")
      .eq("id", 1)
      .single();
    const defaultVatRate = Number(defaultSettings?.vat_rate ?? 21);
    const { data: pricingRows } = await supabase
      .from("product_pricing")
      .select("product_id,vat_rate")
      .in("product_id", ids);
    const vatByProduct = new Map<string, number>(
      (pricingRows || []).map(
        (row) => [String(row.product_id), Number(row.vat_rate)] as const,
      ),
    );
    const { error: itemsError } = await supabase.from("order_items").insert(
      normalized.map((x) => {
        const vatRate = vatByProduct.get(String(x.id)) ?? defaultVatRate;
        const unitNetPrice = Number(x.price) / (1 + vatRate / 100);
        return {
        order_id: order.id,
        product_id: x.id,
        product_name: x.name,
        product_image_url:
          Array.isArray(x.images) && x.images.length ? x.images[0] : null,
        unit_price: x.price,
        quantity: x.quantity,
        subtotal: x.subtotal,
        sale_type: x.sale_type || "standard",
        unit_net_price: Math.round(unitNetPrice * 100) / 100,
        vat_rate: vatRate,
        unit_vat_amount:
          Math.round((Number(x.price) - unitNetPrice) * 100) / 100,
        };
      }),
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
        payer: { name: customer.name, email: accountEmail },
        external_reference: order.id,
        back_urls: {
          success: `${site}/#inicio?checkout=exito`,
          failure: `${site}/#inicio?checkout=error`,
          pending: `${site}/#inicio?checkout=pendiente`,
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
