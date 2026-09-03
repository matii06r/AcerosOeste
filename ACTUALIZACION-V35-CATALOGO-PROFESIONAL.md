# Actualización v35 — catálogo profesional

Esta versión reorganiza la presentación pública del catálogo sin modificar pagos, pedidos, correos ni la base de datos.

## Cambios visibles

- La barra horizontal nativa de categorías dejó de mostrarse.
- Las categorías se recorren con flechas laterales centradas y adaptadas al diseño oscuro del sitio.
- La portada muestra como máximo 20 productos destacados, tomando primero los productos más recientes del orden actual.
- El botón **Ver todos los productos** abre una página independiente con el catálogo completo.
- El catálogo completo carga 24 productos por bloque y puede manejar inventarios de cientos de publicaciones sin dibujarlas todas al mismo tiempo.
- El buscador y las categorías funcionan tanto en la portada como en el catálogo completo.
- Las tarjetas utilizan una zona de imagen cuadrada y uniforme.
- La foto principal se muestra completa; el espacio sobrante se integra con un fondo suave derivado de la misma imagen.
- Los títulos se limitan visualmente a dos líneas y los precios y botones permanecen alineados.
- Las secciones y productos aparecen con un desvanecimiento suave de aproximadamente un segundo al entrar en pantalla.
- Si el dispositivo solicita movimiento reducido, las animaciones se desactivan automáticamente.

## Publicación

No hace falta ejecutar migraciones ni desplegar Edge Functions.

```bash
npm test
git add app.js index.html styles.css tests/runtime-qa.mjs ACTUALIZACION-V35-CATALOGO-PROFESIONAL.md
git commit -m "Mejora categorias y catalogo de productos"
git pull --rebase origin main
git push origin HEAD:main
```

Después del despliegue, realizar una recarga completa con `Ctrl + F5`.
