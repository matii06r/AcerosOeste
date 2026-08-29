# Actualización v30 — correo exclusivo al comprador

Esta versión separa definitivamente los correos del comprador y de
administración.

## Correcciones

- La confirmación de pago se envía únicamente al email autenticado de la cuenta
  que realizó la compra.
- El checkout ya no envía un email editable al backend: la función obtiene el
  destinatario directamente desde Supabase Auth.
- El webhook vuelve a validar el email de la cuenta antes de enviar.
- Los correos al cliente ya no incluyen copia oculta al administrador.
- Los avisos administrativos siguen llegando a `ADMIN_EMAIL` mediante sus
  funciones específicas.
- Facturas, estados de envío y resoluciones de arrepentimiento tampoco generan
  copias ocultas accidentales.
- La respuesta del proveedor de correo conserva el identificador de envío para
  los logs del webhook.

## Archivos modificados

- `app.js`
- `index.html`
- `tests/runtime-qa.mjs`
- `supabase/functions/_shared/email.ts`
- `supabase/functions/mp-create-preference/index.ts`
- `supabase/functions/mp-webhook/index.ts`
- `supabase/functions/send-feedback/index.ts`
- `supabase/functions/retry-feedback-email/index.ts`
- `supabase/functions/send-admin-notification/index.ts`

No hay migraciones nuevas.

## Despliegue

```powershell
npm install
npm test
npx supabase login
npx supabase link --project-ref dvisdjvzwbfklrpzsuhe
npx supabase functions deploy mp-create-preference --project-ref dvisdjvzwbfklrpzsuhe --no-verify-jwt
npx supabase functions deploy mp-webhook --project-ref dvisdjvzwbfklrpzsuhe --no-verify-jwt
npx supabase functions deploy send-order-email --project-ref dvisdjvzwbfklrpzsuhe --no-verify-jwt
npx supabase functions deploy send-invoice-email --project-ref dvisdjvzwbfklrpzsuhe --no-verify-jwt
npx supabase functions deploy create-withdrawal-request --project-ref dvisdjvzwbfklrpzsuhe --no-verify-jwt
npx supabase functions deploy update-withdrawal-request --project-ref dvisdjvzwbfklrpzsuhe --no-verify-jwt
npx supabase functions deploy send-feedback --project-ref dvisdjvzwbfklrpzsuhe --no-verify-jwt
npx supabase functions deploy retry-feedback-email --project-ref dvisdjvzwbfklrpzsuhe --no-verify-jwt
npx supabase functions deploy send-admin-notification --project-ref dvisdjvzwbfklrpzsuhe --no-verify-jwt
```

Hay que volver a desplegar todas las funciones que importan `_shared/email.ts`
para que ninguna conserve la versión anterior con copia oculta.
