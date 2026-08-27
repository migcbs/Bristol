# Bristol — Spec 2f: Mercadotecnia

## Contexto

De los módulos administrativos originalmente pedidos (cobranzas, mercadotecnia, admisiones, reinscripciones, comunicaciones, gestión escolar), **Admisiones** ya cubre la captura de leads (formulario de landing → `Lead` con `status` NEW/CONTACTED/ENROLLED/LOST) y **Comunicaciones** ya cubre el envío de mensajes. Lo que falta específicamente de "Mercadotecnia" es la parte analítica: de dónde vienen los leads y qué tan bien se están convirtiendo — información que hoy existe implícitamente en la tabla `Lead` pero no se presenta en ningún lugar del panel.

## Objetivo

Que Staff/Admin puedan ver, para su alcance de plantel, cuántos leads entraron por cada canal de origen y en qué proporción se convirtieron en inscripción (embudo NEW → CONTACTED → ENROLLED, con LOST aparte), sin necesitar ninguna integración externa.

## Decisión de alcance (documentada, sin bloquear en el usuario)

- **Sin integración con plataformas de anuncios (Meta Ads, Google Ads, etc.).** Igual que WhatsApp Business API en Comunicaciones: requiere credenciales de cuentas publicitarias reales que este proyecto no tiene. En su lugar, se agrega un campo `source` de selección simple (enum fijo, no UTM completo) que el propio visitante elige al llenar el formulario de contacto — suficiente para saber "cuántos leads vinieron por redes sociales vs. referidos vs. web" sin necesitar ninguna API externa.
- **Sin gráficas de series de tiempo en esta versión.** Un desglose de conteos (por estatus, por origen, por plantel) ya responde la pregunta central ("¿de dónde vienen y cuántos se convierten?"); una vista de tendencia mensual es una extensión natural pero no bloquea el valor de esta primera versión.
- **El enum de `source` es fijo, no texto libre**, para que los conteos agregados signifiquen algo — un campo de texto libre ("instagram", "Instagram", "IG"...) fragmentaría las estadísticas sin aportar nada que el enum no cubra ya.

## Modelo de datos

```prisma
enum LeadSource {
  WEB
  REDES_SOCIALES
  REFERIDO
  VISITA_PRESENCIAL
  OTRO
}
```

Se agrega un campo a `Lead`, ya existente:
```prisma
model Lead {
  // ... campos existentes sin cambio ...
  source LeadSource @default(OTRO)
}
```
`@default(OTRO)` evita romper cualquier fila existente o cualquier llamada a `POST /api/leads` que no envíe `source` (compatibilidad hacia atrás con el formulario de landing actual, que se actualiza en esta misma spec para sí enviarlo, pero un cliente externo que integre contra esa API sin actualizarse no debe fallar).

## Alcance y scoping

Reutiliza exactamente el `getCampusScope`/`leadScopeWhere` ya existentes en `src/lib/campus-scope.ts` (los mismos que ya usa `/admin/admisiones`) — Staff ve su(s) plantel(es), Admin ve todo. No se introduce ningún concepto de scoping nuevo.

## Endpoints y cambios

- **`POST /api/leads`** (ya existe, `src/app/api/leads/route.ts`): acepta un campo opcional `source`; si se provee, debe ser uno de los valores válidos del enum (400 si no); si se omite, usa el default `OTRO` de Prisma.
- **`GET /api/admin/marketing/summary`** — NUEVO. Devuelve, para el alcance de plantel del usuario (mismo `leadScopeWhere`):
  - Conteo de leads por `status` (`{ NEW, CONTACTED, ENROLLED, LOST }`).
  - Conteo de leads por `source`.
  - Tasa de conversión: `ENROLLED / total` (excluyendo o no `LOST` del denominador es una decisión de presentación, no de datos — se devuelven los conteos crudos y el cálculo se hace en la UI para mantener el endpoint simple).
  - Solo ADMIN/STAFF pueden llamarlo (403 para otros roles), mismo patrón que `/admin/admisiones`.

## UI

- **Formulario de contacto de la landing** (`src/components/landing/lead-form.tsx`): se agrega un `<select>` "¿Cómo te enteraste de nosotros?" con las opciones del enum (etiquetas en español: Sitio web, Redes sociales, Referido, Visita presencial, Otro), enviado como `source` en el POST existente. Campo opcional para el usuario (con "Otro" como default visual, coincidiendo con el default de la base de datos).
- **`/admin/mercadotecnia`** (STAFF, ADMIN): dos tablas simples de conteo (por estatus, por origen) más una tarjeta con la tasa de conversión calculada en el cliente a partir de los conteos ya recibidos. Mismo alcance de plantel que Admisiones.
- Entrada "Mercadotecnia" añadida a `AdminNav`.

## Testing

- `POST /api/leads`: 400 si `source` no es uno de los valores válidos del enum; 201 con `source: "OTRO"` cuando se omite; 201 con el valor correcto cuando se provee.
- `GET /api/admin/marketing/summary`: 401 sin sesión, 403 para roles no ADMIN/STAFF, conteos correctos por `status` y por `source` respetando el alcance de plantel (ADMIN ve todos los planteles, STAFF solo el suyo — mismo caso de prueba que ya existe para `leadScopeWhere` en Admisiones, aplicado aquí).

## Riesgos / decisiones abiertas

- Al no integrar con plataformas de anuncios reales, la precisión de `source` depende de que el visitante lo seleccione correctamente en el formulario — es una autodeclaración, no un dato verificado por UTM/referrer. Aceptable para esta primera versión; agregar captura automática de UTM params es una extensión futura directa sobre el mismo campo `source` (o uno adicional `utmSource` de texto libre para no bloquear el enum agregado).
