# Actualización v29 — cierre final

Esta versión corrige el último problema visual de la factura y simplifica el
editor administrativo de clientes.

## Cambios

- El botón de descarga de facturas conserva su diseño después de abrir el PDF.
- El comprobante muestra por separado el icono, tipo, numeración, importe y
  acción de descarga, también en pantallas pequeñas.
- El editor de Clientes ya no muestra `Visible`, `Orden` ni la aclaración sobre
  títulos automáticos.
- Los clientes nuevos se publican automáticamente y se ordenan al final.
- Los clientes existentes conservan su orden cuando se editan.
- Se corrigió el tipado del cálculo de IVA en la función que crea la preferencia
  de Mercado Pago.
- La caché del navegador se actualizó a v29.

## Archivos modificados

- `app.js`
- `index.html`
- `styles.css`
- `tests/runtime-qa.mjs`
- `supabase/functions/mp-create-preference/index.ts`

No hay migraciones nuevas ni cambios de estructura en Supabase.

## Publicación

Desde la raíz del proyecto:

```powershell
npm install
npm test
npx supabase login
npx supabase link --project-ref dvisdjvzwbfklrpzsuhe
npx supabase functions deploy mp-create-preference --project-ref dvisdjvzwbfklrpzsuhe --no-verify-jwt
```

Después subí los cambios a GitHub:

```powershell
git add app.js index.html styles.css tests/runtime-qa.mjs supabase/functions/mp-create-preference/index.ts ACTUALIZACION-V29-CIERRE-FINAL.md
git commit -m "Corrige descarga de facturas y simplifica clientes"
git pull --rebase origin main
git push origin HEAD:main
```

Cuando Vercel termine, realizá una recarga forzada con `Ctrl + F5` y probá una
factura existente desde una cuenta cliente. El botón debe conservar el mismo
diseño antes y después de abrir el PDF.

## Verificación incluida

La prueba automatizada recorre catálogo, carrito, perfiles, clientes, pedidos,
chat, notificaciones, Mercado Pago, facturación, apertura del PDF,
arrepentimiento, sugerencias, archivo administrativo y recuperación de
contraseña. También comprueba que el editor de Clientes no vuelva a mostrar los
controles eliminados.
