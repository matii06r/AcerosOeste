# Actualización v28: archivar facturación y sugerencias más visibles

## Qué corrige

- Todos los registros de **Panel general → Facturación** muestran ahora
  **Quitar del panel**, incluso si todavía están pendientes.
- Un pedido que el cliente quitó de **Mis compras** puede archivarse igualmente
  en Facturación.
- Al archivar un registro pendiente, la confirmación aclara que:
  - no se genera una factura;
  - no se marca el pedido como facturado;
  - no se eliminan el pedido ni sus datos.
- Después de confirmar, la lista y el contador de pendientes se actualizan.
- El botón flotante **Sugerencias** es más grande y fácil de encontrar tanto en
  computadora como en celular.

## Por qué el pedido seguía apareciendo

La opción **Quitar de mi cuenta** sólo oculta una compra en el historial del
cliente. El registro administrativo se conserva correctamente para mantener la
trazabilidad. La v28 permite que administración decida también quitarlo de la
lista visible de Facturación mediante `billing_archived_at`.

## Aplicar la actualización

Esta versión no agrega migraciones ni funciones nuevas. Reemplazá los archivos
del parche y ejecutá:

```powershell
npm test

git add app.js index.html styles.css LAUNCH.md ACTUALIZACION-V28-ARCHIVO-Y-SUGERENCIAS.md tests/runtime-qa.mjs
git commit -m "Corrige archivo de facturación y agranda sugerencias"
git pull --rebase origin main
git push origin HEAD:main
```

Vercel publicará el cambio automáticamente. Después hacé una recarga completa
con `Ctrl + F5`.

## Prueba rápida

1. Entrá en **Panel general → Facturación**.
2. Buscá un registro pendiente como el de la captura.
3. Pulsá **Quitar del panel** y confirmá.
4. Verificá que desaparezca y que se actualice el contador de pendientes.
5. Volvé al inicio y comprobá el nuevo tamaño del botón **Sugerencias**.

