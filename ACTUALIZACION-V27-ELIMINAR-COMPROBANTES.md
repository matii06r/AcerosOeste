# Actualización v27: eliminar comprobantes de compras canceladas

Esta versión permite borrar de la web un comprobante cargado por error cuando
la compra ya fue marcada como **Cancelada**.

## Qué cambia

- En **Panel general → Facturación**, cada comprobante de una compra cancelada
  muestra **Eliminar comprobante**.
- La acción pide confirmación y elimina:
  - el registro del comprobante en Supabase;
  - el PDF privado guardado en `invoice-documents`;
  - la notificación de factura del cliente cuando ya no queda ningún otro
    comprobante del pedido.
- El estado fiscal del pedido se recalcula. Si ya no quedan comprobantes, queda
  como **Compra cancelada**.
- Una compra cancelada puede quitarse del panel de Facturación aunque ya no
  tenga comprobantes.
- Un cliente o visitante nunca puede ejecutar esta eliminación: la función
  vuelve a validar en el servidor que la cuenta sea administradora y que el
  pedido esté cancelado.

## Importante sobre ARCA

Eliminar el registro de la web no anula una factura que ya tenga CAE. Si el
comprobante fue emitido en ARCA, primero corresponde emitir la nota de crédito
que indique el contador. Esta acción sirve para limpiar un comprobante cargado
por error en la página, no para modificar los registros fiscales de ARCA.

## Aplicar la actualización

Reemplazá los archivos de la v27 y, desde la raíz del proyecto, ejecutá:

```powershell
npm install
npx supabase login
npx supabase link --project-ref dvisdjvzwbfklrpzsuhe
npx supabase functions deploy delete-invoice-voucher --project-ref dvisdjvzwbfklrpzsuhe --no-verify-jwt
npm test
```

Después subí los cambios a GitHub:

```powershell
git add app.js index.html styles.css LAUNCH.md ACTUALIZACION-V27-ELIMINAR-COMPROBANTES.md tests/runtime-qa.mjs supabase/config.toml supabase/functions/delete-invoice-voucher/index.ts
git commit -m "Permite eliminar comprobantes de compras canceladas"
git pull --rebase origin main
git push origin HEAD:main
```

## Prueba rápida

1. En **Pedidos**, marcá una compra de prueba como **Cancelada**.
2. Entrá en **Facturación**.
3. En el comprobante de esa compra aparecerá **Eliminar comprobante**.
4. Confirmá la acción.
5. Verificá que el comprobante ya no aparezca en Facturación ni en **Mis
   compras** del cliente.
6. Si querés sacar también la compra cancelada de la lista fiscal, pulsá
   **Quitar del panel**.

