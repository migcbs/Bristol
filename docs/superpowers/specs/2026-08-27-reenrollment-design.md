# Bristol — Spec 2c: Reinscripciones

## Contexto

Spec 0 (Fundación), Spec 1 (Landing), Spec 2a (Admisiones) y Spec 2b (Cobranzas) están completas y mergeadas. Este documento cubre **Reinscripciones**: el proceso de avanzar a un alumno de su grupo/nivel actual al siguiente ciclo, cerrando su inscripción activa y creando una nueva.

## Objetivo

Que Staff/Admin puedan ver qué alumnos tienen una inscripción activa y, cuando corresponda, reinscribirlos a un nuevo grupo (típicamente del siguiente nivel CEFR), quedando un historial claro de en qué grupos ha estado cada alumno.

## Fuera de alcance

- Ciclos escolares formales con fechas de inicio/fin — Fundación no modela "ciclos", así que este spec no los introduce; una inscripción simplemente está activa o completada, sin fecha de corte automática. Iteración futura si se necesita.
- Recordatorios automáticos de reinscripción — Comunicaciones, sub-spec posterior.
- Reinscripción masiva (todo un grupo de una vez) — YAGNI para esta primera versión; se reinscribe alumno por alumno.
- Cobro asociado a la reinscripción — Cobranzas ya existe como módulo separado; si se requiere generar un cargo al reinscribir, es una integración futura, no parte de este spec.

## Modelo de datos

Se agrega un campo a `Enrollment` (ya existente en Fundación):

```prisma
model Enrollment {
  // ...campos existentes (id, studentId, groupId, enrolledAt)...
  completedAt DateTime?
}
```

Una inscripción sin `completedAt` está **activa**; con `completedAt` está **completada** (el alumno ya avanzó o dejó ese grupo). No se agrega un `status` enum separado — `completedAt: null` vs. no-null ya expresa el estado sin duplicar información.

## Alcance y scoping

- **ADMIN**: ve y reinscribe alumnos de cualquier plantel.
- **STAFF**: ve y reinscribe solo alumnos cuyo `campusId` esté en su alcance (mismo patrón `getCampusScope` que Admisiones/Cobranzas).
- Un alumno solo puede reinscribirse a un grupo de **su mismo plantel** (no tiene sentido mover a un alumno de plantel vía este flujo — eso sería una operación administrativa distinta y fuera de alcance).

## Endpoints

- **`GET /api/admin/enrollments`** — lista las inscripciones activas (`completedAt: null`) visibles para el usuario, con datos del alumno, grupo, nivel y plantel. Reutiliza el patrón de scoping ya establecido (`student.campusId` dentro del scope).
- **`POST /api/admin/reinscripciones`** — body `{ enrollmentId, newGroupId }`. Verifica que la inscripción actual esté dentro del scope del usuario y siga activa (`completedAt: null`), y que `newGroupId` pertenezca al **mismo plantel** que el alumno. En una transacción: marca la inscripción actual con `completedAt = now()` y crea una nueva `Enrollment` para el mismo alumno en `newGroupId`. 404 si la inscripción no está en scope o ya no existe; 400 si ya estaba completada, o si el grupo destino no existe o es de otro plantel.

## UI

- **`/admin/reinscripciones`** (Server Component, patrón igual a Admisiones/Cobranzas): tabla de inscripciones activas con alumno, plantel, nivel/grupo actual, y un selector para elegir el grupo destino (grupos del mismo plantel, cualquier nivel — el staff decide si avanza o repite nivel) con botón "Reinscribir".
- Se agrega "Reinscripciones" a `AdminNav`.

## Testing

- `GET /api/admin/enrollments`: scoping correcto (ADMIN todas, STAFF su plantel), solo activas (`completedAt: null`) aparecen.
- `POST /api/admin/reinscripciones`: reinscribe exitosamente (200, inscripción anterior completada + nueva creada), 404 si la inscripción está fuera de scope, 400 si ya estaba completada, 400 si el grupo destino es de otro plantel, 400 si el grupo destino no existe.

## Riesgos / decisiones abiertas

- Sin modelo de "ciclo escolar", no hay forma automática de saber *cuándo* un alumno debería reinscribirse — el staff decide manualmente basándose en su propio criterio (ej. fin de trimestre). Esto es aceptable para una primera versión; un futuro spec podría agregar un campo `Group.cycleEndsAt` para generar alertas.
