# Actualización v21 — perfiles y notificaciones

## 1. Actualizar la base y la función

Desde la carpeta del proyecto:

```powershell
npx supabase login
npx supabase link --project-ref dvisdjvzwbfklrpzsuhe
npx supabase db push
npx supabase secrets set ADMIN_EMAIL=gestionacerosoeste@gmail.com
npx supabase functions deploy send-admin-notification
```

La migración `014_notifications_and_color_avatars.sql` crea el centro de
notificaciones, habilita los avatares por color y deja el nombre inicial del
administrador como `Aceros Oeste`.

## 2. Publicar en GitHub y Vercel

No agregues `node_modules`. Desde la raíz correcta del proyecto:

```powershell
git add app.js index.html styles.css manifest.webmanifest sw.js ACTUALIZACION-V21.md supabase/config.toml supabase/functions/_shared/email.ts supabase/functions/send-admin-notification/index.ts supabase/migrations/014_notifications_and_color_avatars.sql tests/runtime-qa.mjs
git commit -m "Perfiles y notificaciones de gestion"
git pull --rebase origin main
git push origin HEAD:main
```

Vercel volverá a publicar automáticamente al recibir el cambio en `main`.

## 3. Activar avisos en el dispositivo

Ingresá como administrador, abrí la campana del encabezado y tocá
`Activar avisos en este dispositivo`. En un celular también podés instalar la
web desde el menú del navegador para usarla como PWA.

Estos avisos del dispositivo aparecen mientras el panel está abierto. Para
recibirlos con el navegador completamente cerrado hace falta configurar Web
Push y registrar una suscripción específica del teléfono.

Las preguntas y mensajes quedan visibles en la campana y también se envían a
`gestionacerosoeste@gmail.com`. Los correos se leen entrando a esa cuenta en
Gmail; Resend solamente realiza el envío automático.
