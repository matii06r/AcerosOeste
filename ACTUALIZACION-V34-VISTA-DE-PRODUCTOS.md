# Actualización v34 — vista de productos

Esta versión corrige la regresión visual de la v33 sin cambiar la base de datos ni el circuito de compra.

## Cambios

- Las fotos del catálogo se muestran completas con su proporción natural.
- Se eliminó el relleno claro que generaba barras alrededor de las imágenes.
- Las tarjetas recuperaron un ancho cómodo y uniforme.
- Los botones de compra y administración se alinean en dos columnas y no parten sus textos.
- La imagen grande de la ficha se adapta a la proporción real de cada foto.
- Al seleccionar un video, el visor cambia automáticamente a formato panorámico.
- Se mantienen la carga acumulativa de hasta 10 fotos y los múltiples videos de la v33.

## Publicación

No hace falta ejecutar migraciones ni volver a desplegar Edge Functions para este ajuste visual.

```bash
npm test
git add app.js index.html styles.css tests/runtime-qa.mjs ACTUALIZACION-V34-VISTA-DE-PRODUCTOS.md
git commit -m "Corrige vista y botones de productos"
git pull --rebase origin main
git push origin HEAD:main
```

Después del despliegue, realizar una recarga completa del navegador con `Ctrl + F5`.
