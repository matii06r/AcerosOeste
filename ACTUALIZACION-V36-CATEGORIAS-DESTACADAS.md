# Actualización v36 — categorías destacadas

Esta versión simplifica la sección **Nuestras líneas** de la página principal.

## Cambios

- El inicio muestra como máximo cinco categorías.
- Se respetan las primeras cinco categorías según el orden configurado en el panel.
- Cada categoría utiliza automáticamente la primera foto disponible de uno de sus productos publicados.
- Una capa oscura mantiene el nombre y el acceso al catálogo siempre legibles.
- Si una categoría todavía no tiene fotografías, se utiliza un fondo de marca en lugar de mostrar una imagen rota.
- Al pulsar una categoría se abre el catálogo completo con ese filtro seleccionado.
- El enlace **Ver catálogo completo** continúa mostrando todas las categorías y todos los productos.
- El diseño responde en cinco, tres, dos o una columna según el tamaño de pantalla.

## Publicación

No requiere migraciones ni despliegues de Edge Functions.

```bash
npm test
git add app.js index.html styles.css tests/runtime-qa.mjs ACTUALIZACION-V36-CATEGORIAS-DESTACADAS.md
git commit -m "Mejora categorias destacadas del inicio"
git pull --rebase origin main
git push origin HEAD:main
```

Después del despliegue, realizar una recarga completa con `Ctrl + F5`.
