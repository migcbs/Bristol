# Bristol — Spec 2d: Gestión Escolar

## Contexto

Spec 0 (Fundación), Spec 1 (Landing), Spec 2a (Admisiones), Spec 2b (Cobranzas) y Spec 2c (Reinscripciones) están completas y mergeadas. Este documento cubre **Gestión Escolar**: asistencia e incidencias de alumnos. A diferencia de los módulos anteriores (todos en `/admin`), este es el primer módulo con una superficie real para el rol **TEACHER** en `/portal` — los profesores toman asistencia y registran incidencias de sus propios grupos.

## Objetivo

Que un profesor pueda pasar lista a un grupo que imparte y registrar incidencias de un alumno, y que Staff/Admin puedan consultar esa información (asistencia e incidencias) de los alumnos de su plantel.

## Fuera de alcance

- Reportes agregados de asistencia (porcentajes, alertas de inasistencia) — iteración futura.
- Notificación automática a padres cuando se registra una incidencia — Comunicaciones, sub-spec posterior.
- Edición/borrado de un registro de asistencia ya guardado — para esta primera versión, un registro de asistencia por alumno/fecha es inmutable una vez creado (evita ambigüedad sobre "quién cambió qué"); si se necesita corregir, es una extensión futura.
- Categorías o niveles de severidad para incidencias — una incidencia es solo una descripción libre por ahora.

## Modelo de datos

```prisma
enum AttendanceStatus {
  PRESENT
  ABSENT
  LATE
  EXCUSED
}

model AttendanceRecord {
  id           String           @id @default(cuid())
  enrollmentId String
  date         DateTime         @db.Date
  status       AttendanceStatus
  createdAt    DateTime         @default(now())

  enrollment Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)

  @@unique([enrollmentId, date])
}

model Incident {
  id           String   @id @default(cuid())
  studentId    String
  groupId      String?
  reportedById String
  description  String
  createdAt    DateTime @default(now())

  student    Student @relation(fields: [studentId], references: [id], onDelete: Cascade)
  group      Group?  @relation(fields: [groupId], references: [id], onDelete: SetNull)
  reportedBy User    @relation(fields: [reportedById], references: [id], onDelete: Cascade)
}
```

`AttendanceRecord` se ata a `Enrollment` (no directamente a `Student`+`Group`) porque la asistencia siempre es respecto a una inscripción activa concreta — si el alumno se reinscribe a otro grupo (Spec 2c), su historial de asistencia queda correctamente asociado a la inscripción original. `@@unique([enrollmentId, date])` evita duplicar el registro del mismo día. `Incident.groupId` es opcional porque una incidencia puede no estar ligada a una clase específica.

## Alcance y scoping

- **TEACHER**: puede tomar asistencia y registrar incidencias únicamente para grupos donde `Group.teacherId` sea su propio `User.id`. Ve el roster (alumnos con inscripción activa) de esos grupos.
- **STAFF**: solo lectura — ve asistencia e incidencias de alumnos de su(s) plantel(es) (mismo patrón `getCampusScope` vía `student.campusId`). No puede tomar asistencia ni registrar incidencias (eso es responsabilidad del profesor).
- **ADMIN**: lectura de todo, mismas reglas que Staff pero sin restricción de plantel.

## Endpoints

- **`GET /api/portal/groups`** — grupos donde el usuario autenticado es `teacherId` (solo TEACHER; 403 para otros roles). Usado por el selector de grupo en las pantallas de asistencia/incidencias.
- **`POST /api/portal/attendance`** — body `{ groupId, date, records: [{ enrollmentId, status }] }`. Verifica que `groupId.teacherId` sea el usuario autenticado (403 si no). Verifica que cada `enrollmentId` pertenezca a una inscripción activa de ese `groupId` (400 si no). Crea los `AttendanceRecord` en un solo `createMany` — si alguno de esa fecha ya existe (`@@unique`), la operación completa falla con 400 y no crea ninguno (todo o nada, evita asistencia parcial silenciosa).
- **`POST /api/portal/incidents`** — body `{ studentId, groupId?, description }`. Si se provee `groupId`, verifica que su `teacherId` sea el usuario autenticado (403 si no) y que el alumno tenga una inscripción activa en ese grupo (400 si no). Si no se provee `groupId`, cualquier TEACHER, STAFF o ADMIN puede registrarla siempre que el alumno esté en su alcance de plantel (404 si no).
- **`GET /api/admin/incidents`** — lista incidencias visibles para STAFF/ADMIN (scoping por `student.campusId`, mismo patrón que Admisiones/Cobranzas/Reinscripciones).

## UI

- **`/portal/asistencia`** (TEACHER): selector de grupo (entre los que imparte) + selector de fecha (default hoy) + roster con un control de estatus por alumno (Presente/Ausente/Retardo/Justificado) + botón "Guardar asistencia". Si ya existe asistencia para esa fecha, se muestra de solo lectura (inmutable, según Fuera de alcance) en vez del formulario.
- **`/portal/incidencias`** (TEACHER): formulario para registrar una incidencia de un alumno de sus grupos, más una lista de las incidencias que el profesor ha registrado.
- **`/admin/incidencias`** (STAFF/ADMIN): tabla de solo lectura de incidencias en su alcance.
- Se agrega un `PortalNav` (ya existe desde Cobranzas) con enlaces a Asistencia/Incidencias visibles solo para TEACHER, y una entrada "Incidencias" en `AdminNav`.

## Testing

- `POST /api/portal/attendance`: 403 si el grupo no es del profesor, 400 si algún `enrollmentId` no es una inscripción activa de ese grupo, 400 (todo-o-nada, sin registros parciales) si ya existe asistencia de esa fecha para alguno de los alumnos, 201 en éxito con todos los registros creados.
- `POST /api/portal/incidents`: 403 si se especifica un `groupId` que no es del profesor, 400 si el alumno no está inscrito en ese grupo, 404 si el alumno está fuera del alcance de plantel del usuario (staff/admin sin `groupId`), 201 en éxito.
- `GET /api/admin/incidents`: scoping correcto (ADMIN todas, STAFF su plantel).
- `GET /api/portal/groups`: 403 para no-TEACHER, devuelve solo los grupos propios.

## Riesgos / decisiones abiertas

- Sin reportes agregados en esta versión, un profesor con muchos grupos revisa asistencia grupo por grupo, día por día — aceptable para el volumen actual (escala mediana); una vista de calendario/resumen es una iteración futura razonable.
