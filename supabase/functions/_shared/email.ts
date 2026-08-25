type EmailInput = {
  to: string;
  subject: string;
  html: string;
  bccAdmin?: boolean;
  replyTo?: string;
};

export async function sendTransactionalEmail(input: EmailInput) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("FROM_EMAIL");
  const adminEmail =
    Deno.env.get("ADMIN_EMAIL") || "gestionacerosoestee@gmail.com";
  if (!apiKey || !from) {
    throw new Error("Faltan RESEND_API_KEY o FROM_EMAIL");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      ...(input.bccAdmin === false ? {} : { bcc: [adminEmail] }),
      reply_to: input.replyTo || adminEmail,
      subject: input.subject,
      html: input.html,
    }),
  });
  if (!response.ok) {
    throw new Error(`Email rechazado: ${await response.text()}`);
  }
}

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const money = (value: unknown) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

function orderItems(order: Record<string, unknown>) {
  return Array.isArray(order.order_items)
    ? (order.order_items as Array<Record<string, unknown>>)
    : [];
}

export function orderSummaryText(order: Record<string, unknown>) {
  const summary = orderItems(order)
    .map(
      (item) =>
        `${Math.max(1, Number(item.quantity) || 1)}× ${String(item.product_name || "Producto")}`,
    )
    .join(" · ");
  return summary || `Pedido ${String(order.id || "").slice(0, 8).toUpperCase()}`;
}

export function orderEmailHtml(
  title: string,
  message: string,
  order: Record<string, unknown>,
) {
  const id = String(order.id || "")
    .slice(0, 8)
    .toUpperCase();
  const total = Number(order.subtotal || 0);
  const paid = Number(order.amount_to_pay || total);
  const balance = Math.max(0, total - paid);
  const customerName = String(order.customer_name || "").trim();
  const items = orderItems(order);
  const itemRows = items.length
    ? items
        .map((item) => {
          const quantity = Math.max(1, Number(item.quantity) || 1);
          const unitPrice = Number(item.unit_price || item.subtotal) || 0;
          return `<tr><td style="padding:12px 0;border-bottom:1px solid #263747;color:#eef4fa"><b>${escapeHtml(item.product_name || "Producto")}</b><br><span style="color:#94a8ba;font-size:12px">Cantidad: ${quantity}</span></td><td style="padding:12px 0;border-bottom:1px solid #263747;color:#eef4fa;text-align:right">${escapeHtml(money(unitPrice * quantity))}</td></tr>`;
        })
        .join("")
    : `<tr><td style="padding:12px 0;color:#94a8ba">Detalle disponible en Mi cuenta</td></tr>`;
  const balanceBlock = balance
    ? `<div style="margin-top:12px;padding:14px;border-radius:8px;background:#2a1b11;border:1px solid #70401f"><b style="color:#ffb27d">Saldo pendiente: ${escapeHtml(money(balance))}</b><p style="margin:7px 0 0;color:#d8bca8;font-size:12px;line-height:1.5">Te indicaremos por el chat del pedido o por email cómo y cuándo abonarlo.</p></div>`
    : "";
  return `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;background:#07111c;color:#eef4fa;padding:32px;border-radius:12px"><p style="margin:0 0 10px;color:#f56b18;font-size:12px;font-weight:700;letter-spacing:1px">ACEROS OESTE</p><h1 style="margin:0 0 18px;color:#fff;font-size:28px">${escapeHtml(title)}</h1>${customerName ? `<p>Hola ${escapeHtml(customerName)},</p>` : ""}<p style="color:#b7c5d1;line-height:1.7">${escapeHtml(message)}</p><div style="margin:24px 0;padding:20px;background:#101d2a;border:1px solid #283747;border-radius:10px"><div style="display:flex;justify-content:space-between;gap:15px"><b>Compra ${escapeHtml(id)}</b><span style="color:#f56b18;font-weight:700">${escapeHtml(order.payment_type === "deposit" ? "Seña acreditada" : "Pago acreditado")}</span></div><table role="presentation" style="width:100%;margin-top:14px;border-collapse:collapse">${itemRows}</table><div style="margin-top:15px;text-align:right;color:#fff"><span style="color:#94a8ba">Total del pedido:</span> <b>${escapeHtml(money(total))}</b><br><span style="color:#94a8ba">Importe acreditado:</span> <b>${escapeHtml(money(paid))}</b></div>${balanceBlock}</div><div style="padding:20px;border-radius:10px;background:#0c1a27"><h2 style="margin:0 0 12px;font-size:17px">¿Cómo seguimos?</h2><ol style="margin:0;padding-left:20px;color:#b7c5d1;line-height:1.8"><li>Ya registramos tu compra y el pago acreditado.</li><li>En breve nos comunicaremos para coordinar fabricación, entrega o retiro.</li><li>Podés retirar por Av. San Martín 4092, de lunes a viernes de 9:00 a 17:00 hs, coordinando previamente.</li></ol></div><div style="margin:24px 0"><a href="https://acerosoeste.com/#cuenta" style="display:inline-block;margin:0 8px 8px 0;padding:13px 17px;border-radius:6px;background:#f56b18;color:#fff;text-decoration:none;font-weight:700">Ver mi compra</a><a href="https://wa.me/5491134322199" style="display:inline-block;padding:13px 17px;border-radius:6px;background:#17314b;color:#fff;text-decoration:none;font-weight:700">Contactar por WhatsApp</a></div><p style="color:#8fa1b1;font-size:12px;line-height:1.6">También podés responder directamente este correo. Las respuestas llegan a gestionacerosoestee@gmail.com.</p><p style="margin-bottom:0">Aceros Oeste</p></div>`;
}
