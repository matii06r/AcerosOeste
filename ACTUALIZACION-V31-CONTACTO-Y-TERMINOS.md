# Aceros Oeste v31 — contacto, términos y precios

## Cambios incluidos

- Teléfonos públicos: `11 6178 1074 / 11 6659 8695`.
- WhatsApp principal: `+54 9 11 6178 1074`.
- La migración reemplaza el número anterior en la configuración existente.
- El checkout exige aceptar los términos antes de crear el pedido.
- Cada pedido guarda fecha y versión de los términos aceptados.
- Los términos detallan precio final, seña, materiales, mano de obra,
  modificaciones, comprobantes, entrega y arrepentimiento.
- El comprobante con CUIT o razón social no cambia el precio de la compra.
- Mercado Pago regresa a `#inicio` con el estado del pago.
- La calculadora explica IVA, costo de cobro, margen y redondeo.

## Criterio fiscal aplicado

El precio publicado continúa siendo el precio final al consumidor. El IVA que
corresponda se incorpora al precio antes de publicar; no se agrega solamente a
quien solicita factura. Todas las ventas deben quedar respaldadas por el
comprobante que corresponda, y los datos fiscales del comprador determinan la
clase y el destinatario del comprobante, no un recargo posterior.

La alícuota y el tipo de comprobante deben ser confirmados con el contador según
la condición fiscal real de Aceros Oeste.

## Cómo funciona la calculadora

```text
precio sugerido =
  base × (1 + margen) × (1 + IVA) ÷ (1 - costo de cobro)
```

Después redondea hacia arriba según la unidad configurada.

- **Base:** costo o valor neto desde el cual querés calcular.
- **Margen:** ganancia o colchón adicional sobre la base.
- **IVA:** impuesto incorporado en el precio final, cuando corresponda.
- **Costo de cobro:** porcentaje real descontado por Mercado Pago.
- **Precio final:** único importe publicado y cobrado al cliente.

El precio final se actualiza automáticamente al cambiar cualquiera de los
componentes, aunque también puede corregirse manualmente antes de publicar.

## Mercado Pago

La web controla la URL de destino y ahora regresa al inicio. El texto externo
`Volver a Matías Paiva` utiliza el nombre público de la cuenta vendedora de
Mercado Pago. Para que muestre la marca, hay que cambiar ese nombre comercial
en el perfil de la cuenta a `Aceros Oeste`; la API no permite definir el texto
del botón para cada pago.

## Aplicación

```bash
npx supabase db push
npx supabase functions deploy mp-create-preference --project-ref dvisdjvzwbfklrpzsuhe --no-verify-jwt
npx supabase functions deploy mp-webhook --project-ref dvisdjvzwbfklrpzsuhe --no-verify-jwt
npx supabase functions deploy send-order-email --project-ref dvisdjvzwbfklrpzsuhe --no-verify-jwt
npm test
```

`mp-webhook` y `send-order-email` deben redesplegarse porque el correo de compra
ahora utiliza el nuevo WhatsApp.
