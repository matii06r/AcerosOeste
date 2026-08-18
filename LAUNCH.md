# Publicación final en Vercel

El sitio ya usa Supabase real y las funciones de Mercado Pago incluidas. `db push` aplica únicamente las migraciones que todavía estén pendientes.

## 1. Aplicar los últimos ajustes de base de datos

Desde la terminal, dentro de esta carpeta:

```powershell
npm install
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push
npx supabase functions deploy mp-create-preference --no-verify-jwt
npx supabase functions deploy mp-webhook --no-verify-jwt
npx supabase functions deploy send-order-email --no-verify-jwt
```

`db push` aplicará solamente las migraciones pendientes, incluidas `004_product_media.sql` y `005_admin_workflow.sql`. Si una ejecución anterior de `001` quedó a medias, la migración puede reanudarse sin fallar por políticas ya existentes.

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

## 3. Únicos valores que dependen de la URL final

Cuando Vercel entregue la URL definitiva, actualizá el secreto del backend:

```powershell
npx supabase secrets set SITE_URL="https://TU-DOMINIO.vercel.app"
npx supabase functions deploy mp-create-preference --no-verify-jwt
```

En Supabase abrí **Authentication > URL Configuration**:

- Site URL: `https://TU-DOMINIO.vercel.app`
- Redirect URLs: agregá `https://TU-DOMINIO.vercel.app/**`
- Redirect URLs: agregá también `https://TU-DOMINIO.vercel.app/?auth=recovery`

Si ya usás el dominio propio, repetí ambas entradas reemplazando la URL de
Vercel por `https://acerosoeste.com`. La recuperación debe apuntar a la web,
nunca a `dvisdjvzwbfklrpzsuhe.supabase.co`.

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
https://TU_PROJECT_REF.supabase.co/functions/v1/mp-webhook
```

## 4. Correos de pago, envío y autenticación

La tienda envía automáticamente:

- confirmación al cliente cuando Mercado Pago aprueba el pago;
- aviso al cliente cuando el administrador cambia el pedido a **En camino**;
- copia oculta de ambos mensajes a `gestionacerosoeste@gmail.com`.

Para producción, verificá `acerosoeste.com` en Resend y creá una API key. Después:

```powershell
npx supabase secrets set RESEND_API_KEY="TU_API_KEY"
npx supabase secrets set FROM_EMAIL="Aceros Oeste <notificaciones@acerosoeste.com>"
npx supabase secrets set ADMIN_EMAIL="gestionacerosoeste@gmail.com"
npx supabase functions deploy mp-webhook --no-verify-jwt
npx supabase functions deploy send-order-email --no-verify-jwt
```

`FROM_EMAIL` debe pertenecer a un dominio verificado. No uses Gmail como remitente de Resend: la verificación SPF/DKIM del dominio evita rechazos y spam. Las respuestas llegan a `gestionacerosoeste@gmail.com`.

Para que confirmaciones de cuenta y recuperación tampoco salgan con el remitente de Supabase, abrí **Authentication > SMTP Settings**. Podés usar el mismo proveedor o Google SMTP. Para Google necesitás activar la verificación en dos pasos y crear una contraseña de aplicación; el usuario y remitente deben ser `gestionacerosoeste@gmail.com`.

En **Authentication > Email Templates** personalizá **Confirm signup** y **Reset password** con la marca Aceros Oeste. Conservá siempre `{{ .ConfirmationURL }}` en el enlace principal.

## 5. Emails de confirmación de cuenta con Resend

El proveedor incluido por Supabase es sólo para pruebas, limita los envíos y
puede no entregar a usuarios que no pertenezcan al equipo. En el Dashboard
abrí **Authentication > Email > SMTP Settings**, activá SMTP y usá:

```text
Sender name: Aceros Oeste
Sender email: no-reply@acerosoeste.com
Host: smtp.resend.com
Port: 465
Username: resend
Password: la API key de Resend que empieza con re_
```

El dominio debe estar verificado en Resend. En **Providers > Email** mantené
activado **Confirm email**. En **URL Configuration** agregá:

```text
https://TU-DOMINIO.vercel.app/?auth=confirmed
https://TU-DOMINIO.vercel.app/?auth=recovery
https://TU-DOMINIO.vercel.app/**
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

## 6. Publicar clientes y trabajos

Aplicá la migración `006_clients_showcase.sql`:

```powershell
npx supabase db push
```

Luego ingresá como administrador y abrí **Panel general > Clientes y trabajos**.

## 7. Prueba final antes de compartir

1. Crear una cuenta cliente y confirmar el email.
2. Entrar como administrador y crear un producto con foto.
3. Abrir la web en incógnito y comprobar que aparezca ese producto.
4. Hacer un pago de prueba total y otro con seña.
5. Confirmar que el pedido aparezca en Mi cuenta y en Pedidos del admin.
6. Confirmar que Mercado Pago marque el webhook con respuesta HTTP 200.
7. Recién después cambiar credenciales de prueba por producción.

La clave publicable de `config.js` está diseñada para estar en el navegador. Nunca agregues `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` ni `SUPABASE_SERVICE_ROLE_KEY` a archivos del sitio o a Vercel.
