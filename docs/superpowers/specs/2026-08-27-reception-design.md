# Bristol — Spec 4: Recepción

## Contexto

Este documento incorpora el organigrama real de Bristol Inglés Profesional (`DIAGRAMA DE PUESTOS Y FORMATOS.docx`, planteles **Coatepec** y **Xalapa**) y la especificación de módulos/campos que el usuario proporcionó, para diseñar el área de **Recepción** como puente operativo entre el visitante/alumno y el resto de la organización (Caja, Control Escolar, Área Comercial, Calidad y Control).

A diferencia de las specs anteriores, esta reorganiza y extiende varios modelos ya construidos y mergeados (`Student`, `Lead`, `Invoice`, `Group`) en vez de partir de cero. Las decisiones de arquitectura de esta sección fueron confirmadas explícitamente por el usuario antes de escribir esta spec.

## Decisiones de arquitectura (confirmadas con el usuario)

1. **Planteles reales.** Los dos `Campus` ya sembrados ("Bristol Norte"/"Bristol Sur") se renombran a **Coatepec** y **Xalapa**, y las cuentas de staff de prueba se renombran acorde (`staff.coatepec@`/`staff.xalapa@`). Es un cambio de datos (seed), no de esquema.

2. **`Lead` es el mismo "Prospecto"; no se duplica la entidad.** El campo `estatus_alumno: 'Prospecto' | 'En Espera'` del formulario de alumno, y todo el "Módulo de Área Comercial" con su `id_prospecto`, en realidad describen el mismo ciclo de vida que ya modela `Lead`/`LeadStatus`/`LeadSource` (mergeado en Spec 2f). En vez de crear una tabla `Prospecto` paralela:
   - `Lead` se extiende con `asesorAsignadoId` (FK opcional a `User`, para Nora/Alejandra/Diana) y una etapa adicional de estatus (`PLACEMENT_SCHEDULED`, entre `CONTACTED` y `ENROLLED`) que representa "Examen Agendado".
   - `LeadSource` se extiende con `PRESENCIAL_RECEPCION` y `VOLANTEO` (los valores de Comercial que no existían).
   - **"En Espera" (lista de espera) es un `Lead` con una etapa de estatus dedicada, no un modelo nuevo.** Se añaden a `Lead`: `tipoInteres` (CURSO_REGULAR/TALLER_CONVERSACION/CERTIFICACION), `notasBitacora` (texto libre), y una relación opcional a `PlacementAppointment` (ver más abajo). El "pipeline visual" de la lista de espera es una vista sobre `Lead` filtrada por plantel y estatus, con arrastrar-y-soltar entre estatus.
   - Solo cuando un `Lead` pasa a `ENROLLED` se crea el `User`+`Student` real (flujo que ya existe: alta de alumno). Antes de eso, un prospecto nunca necesita cuenta de portal ni contraseña — coherente con que Recepción debe operar rápido sin fricción de crear logins para cada visitante.

3. **Calificaciones por bloque son un modelo nuevo, separado de `Grade`.** `Grade` (Spec 3a, libre: título + puntaje) sigue existiendo para evaluaciones sueltas. Se añade `BlockEvaluation`, atado a `Enrollment` igual que `Grade`, con las 5 notas fijas (Listening/Speaking/Reading/Writing/Grammar) y el promedio calculado al momento de guardar — este es el formato real de evaluación de bloque de Control Escolar, y su forma de datos es incompatible con el modelo libre existente.

4. **Sin timbrado fiscal real.** Los campos de facturación (RFC, razón social, régimen fiscal, código postal, uso CFDI) se capturan y muestran en el perfil del alumno, pero no se genera ningún CFDI válido ante el SAT — requeriría un PAC (proveedor autorizado de certificación) con credenciales que este proyecto no tiene, mismo criterio que WhatsApp Business API en Comunicaciones.

5. **"Orden de pago" es el `Invoice` existente, extendido — no un modelo paralelo.** `Invoice` ya modela exactamente "concepto + monto + fecha de vencimiento + estatus" (Spec 2b, Cobranzas). Se le añaden campos opcionales para el rastro de auditoría que pide Recepción (precio de lista vs. precio final tras beca/descuento) sin tocar nada de lo que Cobranzas/Stripe ya usa.

