# Bristol — Spec 2e: Comunicaciones

## Contexto

Spec 0 (Fundación), Spec 1 (Landing), Spec 2a (Admisiones), Spec 2b (Cobranzas), Spec 2c (Reinscripciones) y Spec 2d (Gestión Escolar) están completas y mergeadas. Este documento cubre **Comunicaciones**, el último sub-spec de la Spec 2 (panel administrativo).

## Objetivo

Que Staff/Admin puedan publicar anuncios dirigidos a un plantel, un rol, o toda la escuela, que los destinatarios vean en su portal y, opcionalmente, reciban por correo.

## Decisión de alcance (documentada, sin bloquear en el usuario)

El plan original de la conversación mencionó "borradores de mensajes asistidos por IA para WhatsApp/correo, anuncios programados y encuestas" como posibles funciones de Comunicaciones. Se acota el alcance de esta primera versión así:

- **Sí, en esta versión:** anuncios (announcements) dirigidos por rol/plantel, visibles en el portal de cada destinatario, con envío de correo opcional vía Resend (ya integrado desde Fundación).
- **Fuera de alcance, con razón concreta:**
  - **Integración con WhatsApp Business API** — requiere verificación de negocio en Meta, un número de teléfono aprovisionado y credenciales que este proyecto no tiene; no es implementable en un sprint de desarrollo sin esas credenciales reales. Ver `docs/superpowers/specs/2026-08-27-school-management-design.md`'s tratamiento de Stripe como precedente: se avanza con lo que sí se puede construir y probar hoy, y se deja la integración externa para cuando existan las credenciales.
  - **Redacción asistida por IA** — introduce una decisión de proveedor/costo de LLM que no se ha discutido con el usuario; se puede añadir después sin cambiar el modelo de datos de Announcement.
  - **Envío programado (scheduled)** — requiere infraestructura de cron/job queue que el proyecto no tiene aún (Vercel Cron es una opción futura razonable). Un anuncio se publica de inmediato al crearse.
  - **Encuestas** — alcance de producto distinto, no relacionado con el mecanismo de anuncios; se puede tratar como su propio sub-spec futuro si se necesita.

Esta acotación sigue el mismo patrón usado en el resto del proyecto: construir el núcleo verificable ahora, documentar explícitamente lo que se deja fuera y por qué.

## Modelo de datos

```prisma
enum AnnouncementAudience {
  ALL
  CAMPUS
  ROLE
}

model Announcement {
  id          String               @id @default(cuid())
  title       String
  body        String
  audience    AnnouncementAudience
  campusId    String?
  role        Role?
  sendEmail   Boolean              @default(false)
  createdById String
  createdAt   DateTime             @default(now())

  campus    Campus? @relation(fields: [campusId], references: [id])
  createdBy User    @relation(fields: [createdById], references: [id], onDelete: Cascade)
}
```

- `audience = ALL`: visible para todos los usuarios (`campusId`/`role` deben ser `null`).
- `audience = CAMPUS`: visible para usuarios asociados a `campusId` (Staff/Teacher vía sus tablas de unión, Student vía `Student.campusId`, Parent vía sus hijos). `campusId` es requerido; `role` debe ser `null`.
- `audience = ROLE`: visible para todos los usuarios de `role`, sin importar plantel. `role` es requerido; `campusId` debe ser `null`.
- Un anuncio es inmutable una vez creado (igual que `AttendanceRecord` en Gestión Escolar) — no hay edición ni borrado en esta versión; un anuncio incorrecto se corrige publicando uno nuevo. Esto evita ambigüedad sobre "quién vio qué versión".

## Alcance y scoping

- **ADMIN**: puede crear anuncios con cualquier `audience` (ALL, cualquier CAMPUS, cualquier ROLE).
- **STAFF**: puede crear anuncios con `audience = CAMPUS` únicamente para los planteles en su propio `getCampusScope` (nunca ALL, nunca ROLE, nunca un plantel fuera de su alcance) — un miembro de Staff no puede anunciar a "todos los TEACHER de la escuela" ni a un plantel que no le pertenece.
- **TEACHER/STUDENT/PARENT**: solo lectura — ven los anuncios cuyo `audience` los alcanza, calculado así:
  - `ALL` → todos.
  - `CAMPUS` → si su propio plantel (o, para PARENT, el de cualquiera de sus hijos) coincide con `announcement.campusId`.
  - `ROLE` → si `announcement.role === session.user.role`.

