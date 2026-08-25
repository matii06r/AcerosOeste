# Publicación final en Vercel

El sitio ya usa Supabase real y las funciones de Mercado Pago incluidas. `db push` aplica únicamente las migraciones que todavía estén pendientes.

## 0. Activar Mercado Pago real (obligatorio antes de vender)

El aviso de que una credencial es de prueba significa que `MP_ACCESS_TOKEN` en
Supabase todavía contiene el token de prueba. La web no usa una Public Key de
Mercado Pago: Checkout Pro crea la preferencia exclusivamente en el backend con
el **Access Token productivo**.

En Mercado Pago abrí **Tus integraciones > tu aplicación > Credenciales de
producción**, completá la activación si te la solicita y copiá el Access Token
de producción. Luego ejecutá estos comandos **de a uno**, desde la carpeta que
contiene `supabase/config.toml`:

```powershell
npx supabase login
npx supabase link --project-ref dvisdjvzwbfklrpzsuhe
npx supabase secrets set MP_ACCESS_TOKEN="PEGAR_ACCESS_TOKEN_PRODUCTIVO" --project-ref dvisdjvzwbfklrpzsuhe
npx supabase secrets set MP_ENVIRONMENT="production" --project-ref dvisdjvzwbfklrpzsuhe
npx supabase secrets set SITE_URL="https://acerosoeste.com" --project-ref dvisdjvzwbfklrpzsuhe
```

En **Webhooks** de la misma aplicación productiva configurá el evento Pagos con:

```text
https://dvisdjvzwbfklrpzsuhe.supabase.co/functions/v1/mp-webhook
```

Copiá la clave secreta de firma de ese webhook y guardala:

```powershell
npx supabase secrets set MP_WEBHOOK_SECRET="PEGAR_FIRMA_SECRETA_PRODUCTIVA" --project-ref dvisdjvzwbfklrpzsuhe
npx supabase functions deploy mp-create-preference --project-ref dvisdjvzwbfklrpzsuhe --no-verify-jwt
npx supabase functions deploy mp-webhook --project-ref dvisdjvzwbfklrpzsuhe --no-verify-jwt
```

No pegues ninguna de esas credenciales en `config.js`, GitHub o Vercel. Las
preferencias de pago creadas antes del cambio conservan la configuración
anterior: vaciá la pestaña vieja de Mercado Pago e iniciá una compra nueva.

## 1. Aplicar los últimos ajustes de base de datos

Desde la terminal, dentro de esta carpeta:

```powershell
npm install
npx supabase link --project-ref dvisdjvzwbfklrpzsuhe
npx supabase db push
npx supabase functions deploy mp-create-preference --project-ref dvisdjvzwbfklrpzsuhe --no-verify-jwt
npx supabase functions deploy mp-webhook --project-ref dvisdjvzwbfklrpzsuhe --no-verify-jwt
npx supabase functions deploy send-order-email --project-ref dvisdjvzwbfklrpzsuhe --no-verify-jwt
npx supabase functions deploy admin-delete-user --project-ref dvisdjvzwbfklrpzsuhe --no-verify-jwt
```

`db push` aplicará solamente las migraciones pendientes, incluidas `007`, `008`,
`009`, `010`, `011_remove_pending_orders.sql`, `012_profile_avatars.sql` y
`013_order_chat_and_profile_permissions.sql`. La migración `008` completa el email de
las cuentas existentes, guarda el de los nuevos registros y habilita la lista
de usuarios del panel sin exponer esos datos a visitantes ni a otros clientes.
La migración `009` activa la sincronización en vivo de pedidos, preguntas, chat,
catálogo y usuarios, y agrega el borrado seguro de mensajes y conversaciones.
La migración `010` oculta los intentos de checkout abandonados. Un pedido recién
aparece para el cliente y el administrador cuando el webhook acredita el pago
total o la seña configurada.
La migración `011` convierte cualquier pedido viejo que todavía figure como
**Pendiente** en un intento oculto y elimina Pendiente de los estados permitidos.
La migración `012` agrega los iconos predeterminados y el bucket seguro donde
cada usuario puede subir únicamente su propia foto de perfil.
La migración `013` corrige el permiso de actualización del avatar sin permitir
que un cliente cambie su rol, conserva una foto del producto dentro de cada
compra y crea un chat privado independiente por pedido.