6. **Recepción, Caja y Control Escolar no son roles nuevos — son plantillas de UI sobre `STAFF`.** El proyecto ya trata a Cobranzas/Admisiones/Reinscripciones/Incidencias/Comunicaciones/Mercadotecnia como páginas `/admin/*` visibles para `STAFF`/`ADMIN`, con alcance de plantel vía `getCampusScope`. Recepción sigue el mismo patrón: no se introduce un rol `RECEPCION` separado en el enum `Role`. Si más adelante se necesita restringir qué páginas ve cada puesto específico (Recepción vs. Caja vs. Control Escolar) dentro de `STAFF`, es una capa de permisos futura sobre esta base — hoy todo `STAFF` ve todo el panel administrativo, igual que en el resto del proyecto.

## Alcance general

Debido al tamaño de esta spec (reorganiza 4 modelos existentes y agrega 5 nuevos), la implementación se divide en tres planes ejecutados en secuencia, cada uno con su propio spec de tareas, revisión y merge — mismo patrón usado en Spec 2:

- **4a — Registro y Operación Diaria** (Módulo 1): datos base (`Student` extendido, `Lead` extendido, `PlacementAppointment`), búsqueda global, alta rápida, pipeline de lista de espera, agenda de asesorías, bitácora y reporte mensual.
- **4b — Finanzas y Escolar** (Módulos 2 y 3): `Invoice` extendido + botón "Enviar a Caja" + badge de estatus financiero; `Group.cupoMaximo` + matriz de disponibilidad; `BlockEvaluation`; flujo de solicitud de baja/cambio de grupo.
- **4c — Comercial y Comunicación Interna** (Módulo 4 + resto de Comercial): `Lead` extendido con asesor asignado y nuevos estatus/orígenes; `InterAreaTicket` (bandeja de pendientes); `Notification` (central de notificaciones).

Cada sub-spec tiene su propio documento de tareas (`docs/superpowers/plans/2026-08-27-reception-*.md`) para no producir un solo plan de 30+ tareas.

---

## 4a — Registro y Operación Diaria

### Modelo de datos

```prisma
enum LeadSource {
  WEB
  REDES_SOCIALES
  REFERIDO
  VISITA_PRESENCIAL
  OTRO
  PRESENCIAL_RECEPCION
  VOLANTEO
}

enum LeadStatus {
  NEW
  CONTACTED
  PLACEMENT_SCHEDULED
  ENROLLED
  LOST
}

enum InterestType {
  CURSO_REGULAR
  TALLER_CONVERSACION
  CERTIFICACION
}

enum AgeBracket {
  NINO
  ADOLESCENTE
  ADULTO
}

model Lead {
  // ... campos existentes (name, email, phone, message, campusId, status, source, createdAt) ...
  dateOfBirth       DateTime?
  interestType      InterestType?
  notasBitacora     String?
  asesorAsignadoId  String?
  asesorAsignado    User?     @relation("LeadAdvisor", fields: [asesorAsignadoId], references: [id])
  placementAppointment PlacementAppointment?
}

model PlacementAppointment {
  id        String   @id @default(cuid())
  leadId    String   @unique
  scheduledFor DateTime
  campusId  String
  notes     String?
  createdAt DateTime @default(now())

  lead   Lead   @relation(fields: [leadId], references: [id], onDelete: Cascade)
  campus Campus @relation(fields: [campusId], references: [id])
}

model Student {
  // ... campos existentes ...
  matricula           String    @unique
  curp                String?
  fechaNacimiento      DateTime?
  entregaActa          Boolean   @default(false)
  entregaCurp          Boolean   @default(false)
  entregaComprobante   Boolean   @default(false)
  telefonoFijo         String?
  telefonoMovil        String?
  emailContacto        String?
  rfc                  String?
  razonSocial          String?
  regimenFiscal        String?
  codigoPostalFiscal   String?
  usoCfdi              String?
  estatusAlumno        StudentStatus @default(ACTIVO)
}

enum StudentStatus {
  ACTIVO
  BAJA
  GRADUADO
}

model ReceptionLogEntry {
  id        String   @id @default(cuid())
  campusId  String
  createdById String
  type      ReceptionLogType
  note      String
  createdAt DateTime @default(now())

  campus    Campus @relation(fields: [campusId], references: [id])
  createdBy User   @relation(fields: [createdById], references: [id], onDelete: Cascade)
}

enum ReceptionLogType {
  LLAMADA
  INCIDENCIA
  NOTA
}
```

`clasificacionEdad` (`AgeBracket`) **no se guarda** — se calcula en un helper compartido (`src/lib/age-bracket.ts`) a partir de `fechaNacimiento`/`dateOfBirth`, tanto para `Lead` como para `Student`, evitando que quede desactualizado si pasa el tiempo entre la captura y la consulta.

