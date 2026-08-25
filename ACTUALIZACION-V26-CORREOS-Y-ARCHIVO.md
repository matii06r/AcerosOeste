# Actualización v26: correo verificable y archivo administrativo

Esta versión evita confirmar envíos que Resend no aceptó y permite despejar los
paneles de arrepentimientos y facturación sin borrar documentación comercial.

## Qué corrige

- La sugerencia pública se guarda primero en Supabase, incluso si Resend falla.
- El visitante recibe una confirmación real: enviado o pendiente.
- La notificación administrativa muestra el texto completo y el estado real del
  correo.
- Si el correo quedó pendiente, el administrador puede reintentarlo desde la
  misma notificación.
- Las respuestas de arrepentimiento guardan por separado el estado de la gestión
  y el del correo al cliente.
- Una solicitud respondida puede salir automáticamente del panel.
- Una solicitud ya respondida también se puede archivar manualmente.
- Un pedido facturado y con factura enviada puede quitarse del panel de
  Facturación. No se eliminan el pedido, la factura ni el PDF.

## Reemplazar la API key inválida de Resend

La columna `DIGEST` de `supabase secrets list` es sólo una huella. Que aparezca
`RESEND_API_KEY` confirma que existe un valor, pero no que ese valor siga siendo
válido.

1. En Resend abrí **API Keys** y creá una clave nueva con permiso para enviar.
2. Copiala en el momento; empieza con `re_`.
3. Desde la carpeta que contiene `supabase/config.toml`, ejecutá:

```powershell
npx supabase login
npx supabase link --project-ref dvisdjvzwbfklrpzsuhe
npx supabase secrets set RESEND_API_KEY="re_PEGA_LA_NUEVA_CLAVE" ADMIN_EMAIL="gestionacerosoestee@gmail.com" FROM_EMAIL="Aceros Oeste <no-reply@notificaciones.acerosoeste.com>" SITE_URL="https://acerosoeste.com" --project-ref dvisdjvzwbfklrpzsuhe
npx supabase secrets list --project-ref dvisdjvzwbfklrpzsuhe
```

No agregues espacios alrededor del signo `=` y no guardes la clave en GitHub,
Vercel, `config.js` ni archivos `.env` públicos.

Si **Authentication > Email > SMTP Settings** usa la clave vieja de Resend,
reemplazá también allí el campo **Password** por la clave nueva. El usuario SMTP
continúa siendo `resend`.

## Aplicar la actualización

```powershell
npx supabase db push
npx supabase functions deploy send-feedback --no-verify-jwt
npx supabase functions deploy retry-feedback-email --no-verify-jwt
npx supabase functions deploy update-withdrawal-request --no-verify-jwt
```

Como se actualizó el módulo de correo compartido, desplegá además todas las
funciones que lo utilizan:

```powershell
npx supabase functions deploy mp-webhook --no-verify-jwt
npx supabase functions deploy send-order-email --no-verify-jwt
npx supabase functions deploy send-admin-notification --no-verify-jwt
npx supabase functions deploy create-withdrawal-request --no-verify-jwt
npx supabase functions deploy send-invoice-email --no-verify-jwt
```

Después subí los archivos web a GitHub/Vercel y esperá el nuevo deployment.

## Prueba final

1. Abrí una ventana de incógnito y enviá una sugerencia nueva.
2. La pantalla debe indicar que fue enviada. Si Resend falla, debe indicar que
   quedó guardada y pendiente, sin mostrar JSON técnico.
3. En el administrador, abrí la notificación. Debe mostrar nombre, email,
   mensaje y estado del correo.
4. Si figura pendiente, usá **Reintentar correo**.
5. Revisá en Resend **Emails** que el estado sea `Delivered` y comprobá también
   Spam/Promociones en Gmail.
6. Respondé una solicitud de arrepentimiento con la opción de quitarla marcada.
   Sólo se archivará automáticamente cuando el correo al cliente haya sido
   aceptado.
7. En Facturación, una venta completamente facturada y enviada debe ofrecer
   **Quitar del panel**.

