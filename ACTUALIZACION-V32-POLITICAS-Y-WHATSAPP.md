# Actualización v32 — Políticas y WhatsApp

## Cambios incluidos

- Se eliminó de la página de Políticas el bloque **Comprobantes e IVA**.
- Se quitaron de esa página las menciones residuales a impuestos y comprobantes.
- El resumen de términos del checkout ya no enumera los comprobantes.
- La facturación interna, los datos fiscales opcionales y los comprobantes ya emitidos siguen funcionando; sólo se simplificó el texto público solicitado.
- La versión de términos cambió a `2026-08-31-v2` y el backend acepta temporalmente v1 y v2 para evitar bloquear pagos durante el despliegue.
- Todos los enlaces públicos de WhatsApp continúan abriendo el número principal `11 6178 1074` (`5491161781074`).

## Foto de perfil de WhatsApp

La web no puede elegir ni enviar una foto de perfil mediante un enlace `wa.me`. WhatsApp muestra la foto configurada en la cuenta del número de destino, siempre que sus ajustes de privacidad permitan verla.

En el teléfono que administra el `11 6178 1074`:

1. Abrí WhatsApp o WhatsApp Business.
2. Configurá la foto o el logo de Aceros Oeste como foto de perfil.
3. Entrá en **Ajustes → Privacidad → Foto del perfil**.
4. Seleccioná **Todos** si querés que también la vean clientes que todavía no están guardados como contactos.

WhatsApp Business no es obligatorio para mostrar una foto, pero es recomendable para completar nombre comercial, categoría, descripción, dirección y horario.

## Publicación

Reemplazá los archivos del parche y ejecutá:

```bash
npx supabase functions deploy mp-create-preference --project-ref dvisdjvzwbfklrpzsuhe --no-verify-jwt
npm test

git add app.js index.html ACTUALIZACION-V32-POLITICAS-Y-WHATSAPP.md tests/runtime-qa.mjs supabase/functions/mp-create-preference/index.ts
git commit -m "Simplifica politicas y actualiza terminos"
git pull --rebase origin main
git push origin HEAD:main
```

No hay una migración nueva de base de datos en esta versión.