`matricula` se genera automáticamente al crear el `Student` (formato `BRI-<año>-<consecutivo con padding>`, p. ej. `BRI-2026-00001`), consecutivo por año, calculado en una transacción para evitar colisiones bajo concurrencia (mismo patrón de guardas transaccionales ya usado en Reinscripciones).

### Endpoints

- **`GET /api/admin/search?q=`** — búsqueda global (Cmd+K): devuelve coincidencias de `Student` (nombre/matrícula), `Lead` (nombre/email/teléfono), `Group` (nombre/código), escaneadas por `q` con `contains`/`startsWith` insensible a mayúsculas, limitadas a 5 resultados por tipo, respetando el alcance de plantel del usuario (`getCampusScope`).
- **`POST /api/admin/students/quick-create`** — alta rápida de alumno desde el drawer (campos mínimos: nombre, campus, nivel/grupo opcional). Genera `matricula`, crea `User`+`Student` en una transacción.
- **`GET/POST /api/admin/leads/waitlist`** — lista/crea entradas de lista de espera (un `Lead` con `status IN ('NEW','CONTACTED')` y `interestType` asignado). El "mover de columna" del pipeline es un `PATCH` al `Lead` existente cambiando `status`.
- **`GET/POST /api/admin/placement-appointments`** — agenda de asesorías/entrevistas de ubicación, con validación de traslape de horario del mismo profesor/asesor (mismo día, mismo rango de hora).
- **`GET/POST /api/admin/reception-log`** — bitácora diaria.
- **`GET /api/admin/reception-log/monthly-report`** — genera el reporte de altas (Leads → ENROLLED en el mes) y bajas (`Student.estatusAlumno` → BAJA en el mes) por plantel.

### UI

- Componente global `<CommandPalette>` (Cmd+K/Ctrl+K), montado en el layout raíz del panel admin, usa `GET /api/admin/search`.
- `<QuickCreateDrawer>`: panel lateral deslizante (no modal de pantalla completa) accesible desde cualquier página admin.
- `/admin/recepcion/lista-espera`: tablero kanban por estatus (Nuevo → Contactado → Examen Agendado → Inscrito), con conteo por columna.
- `/admin/recepcion/agenda`: calendario semanal de citas de ubicación.
- `/admin/recepcion/bitacora`: formulario de captura + lista del día + botón "Generar reporte mensual".

---

## 4b — Finanzas y Escolar

### Modelo de datos

```prisma
model Invoice {
  // ... campos existentes ...
  baseCents                 Int?
  scholarshipPercent        Decimal?  @db.Decimal(5, 2)
  earlyPaymentDiscountCents Int?
}

model Group {
  // ... campos existentes ...
  cupoMaximo Int @default(20)
}

model BlockEvaluation {
  id            String   @id @default(cuid())
  enrollmentId  String
  bloqueNumero  Int
  notaListening Decimal  @db.Decimal(4, 2)
  notaSpeaking  Decimal  @db.Decimal(4, 2)
  notaReading   Decimal  @db.Decimal(4, 2)
  notaWriting   Decimal  @db.Decimal(4, 2)
  notaGrammar   Decimal  @db.Decimal(4, 2)
  promedioBloque Decimal @db.Decimal(4, 2)
  createdById   String
  createdAt     DateTime @default(now())

  enrollment Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  createdBy  User       @relation(fields: [createdById], references: [id], onDelete: Cascade)

  @@unique([enrollmentId, bloqueNumero])
}

enum GroupChangeRequestType {
  BAJA
  CAMBIO_GRUPO
}

enum GroupChangeRequestStatus {
  PENDIENTE
  APROBADA
  RECHAZADA
}

model GroupChangeRequest {
  id               String                   @id @default(cuid())
  type             GroupChangeRequestType
  studentId        String
  currentGroupId   String
  requestedGroupId String?
  reason           String
  status           GroupChangeRequestStatus @default(PENDIENTE)
  requestedById    String
  reviewedById     String?
  reviewedAt       DateTime?
  createdAt        DateTime                 @default(now())

  student        Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  currentGroup   Group   @relation("CurrentGroup", fields: [currentGroupId], references: [id])
  requestedGroup Group?  @relation("RequestedGroup", fields: [requestedGroupId], references: [id])
  requestedBy    User    @relation("RequestedBy", fields: [requestedById], references: [id], onDelete: Cascade)
  reviewedBy     User?   @relation("ReviewedBy", fields: [reviewedById], references: [id])
}
```

`promedioBloque` se calcula en el servidor al recibir las 5 notas (`(L+S+R+W+G)/5`) y se guarda — igual que otros valores "calculados al guardar" ya usados en el proyecto (`Invoice.amountCents` tras descuento en Cobranzas).

