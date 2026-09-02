# Actualización v33 — Multimedia y ficha de producto

## Qué cambia

- El editor acumula fotos aunque abras el selector varias veces.
- Se pueden publicar hasta 10 fotos por producto.
- Se pueden agregar varios videos sin un límite de cantidad impuesto por la interfaz.
- Cada foto admite hasta 5 MB.
- Cada video admite hasta 50 MB en MP4, WebM o MOV.
- Antes de publicar se muestran todas las miniaturas, sus nombres y un botón para quitar cada archivo nuevo.
- También podés quitar medios ya publicados al modificar el producto.
- Si una subida falla, se limpian los archivos parciales de ese intento.
- El botón de publicación muestra el progreso de subida archivo por archivo.
- La primera foto queda como portada. Si la galería comienza con un video, el catálogo busca automáticamente la primera foto disponible.
- Las tarjetas del catálogo son más compactas y muestran la imagen completa, sin recortarla.
- La galería principal es más contenida y las miniaturas se desplazan horizontalmente cuando hay muchas.
- Los videos de las miniaturas no se precargan, para evitar una página pesada.
- La descripción larga aparece debajo del bloque de compra y antes de las preguntas.
- El formato `**texto**` se muestra en negrita, sin enseñar los asteriscos al cliente.
- Se eliminó de la vista pública la fecha de versión de los términos; la versión interna continúa registrándose.

## Cómo usar la carga

En `Panel general → Crear producto → Fotos y publicación`:

1. Tocá **Seleccionar fotos** y elegí varias juntas, o abrí el selector varias veces.
2. Repetí lo mismo con **Seleccionar videos**.
3. Revisá el contador y las miniaturas.
4. Usá **Quitar** si seleccionaste un archivo equivocado.
5. Publicá y esperá a que termine el contador de subida.

## Aplicación

Después de copiar el parche sobre el proyecto:

```bash
npx supabase db push
npm test

git add app.js index.html styles.css tests/runtime-qa.mjs supabase/migrations/021_product_multi_media.sql ACTUALIZACION-V33-MULTIMEDIA-Y-FICHA.md
git commit -m "Mejora multimedia y ficha de productos"
git pull --rebase origin main
git push origin HEAD:main
```

No es necesario desplegar Edge Functions para esta actualización.
