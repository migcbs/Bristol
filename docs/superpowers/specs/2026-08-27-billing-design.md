# Bristol — Spec 2b: Cobranzas

## Contexto

Spec 0 (Fundación), Spec 1 (Landing), y Spec 2a (Admisiones) están completas y mergeadas. Este documento cubre **Cobranzas**: generación de cargos (colegiaturas) a alumnos, pago en línea real vía Stripe, y las vistas mínimas para que Staff/Admin gestionen cobros y para que Alumno/Padre paguen — el resto del portal académico (horarios, material, calificaciones) es Spec 3.

## Objetivo

Que Staff/Admin puedan generar cargos para un alumno, que el sistema muestre su estatus (pendiente, pagado, vencido), y que el alumno o su padre puedan pagarlo en línea con tarjeta desde su portal, sin intervención manual del staff para confirmar el pago.

## Fuera de alcance

- Recordatorios automáticos de pago por correo/WhatsApp — Comunicaciones, sub-spec posterior.
- Reportes financieros/dashboards de ingresos — iteración futura.
- Pagos parciales, planes de pago a plazos, o reembolsos — YAGNI para esta primera versión; un cargo se paga completo o no se paga.
- Métodos de pago fuera de Stripe (SPEI directo, efectivo) — el registro manual de un pago en efectivo por el staff queda fuera de esta versión; todo cargo se paga por Stripe Checkout.
- El resto del portal de alumno/padre (horarios, material, calificaciones) — Spec 3.

## Modelo de datos

```prisma
enum InvoiceStatus {
  PENDING
  PAID
  OVERDUE
  CANCELED
}

model Invoice {
  id                     String        @id @default(cuid())
  studentId              String
  description            String
  amountCents            Int
  dueDate                DateTime
  status                 InvoiceStatus @default(PENDING)
  stripeCheckoutSessionId String?
  paidAt                 DateTime?
  createdAt              DateTime      @default(now())

  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
}
```

`amountCents` en centavos (evita errores de punto flotante con dinero). `stripeCheckoutSessionId` se guarda al iniciar el checkout para poder correlacionar el webhook de confirmación. Se agrega `invoices Invoice[]` como relación inversa en el modelo `Student` existente.

## Alcance y scoping

- **ADMIN**: crea/ve cargos de cualquier alumno.
- **STAFF**: crea/ve cargos solo de alumnos cuyo `campusId` esté en su alcance (reutiliza `getCampusScope`, igual patrón que Admisiones — un alumno siempre tiene un `campusId` fijo, a diferencia de un lead, así que aquí no hay caso "sin asignar").
- **STUDENT**: ve y paga únicamente sus propios cargos.
- **PARENT**: ve y paga los cargos de sus alumnos vinculados (`ParentStudent`, ya existente en Fundación).

## Integración con Stripe

- `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` como nuevas variables de entorno (se agregan a `.env.example` con placeholders; el usuario las reemplaza con sus llaves de prueba reales cuando esté listo para probar el flujo de pago end-to-end — sin ellas, todo lo demás del módulo sigue siendo funcional/testeable, solo el checkout real requiere las llaves).
- **Iniciar pago**: `POST /api/invoices/[id]/checkout` — crea una Stripe Checkout Session (`mode: "payment"`) por el monto del cargo, guarda el `sessionId` en el `Invoice`, y devuelve la URL de checkout para redirigir al usuario.
- **Confirmar pago**: `POST /api/webhooks/stripe` — recibe el evento `checkout.session.completed` de Stripe, verifica la firma con `STRIPE_WEBHOOK_SECRET`, y marca el `Invoice` correspondiente como `PAID` con `paidAt = now()`.
- No se hace polling ni verificación manual del estatus de pago — el webhook es la única fuente de verdad para marcar un cargo como pagado.

## Endpoints

- **`POST /api/admin/invoices`** — crea un cargo. Body: `{ studentId, description, amountCents, dueDate }`. Verifica que el `studentId` esté dentro del scope del creador (mismo patrón 404-si-fuera-de-scope que Admisiones). 400 si `amountCents <= 0` o campos faltantes.
- **`GET /api/admin/invoices`** — lista cargos visibles para ADMIN/STAFF, más recientes primero, con filtro opcional `?status=`.
- **`GET /api/portal/invoices`** — lista los cargos del STUDENT autenticado, o de todos sus hijos vinculados si es PARENT (agrupados por alumno si hay más de uno).
- **`POST /api/invoices/[id]/checkout`** — inicia el pago. Verifica que el invoice pertenezca al STUDENT autenticado o a uno de los hijos del PARENT autenticado (404 si no). 400 si el invoice ya está `PAID` o `CANCELED`.
- **`POST /api/webhooks/stripe`** — sin autenticación de sesión (Stripe no manda cookies); se autentica exclusivamente verificando la firma del webhook.

## UI

- **`/admin/cobranzas`** (Server Component, patrón igual a Admisiones): tabla de cargos con alumno, descripción, monto, vencimiento, estatus; formulario simple para crear un nuevo cargo (selecciona alumno del scope del usuario, descripción, monto, fecha).
- **`/portal/cobranzas`** (Server Component): lista de cargos del alumno (o de cada hijo si es padre), con botón "Pagar" en los pendientes que llama a `POST /api/invoices/[id]/checkout` y redirige a Stripe. Se agrega como enlace en el shell de `/portal` (Fundación) — mismo patrón que `AdminNav` de Admisiones, se crea un `PortalNav` mínimo equivalente.
- Página de retorno tras el pago: Stripe redirige de vuelta a `/portal/cobranzas?paid=1` (parámetro simple, no requiere una página dedicada) donde se muestra un mensaje de confirmación si el parámetro está presente — el estatus real ya lo actualizó el webhook, este mensaje es solo cortesía visual inmediata.

## Testing

- `POST /api/admin/invoices`: crea cargo válido (201), rechaza monto ≤0 (400), rechaza alumno fuera de scope (404).
- `GET /api/admin/invoices` y `GET /api/portal/invoices`: scoping correcto por rol (ADMIN todos, STAFF su campus, STUDENT los suyos, PARENT los de sus hijos).
- `POST /api/invoices/[id]/checkout`: 404 si el invoice no pertenece al usuario/sus hijos, 400 si ya está pagado, éxito llama al SDK de Stripe con los parámetros correctos (mockeado) y guarda el `stripeCheckoutSessionId`.
- `POST /api/webhooks/stripe`: firma inválida → 400 sin tocar la base de datos; evento válido `checkout.session.completed` → marca el invoice como `PAID`.

## Riesgos / decisiones abiertas

- **Llaves de Stripe reales**: se usan placeholders en `.env.example` hasta que el usuario las proporcione; el flujo de checkout/webhook se implementa y prueba con el SDK de Stripe mockeado en los tests, y se verifica manualmente en modo real solo cuando las llaves estén disponibles.
- **Un alumno con más de un hijo por padre**: la vista de portal agrupa por alumno; si en el futuro se necesita una vista consolidada de "total a pagar por familia", es una extensión aditiva, no un cambio estructural.
