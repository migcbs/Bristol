# Bristol — Spec 3a: Portal Académico (Horarios, Materiales, Calificaciones)

## Contexto

Spec 2 (panel administrativo: Admisiones, Cobranzas, Reinscripciones, Gestión Escolar, Comunicaciones) está completa y mergeada. Este documento inicia la **Spec 3 — Portal Académico**: el resto de la experiencia de profesores, alumnos y padres más allá de pagos (Cobranzas), asistencia/incidencias (Gestión Escolar) y anuncios (Comunicaciones), ya construidos. Cubre las tres piezas que el usuario pidió explícitamente al inicio del proyecto y que aún faltan: **horarios, material de clase, y calificaciones**.

## Objetivo

Que un profesor pueda publicar el horario semanal de sus grupos, subir (como enlace) material de clase, y registrar calificaciones; y que alumnos/padres vean el horario, material y calificaciones de sus propios grupos/hijos.

## Decisión de alcance (documentada, sin bloquear en el usuario)

- **Material de clase = enlace, no archivo binario.** Subir archivos reales requiere un servicio de almacenamiento de blobs (p. ej. Vercel Blob) con sus propias credenciales, que este proyecto no tiene configuradas — mismo tipo de decisión ya tomada con WhatsApp Business API en Comunicaciones (spec, no credenciales → se acota). Un profesor comparte un enlace (Google Drive, Dropbox, YouTube, etc.) con título y descripción opcional; añadir carga de archivos reales es una extensión futura directa una vez exista el servicio de blobs.
- **Horario = conjunto de bloques semanales reemplazable, no eventos con fecha.** Un horario escolar típico es recurrente (p. ej. "Lunes y Miércoles 16:00–18:00"), no una serie de eventos de calendario con excepciones/feriados — eso es un modelo de datos distinto y más complejo (RRULE, excepciones) que no se pidió. Publicar un horario nuevo para un grupo reemplaza el conjunto completo de bloques anteriores de ese grupo (transacción: borrar + crear), en vez de edición granular bloque por bloque — más simple de implementar y de razonar, y evita dejar bloques huérfanos.
- **Calificaciones = lista de evaluaciones inmutable, no una sola nota editable por alumno.** Seguimos el mismo patrón ya establecido en Gestión Escolar (`AttendanceRecord`, `Incident`): cada calificación es un registro individual (p. ej. "Examen parcial 1: 85/100") que se agrega, no se edita — el historial completo de evaluaciones queda visible. Un promedio calculado en la UI es razonable; no se agrega aquí un campo de "promedio final" separado.
- **Sin vistas nuevas para Staff/Admin en esta versión.** Horario/Material/Calificaciones son experiencia académica de Profesor/Alumno/Padre; Staff/Admin ya tienen su propio panel administrativo completo (Spec 2). Si se necesita una vista de solo lectura para Staff/Admin más adelante, es una extensión menor sobre lo ya construido (mismo patrón de `getCampusScope` usado en Incidencias).

## Modelo de datos

```prisma
model ScheduleSlot {
  id        String   @id @default(cuid())
  groupId   String
  dayOfWeek Int      // 0 = domingo … 6 = sábado, sigue la convención de JS Date.getDay()
  startTime String   // "HH:MM", 24 horas
  endTime   String   // "HH:MM", 24 horas
  createdAt DateTime @default(now())

  group Group @relation(fields: [groupId], references: [id], onDelete: Cascade)
}

model Material {
  id           String   @id @default(cuid())
  groupId      String
  title        String
  url          String
  description  String?
  uploadedById String
  createdAt    DateTime @default(now())

  group      Group @relation(fields: [groupId], references: [id], onDelete: Cascade)
  uploadedBy User  @relation(fields: [uploadedById], references: [id], onDelete: Cascade)
}

model Grade {
  id           String   @id @default(cuid())
  enrollmentId String
  title        String
  score        Int
  maxScore     Int      @default(100)
  createdById  String
  createdAt    DateTime @default(now())

  enrollment Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  createdBy  User       @relation(fields: [createdById], references: [id], onDelete: Cascade)
}
```

- `ScheduleSlot.dayOfWeek` usa la misma convención que `Date.prototype.getDay()` de JavaScript (0 = domingo) para que el frontend no tenga que traducir índices.
- `Grade` se ata a `Enrollment` (no directamente a `Student`+`Group`), igual que `AttendanceRecord` en Gestión Escolar — si el alumno se reinscribe a otro grupo, su historial de calificaciones queda correctamente asociado a la inscripción original en la que se generaron.
- `score`/`maxScore` son `Int` sin restricción de rango a nivel de base de datos; la validación de rango (`0 <= score <= maxScore`, `maxScore > 0`) se hace en el endpoint, siguiendo el patrón ya usado para `amountCents` en Cobranzas.

## Alcance y scoping

