# CornerMaximo Premium: configuración de Stripe

CornerMaximo cobra una única suscripción mensual de **4,99 €**, sin prueba gratuita. El pago se abre en Stripe Checkout, el cliente gestiona su suscripción en Customer Portal y los webhooks actualizan el acceso Premium en Supabase.

## Objetos creados en el sandbox

- Producto: `prod_V8J5THHIafKqpD` (`CornerMaximo Premium`)
- Precio: `price_1U82Tk3DaGpsoeUF4r58dsjL`
- Importe: 499 céntimos EUR al mes, impuestos incluidos
- Lookup key: `cornermaximo_premium_monthly_eur`
- Código fiscal: `txcd_10701401` (servicio de información web para uso personal)

Estos identificadores son únicamente de prueba. No se ha creado ni activado ningún objeto en modo real.

## Variables de entorno

Configura valores diferentes para Preview y Production. Las claves y el secreto del webhook deben guardarse como variables sensibles, nunca en Git ni con prefijo `NEXT_PUBLIC_`.

```dotenv
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PREMIUM_MONTHLY_PRICE_ID=
STRIPE_MANAGED_PAYMENTS_ENABLED=false
PREMIUM_MONTHLY_DISPLAY_PRICE="4,99 €/mes"
SUPABASE_SERVICE_ROLE_KEY=
```

Para Preview usa el precio del sandbox indicado arriba. Activa `STRIPE_MANAGED_PAYMENTS_ENABLED=true` solo después de habilitar Managed Payments en el Dashboard para ese entorno.

## Configuración del Dashboard

1. Activa Managed Payments y completa la información comercial solicitada por Stripe.
2. En Customer Portal, permite cancelar la suscripción y actualizar el método de pago. Muestra únicamente el producto Premium.
3. Configura Smart Retries y los correos de pago fallido/renovación según la política comercial.
4. Crea un endpoint webhook apuntando a `https://<dominio>/api/billing/webhook`.
5. Suscribe el endpoint a estos eventos:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

El endpoint verifica la firma oficial de Stripe sobre el cuerpo sin modificar. Después valida que el precio recibido sea exactamente el configurado antes de conceder acceso. Supabase registra el `event.id` y descarta eventos duplicados o más antiguos de forma transaccional.

## Prueba completa en sandbox

1. Despliega la rama con variables de Preview y el webhook de prueba.
2. Inicia sesión con un usuario sin Premium y abre `/pro`.
3. Pulsa **Continuar al pago seguro** y usa una tarjeta de prueba de Stripe, por ejemplo `4242 4242 4242 4242`, una fecha futura y cualquier CVC.
4. Confirma que el retorno muestra el pago completado y que Premium se activa tras procesar el webhook.
5. Abre **Gestionar suscripción**, cancela al final del periodo y comprueba que el acceso sigue activo hasta la fecha indicada.
6. Reenvía un mismo evento desde Stripe y verifica que no duplica ni degrada el estado.

## Paso a producción

1. Crea en modo real un producto separado con un precio recurrente de 499 céntimos EUR al mes, impuestos incluidos, y el mismo código fiscal.
2. Crea el webhook real y guarda su nuevo secreto en Production.
3. Usa una restricted API key con los permisos mínimos para crear sesiones de Checkout y Customer Portal y consultar suscripciones. No reutilices credenciales del sandbox.
4. Configura el ID del precio real en `STRIPE_PREMIUM_MONTHLY_PRICE_ID`.
5. Realiza una compra real de importe controlado y prueba renovación, pago fallido y cancelación antes de anunciar el plan.

Managed Payments actúa como merchant of record para las transacciones y jurisdicciones cubiertas por Stripe. Verifica en el Dashboard la cobertura aplicable antes del lanzamiento: los países o impuestos no cubiertos siguen siendo responsabilidad de CornerMaximo. No actives `automatic_tax` por separado salvo que exista una estrategia fiscal y los registros necesarios; valida la configuración final con un asesor fiscal.