Después de aplicar `013`, desplegá la función que inicia el checkout para que
las compras nuevas guarden también la foto del producto:

```powershell
npx supabase functions deploy mp-create-preference --project-ref dvisdjvzwbfklrpzsuhe --no-verify-jwt
npx supabase functions deploy admin-delete-user --project-ref dvisdjvzwbfklrpzsuhe --no-verify-jwt
```

El orden es importante: primero `db push` y después el despliegue de la función.
Si una ejecución anterior de `001` quedó a medias, la migración puede reanudarse
sin fallar por políticas ya existentes.

## 2. Subir a Vercel

La opción más simple es crear un repositorio privado en GitHub con esta carpeta y, en Vercel, elegir **Add New > Project > Import**. Configuración:

- Framework Preset: `Other`
- Build Command: vacío
- Output Directory: vacío
- Root Directory: la carpeta que contiene `index.html`

También podés instalar Vercel CLI y ejecutar:

```powershell
npx vercel
npx vercel --prod
```

## 3. Dominio definitivo

El backend debe usar exclusivamente el dominio definitivo:

```powershell
npx supabase secrets set SITE_URL="https://acerosoeste.com" --project-ref dvisdjvzwbfklrpzsuhe
npx supabase functions deploy mp-create-preference --project-ref dvisdjvzwbfklrpzsuhe --no-verify-jwt
```

En Supabase abrí **Authentication > URL Configuration**:

- Site URL: `https://acerosoeste.com`
- Redirect URLs: agregá `https://acerosoeste.com/**`
- Redirect URLs: agregá también `https://acerosoeste.com/?auth=recovery`

La recuperación debe apuntar a la web, nunca a
`dvisdjvzwbfklrpzsuhe.supabase.co`.

### Email de recuperación de contraseña

En **Authentication > Email Templates > Reset password**, usá el asunto `Cambiá tu contraseña de Acerosoeste` y este contenido:

```html
<h2>Recuperá tu cuenta de Acerosoeste</h2>
<p>Recibimos una solicitud para cambiar tu contraseña.</p>
<p><a href="{{ .ConfirmationURL }}">Cambiar contraseña</a></p>
<p>Si no hiciste esta solicitud, podés ignorar este mensaje.</p>
```

El enlace vuelve a `/?auth=recovery`, donde la tienda pide la nueva contraseña dos veces y guarda el cambio directamente en Supabase Auth. Si tu plan no permite editar plantillas con el proveedor de email predeterminado, configurá SMTP propio desde **Authentication > SMTP Settings** o conservá la plantilla estándar de recuperación.

En Mercado Pago, el webhook sigue siendo el de Supabase y no cambia:

```text
https://dvisdjvzwbfklrpzsuhe.supabase.co/functions/v1/mp-webhook
```

## 4. Correos de pago, envío y autenticación

La tienda envía automáticamente:

- confirmación al cliente cuando Mercado Pago aprueba el pago;
- aviso al cliente cuando el administrador cambia el pedido a **En camino**;
- copia oculta de ambos mensajes a `gestionacerosoestee@gmail.com`.

Para producción, verificá `acerosoeste.com` en Resend y creá una API key. Después:

```powershell
npx supabase secrets set RESEND_API_KEY="TU_API_KEY" --project-ref dvisdjvzwbfklrpzsuhe
npx supabase secrets set FROM_EMAIL="Aceros Oeste <no-reply@notificaciones.acerosoeste.com>" --project-ref dvisdjvzwbfklrpzsuhe
npx supabase secrets set ADMIN_EMAIL="gestionacerosoestee@gmail.com" --project-ref dvisdjvzwbfklrpzsuhe
npx supabase functions deploy mp-webhook --project-ref dvisdjvzwbfklrpzsuhe --no-verify-jwt
npx supabase functions deploy send-order-email --project-ref dvisdjvzwbfklrpzsuhe --no-verify-jwt
```

