type EmailInput = {
  to: string;
  subject: string;
  html: string;
  bccAdmin?: boolean;
};

export async function sendTransactionalEmail(input: EmailInput) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("FROM_EMAIL");
  const adminEmail =
    Deno.env.get("ADMIN_EMAIL") || "gestionacerosoeste@gmail.com";
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
      reply_to: adminEmail,
      subject: input.subject,
      html: input.html,
    }),
  });
  if (!response.ok) {
    throw new Error(`Email rechazado: ${await response.text()}`);
  }
}

export function orderEmailHtml(
  title: string,
  message: string,
  order: Record<string, unknown>,
) {
  const id = String(order.id || "")
    .slice(0, 8)
    .toUpperCase();
  const amount = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(Number(order.subtotal || 0));
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#07111c;color:#eef4fa;padding:32px;border-radius:12px"><h1 style="color:#f56b18">${title}</h1><p>${message}</p><div style="background:#101d2a;padding:18px;border-radius:8px"><b>Pedido ${id}</b><p>Total: ${amount}</p></div><p style="color:#9ba9b8">Ante cualquier consulta respondé este correo o escribinos por WhatsApp.</p><p>Aceros Oeste</p></div>`;
}