- **TEACHER**: puede publicar/reemplazar el horario, agregar material, y registrar calificaciones únicamente para grupos donde `Group.teacherId` sea su propio `User.id` (mismo patrón exacto de Gestión Escolar). Para calificaciones, además debe validar que el alumno tenga una inscripción activa en ese grupo (mismo patrón de `POST /api/portal/attendance`/`incidents`).
- **STUDENT**: ve horario/material/calificaciones únicamente de sus propios grupos (vía `Enrollment` activo).
- **PARENT**: ve horario/material/calificaciones de los grupos de sus hijos (vía `ParentStudent` → `Enrollment` activo de cada hijo).

## Endpoints

- **`POST /api/portal/schedule`** — body `{ groupId, slots: [{ dayOfWeek, startTime, endTime }] }`. Verifica que `groupId.teacherId` sea el usuario autenticado (403 si no). Reemplaza el conjunto completo de bloques de ese grupo en una transacción (`deleteMany` + `createMany`). Valida `dayOfWeek` en `0-6`, y `startTime < endTime` en cada bloque (400 si no).
- **`GET /api/portal/schedule?groupId=`** — devuelve los bloques de horario del grupo dado, si el usuario tiene acceso a ese grupo (TEACHER dueño, o STUDENT/PARENT con inscripción activa en él — 404 si no). Sin `groupId`, devuelve el horario de todos los grupos visibles para el usuario (todos sus grupos como profesor, o todos los grupos donde el alumno/hijo tiene inscripción activa).
- **`POST /api/portal/materials`** — body `{ groupId, title, url, description? }`. Verifica que `groupId.teacherId` sea el usuario autenticado (403 si no). Valida que `url` sea una URL válida (400 si no).
- **`GET /api/portal/materials?groupId=`** — mismo patrón de acceso que `GET /api/portal/schedule`.
- **`POST /api/portal/grades`** — body `{ enrollmentId, title, score, maxScore? }`. Verifica que el grupo de esa inscripción pertenezca al profesor autenticado (403 si no) y que la inscripción esté activa (400 si no). Valida `0 <= score <= maxScore` y `maxScore > 0` (400 si no).
- **`GET /api/portal/grades?enrollmentId=`** — devuelve las calificaciones de esa inscripción, si el usuario tiene acceso (TEACHER dueño del grupo, STUDENT dueño de la inscripción, o PARENT de ese alumno — 404 si no). Sin `enrollmentId`, devuelve las calificaciones de todas las inscripciones activas visibles para el usuario (todas las de sus grupos como profesor, o todas las del alumno/sus hijos).

## UI

- **`/portal/horario`** (TEACHER, STUDENT, PARENT): selector de grupo (entre los visibles) + tabla semanal de bloques. Para TEACHER, un formulario para reemplazar el horario completo del grupo seleccionado.
- **`/portal/materiales`** (TEACHER, STUDENT, PARENT): selector de grupo + lista de materiales (título, enlace, descripción, quién lo subió, fecha). Para TEACHER, un formulario para agregar un material al grupo seleccionado.
- **`/portal/calificaciones`** (TEACHER, STUDENT, PARENT): para STUDENT/PARENT, lista de calificaciones agrupadas por alumno/grupo. Para TEACHER, selector de grupo + roster con formulario para registrar una calificación por alumno, más el historial de calificaciones ya registradas de ese grupo.
- Entradas "Horario", "Materiales" y "Calificaciones" añadidas a `PortalNav`.

## Testing

- `POST /api/portal/schedule`: 403 si el grupo no es del profesor, 400 si algún bloque tiene `dayOfWeek` fuera de `0-6` o `startTime >= endTime`, 201 en éxito reemplazando bloques anteriores (verificar que el reemplazo sea completo — un bloque viejo no listado en la nueva solicitud desaparece).
- `GET /api/portal/schedule`: 404 si el usuario no tiene acceso al grupo solicitado, devuelve los bloques correctos con acceso válido.
- `POST /api/portal/materials`: 403 si el grupo no es del profesor, 400 si `url` no es una URL válida, 201 en éxito.
- `GET /api/portal/materials`: mismo patrón de acceso que horario.
- `POST /api/portal/grades`: 403 si el grupo de la inscripción no es del profesor, 400 si la inscripción no está activa, 400 si `score` está fuera de `0..maxScore` o `maxScore <= 0`, 201 en éxito.
- `GET /api/portal/grades`: 404 si el usuario no tiene acceso a la inscripción solicitada (ni profesor del grupo, ni el alumno, ni su padre), devuelve las calificaciones correctas con acceso válido.

## Riesgos / decisiones abiertas

- El reemplazo completo de horario en cada `POST /api/portal/schedule` es simple pero no incremental — un profesor cambiando un solo bloque debe reenviar el horario completo del grupo; aceptable dado que el formulario de la UI siempre muestra y envía el conjunto completo, no bloques individuales.
- No hay validación de traslape de horarios entre grupos de un mismo plantel/salón en esta versión (dos grupos podrían compartir el mismo horario sin que el sistema lo detecte) — fuera de alcance, requeriría un concepto de "salón" que el modelo de datos actual no tiene.