`FROM_EMAIL` debe pertenecer a un dominio verificado. No uses Gmail como remitente de Resend: la verificación SPF/DKIM del dominio evita rechazos y spam. Las respuestas llegan a `gestionacerosoestee@gmail.com`.

Para que las confirmaciones de cuenta y recuperación tampoco salgan con el
remitente de Supabase, configurá el SMTP de Resend en **Authentication > SMTP
Settings** con los datos de la sección siguiente.

En **Authentication > Email Templates** personalizá **Confirm signup** y **Reset password** con la marca Aceros Oeste. Conservá siempre `{{ .ConfirmationURL }}` en el enlace principal.

## 5. Emails de confirmación de cuenta con Resend

El proveedor incluido por Supabase es sólo para pruebas, limita los envíos y
puede no entregar a usuarios que no pertenezcan al equipo. En el Dashboard
abrí **Authentication > Email > SMTP Settings**, activá SMTP y usá:

```text
Sender name: Aceros Oeste
Sender email: no-reply@notificaciones.acerosoeste.com
Host: smtp.resend.com
Port: 465
Username: resend
Password: la API key de Resend que empieza con re_
```

El dominio debe estar verificado en Resend. En **Providers > Email** mantené
activado **Confirm email**. En **URL Configuration** agregá:

```text
https://acerosoeste.com/?auth=confirmed
https://acerosoeste.com/?auth=recovery
https://acerosoeste.com/**
```

En la plantilla **Confirm signup**, conservá `{{ .ConfirmationURL }}`:

```html
<h2>Confirmá tu cuenta de Aceros Oeste</h2>
<p>Para terminar de crear tu cuenta, confirmá tu dirección de email.</p>
<p><a href="{{ .ConfirmationURL }}">Confirmar mi cuenta</a></p>
<p>Si no solicitaste esta cuenta, ignorá este mensaje.</p>
```

No desactives la confirmación. Después de guardar SMTP, creá un usuario nuevo
y verificá la entrega en los logs de Resend.

## 6. Publicar clientes, trabajos y usar el chat

Aplicá todas las migraciones pendientes (incluidas `006` y `007`):

```powershell
npx supabase db push
```

Luego ingresá como administrador. **Panel general > Clientes y trabajos**
gestiona las publicaciones y **Panel general > Chats** centraliza las consultas
privadas de clientes autenticados.

## 7. Validación final de producción

1. Crear una cuenta cliente y confirmar el email.
2. Entrar como administrador y crear un producto con varias fotos y un video.
3. Abrir la web en incógnito y comprobar que aparezca ese producto.
4. Confirmar que `MP_ENVIRONMENT` esté en `production` y realizar una compra real controlada.
5. Confirmar que el pedido aparezca en Mi cuenta y en Pedidos del admin.

## 8. Facturación y botón de arrepentimiento (v24)

Antes de publicar la v24, leé
`ACTUALIZACION-V24-FISCAL-Y-ARREPENTIMIENTO.md`. La migración `017` agrega datos
fiscales, facturas privadas, clasificación de productos y solicitudes de
arrepentimiento.

```powershell
npx supabase db push
npx supabase functions deploy mp-create-preference --no-verify-jwt
npx supabase functions deploy mp-webhook --no-verify-jwt
npx supabase functions deploy send-order-email --no-verify-jwt
npx supabase functions deploy send-admin-notification --no-verify-jwt
npx supabase functions deploy create-withdrawal-request --no-verify-jwt
npx supabase functions deploy update-withdrawal-request --no-verify-jwt
npx supabase functions deploy send-invoice-email --no-verify-jwt
```

El precio publicado es siempre final. No sumes IVA durante el checkout ni al
registrar la factura: definí con el contador la condición fiscal, el tipo de
comprobante, el punto de venta y el tratamiento de señas y saldos.
6. Confirmar que Mercado Pago marque el webhook con respuesta HTTP 200.
7. Abrir cliente y administrador en dos ventanas: cancelar un pedido y confirmar
   que el panel cambie sin usar F5.
8. Enviar, responder y eliminar un mensaje; comprobar que ambas ventanas cambien
   en el momento. Repetir publicando una pregunta en un producto.