## Endpoints

- **`POST /api/admin/announcements`** — body `{ title, body, audience, campusId?, role?, sendEmail }`. Valida que la combinación de `audience`/`campusId`/`role` sea consistente (400 si no). Para STAFF, valida que `audience === "CAMPUS"` y que `campusId` esté dentro de su `getCampusScope` (403 si no). Crea el `Announcement`. Si `sendEmail` es `true`, encola el envío de correo (ver "Envío de correo" abajo) a los destinatarios calculados — un fallo de envío de correo no debe impedir que el anuncio se haya creado y quede visible en el portal (el anuncio ya existe; el correo es un best-effort adicional).
- **`GET /api/admin/announcements`** — lista anuncios visibles para el llamador: ADMIN ve todos, STAFF ve los que él mismo pudo haber creado más los de alcance ALL (mismo patrón de "lo que yo puedo gestionar" usado en otros módulos administrativos).
- **`GET /api/portal/announcements`** — lista los anuncios que alcanzan al usuario autenticado (STUDENT, PARENT, TEACHER), calculados con la lógica de "Alcance y scoping" arriba, más recientes primero.

## Envío de correo

Reutiliza `src/lib/email.ts` (ya existe desde Fundación, usado hoy para verificación de correo). Se añade una función `sendAnnouncementEmail(to: string, announcement: { title: string; body: string })` que sigue el mismo patrón de las funciones de email ya existentes ahí (mismo remitente, mismo manejo de errores). El cálculo de destinatarios (a quién enviar) reutiliza exactamente la misma lógica de alcance que `GET /api/portal/announcements`, invertida: en vez de "qué anuncios ve este usuario", es "qué usuarios ve este anuncio" — se implementa como una función compartida en `src/lib/announcement-scope.ts` para no duplicar las reglas de audiencia en dos lugares.

## UI

- **`/admin/comunicaciones`** (ADMIN, STAFF): formulario para crear un anuncio (título, cuerpo, selector de audiencia — ALL solo visible para ADMIN, selector de plantel limitado al alcance de Staff, selector de rol solo visible para ADMIN, checkbox "enviar por correo") + lista de anuncios ya creados por el usuario/su alcance, más recientes primero.
- **`/portal/comunicaciones`** (TEACHER, STUDENT, PARENT): lista de solo lectura de los anuncios que le alcanzan, más recientes primero.
- Entrada "Comunicaciones" añadida a `AdminNav` y a `PortalNav`.

## Testing

- `POST /api/admin/announcements`: 401 sin sesión, 403 para roles no ADMIN/STAFF, 400 si la combinación audience/campusId/role es inconsistente, 403 si STAFF intenta `audience !== "CAMPUS"` o un `campusId` fuera de su alcance, 201 en éxito (con y sin `sendEmail`).
- `GET /api/admin/announcements`: ADMIN ve todos, STAFF ve los suyos + los ALL.
- `GET /api/portal/announcements`: cada combinación de audience (ALL/CAMPUS/ROLE) alcanza correctamente a STUDENT/PARENT/TEACHER, y NO alcanza a quien está fuera de esa audiencia (caso negativo explícito, siguiendo el patrón ya usado en Cobranzas para la exclusión de estados PAID/CANCELED).
- `src/lib/announcement-scope.ts`: pruebas unitarias directas de la función de cálculo de destinatarios para cada combinación de audience.

## Riesgos / decisiones abiertas

- El envío de correo es best-effort y no transaccional con la creación del anuncio (si Resend falla, el anuncio ya quedó creado y visible en el portal, pero el correo no llegó) — aceptable para esta primera versión; una cola de reintentos es una extensión futura si el volumen lo justifica.
- No hay confirmación de lectura ("visto por") en esta versión — simple lista, sin tracking de apertura.