Al aprobar un `GroupChangeRequest`: si `type = BAJA`, marca `completedAt` en la inscripción activa (misma guarda `updateMany` con conteo, para evitar condiciones de carrera, ya usada en Reinscripciones); si `type = CAMBIO_GRUPO`, reutiliza exactamente la transacción de Reinscripciones (cerrar inscripción actual + crear nueva) — no se reimplementa esa lógica.

### Endpoints

- **`POST /api/admin/invoices/from-reception`** — "Enviar a Caja": crea un `Invoice` con `baseCents`/`scholarshipPercent`/`earlyPaymentDiscountCents` y calcula `amountCents` final.
- **`GET /api/admin/students/[id]/financial-status`** — badge de estatus (Al Corriente/Pendiente de Cobro/Moroso) calculado desde los `Invoice` del alumno (Moroso = tiene un `Invoice` con `status = OVERDUE`; Pendiente = tiene `PENDING` sin vencer; Al Corriente = ninguno de los anteriores).
- **`GET /api/admin/groups/availability`** — matriz plantel × grupo con `cupoMaximo` vs. inscripciones activas.
- **`POST /api/admin/block-evaluations`** — TEACHER registra las 5 notas de un bloque (mismo patrón de ownership directo de Gestión Escolar: `Group.teacherId === session.user.id`).
- **`POST/PATCH /api/admin/group-change-requests`** — Recepción crea la solicitud; Control Escolar/Calidad y Control la aprueba o rechaza.

### UI

- Badge de estatus financiero en el perfil del alumno (reutilizado en Admisiones/Recepción).
- `/admin/recepcion/grupos-disponibilidad`: matriz de cupos.
- `/admin/control-escolar/solicitudes`: bandeja de aprobación de bajas/cambios de grupo.
- `/portal/calificaciones` (Spec 3a) gana una segunda sección de "Calificaciones por bloque" junto a las evaluaciones libres ya existentes.

---

## 4c — Comercial y Comunicación Interna

### Modelo de datos

```prisma
enum TicketStatus {
  ABIERTO
  EN_PROCESO
  RESUELTO
}

model InterAreaTicket {
  id            String       @id @default(cuid())
  title         String
  description   String
  createdById   String
  assignedToId  String?
  status        TicketStatus @default(ABIERTO)
  createdAt     DateTime     @default(now())
  resolvedAt    DateTime?

  createdBy  User  @relation("TicketCreatedBy", fields: [createdById], references: [id], onDelete: Cascade)
  assignedTo User? @relation("TicketAssignedTo", fields: [assignedToId], references: [id])
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  message   String
  link      String?
  readAt    DateTime?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

Las notificaciones se generan desde eventos ya existentes en el código (aprobación de `GroupChangeRequest`, `Lead` asignado a un asesor, confirmación de pago vía webhook de Stripe) llamando a un helper compartido `notify(userId, message, link?)` — no es un sistema de eventos genérico, son llamadas explícitas en los puntos donde ya existe la lógica de negocio correspondiente.

### Endpoints

- **`GET/POST /api/admin/tickets`**, **`PATCH /api/admin/tickets/[id]`** — bandeja de pendientes inter-áreas.
- **`GET /api/admin/notifications`**, **`PATCH /api/admin/notifications/[id]/read`** — central de notificaciones.
- **`PATCH /api/admin/leads/[id]/assign`** — asignar `asesorAsignadoId` a un `Lead`.

### UI

- `/admin/tickets`: bandeja tipo lista de tareas, filtro por asignado/estatus.
- Campana de notificaciones en el header del panel admin, con contador de no leídas.
- Selector de asesor en la vista de detalle de un `Lead` en `/admin/mercadotecnia` (o una nueva `/admin/admisiones` ampliada).

---

## Riesgos / decisiones abiertas

- El helper `notify()` es una llamada directa desde el código existente, no una cola de eventos — si el número de puntos de notificación crece mucho, valdría la pena un bus de eventos interno; no se justifica todavía.
- La matriz de traslape de horarios de asesorías solo valida contra otras citas del mismo asesor/profesor, no contra su carga de clases regulares (`Group.scheduleSlots`) — se puede cruzar en una iteración futura si se vuelve un problema real.
- `GroupChangeRequest` no contempla una tercera vía de "aprobación automática" para bajas solicitadas por el propio alumno vía portal — todo pasa por aprobación manual de Control Escolar, que es el flujo que describe el organigrama.