9. Abrir Panel general > Usuarios, comprobar los datos y eliminar una cuenta de
   prueba. La cuenta administradora no debe mostrar el botón de eliminación.
10. Desde Mi cuenta, elegir un icono predeterminado y luego subir una foto propia.
11. Completar un pago y volver a la tienda: después de la confirmación del
    webhook, los artículos pagados deben desaparecer automáticamente del carrito.
12. Probar Crear producto, Modificar y Publicar similar desde el nuevo menú
    lateral del panel administrativo.

Si un producto se elimina, se desactiva o se queda sin stock mientras permanece
guardado en un carrito, la web lo quita al recargar y corrige también el contador.
El checkout vuelve a validar el carrito antes de llamar a Mercado Pago.

La clave publicable de `config.js` está diseñada para estar en el navegador. Nunca agregues `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` ni `SUPABASE_SERVICE_ROLE_KEY` a archivos del sitio o a Vercel.

## Avisos de Deno en Visual Studio Code

La carpeta `.vscode` recomienda la extensión oficial **Deno** y la activa sólo
dentro de `supabase/functions`. Si VS Code todavía muestra subrayados en los
imports `https://esm.sh`, instalá la extensión recomendada y ejecutá
**Developer: Reload Window** desde la paleta de comandos. Esos imports son
propios de las Edge Functions y no se resuelven con el servidor TypeScript
normal de VS Code.

## 9. Cierre de interfaz, sugerencias y archivo de pedidos (v25)

Aplicá la migración `018_feedback_and_order_archiving.sql` y desplegá la nueva
función pública:

```powershell
npx supabase db push
npx supabase functions deploy send-feedback --no-verify-jwt
```

Como cambió el módulo compartido de correo, volvé a desplegar también:

```powershell
npx supabase functions deploy mp-webhook --no-verify-jwt
npx supabase functions deploy send-order-email --no-verify-jwt
npx supabase functions deploy send-admin-notification --no-verify-jwt
npx supabase functions deploy create-withdrawal-request --no-verify-jwt
npx supabase functions deploy update-withdrawal-request --no-verify-jwt
npx supabase functions deploy send-invoice-email --no-verify-jwt
```

Los pedidos finalizados ahora se archivan; no los borres manualmente desde
Supabase porque forman parte del historial comercial y pueden tener facturas o
solicitudes relacionadas. Revisá los detalles en
`ACTUALIZACION-V25-CIERRE-DE-TIENDA.md`.

## 10. Correo verificable y paneles limpios (v26)

La v26 agrega la migración `019_email_delivery_and_admin_archives.sql`, el
reintento protegido de sugerencias y el archivo reversible de arrepentimientos
y facturación.

Si Resend devuelve `401 API key is invalid`, generá una clave nueva y reemplazá
el secreto. Que `RESEND_API_KEY` aparezca en `supabase secrets list` sólo indica
que hay un valor guardado; el `DIGEST` no valida la clave.

```powershell
npx supabase secrets set RESEND_API_KEY="re_PEGA_LA_NUEVA_CLAVE" ADMIN_EMAIL="gestionacerosoestee@gmail.com" FROM_EMAIL="Aceros Oeste <no-reply@notificaciones.acerosoeste.com>" SITE_URL="https://acerosoeste.com" --project-ref dvisdjvzwbfklrpzsuhe
npx supabase db push
npx supabase functions deploy send-feedback --no-verify-jwt
npx supabase functions deploy retry-feedback-email --no-verify-jwt
npx supabase functions deploy update-withdrawal-request --no-verify-jwt
npx supabase functions deploy mp-webhook --no-verify-jwt
npx supabase functions deploy send-order-email --no-verify-jwt
npx supabase functions deploy send-admin-notification --no-verify-jwt
npx supabase functions deploy create-withdrawal-request --no-verify-jwt
npx supabase functions deploy send-invoice-email --no-verify-jwt
```

Si Supabase Auth también usa Resend por SMTP, actualizá su contraseña en
**Authentication > Email > SMTP Settings**. La guía completa está en
`ACTUALIZACION-V26-CORREOS-Y-ARCHIVO.md`.
