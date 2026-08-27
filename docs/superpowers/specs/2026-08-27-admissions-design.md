# Bristol — Spec 2a: Admisiones (primer módulo del Panel Administrativo)

## Contexto

Spec 0 (Fundación) y Spec 1 (Landing) están completas y mergeadas. Spec 2 —Panel administrativo— cubre cinco áreas (cobranzas, admisiones, reinscripciones, comunicaciones, gestión escolar), demasiado grande para un solo plan de implementación. Este documento cubre solo **Admisiones**: el primer módulo real dentro de `/admin`, construido directamente sobre la tabla `Lead` que Landing (Spec 1) ya creó para capturar prospectos desde el formulario público.

## Objetivo

Que Staff/Admin puedan ver los leads capturados por la landing, darles seguimiento (cambiar su estatus en el pipeline de admisión) y asignarlos a un plantel, respetando el scoping por plantel ya establecido en la Fundación.

## Fuera de alcance

- Notificaciones automáticas a leads o al staff (correo/WhatsApp) — eso es Comunicaciones, un sub-spec posterior de Spec 2.
- Conversión formal de un Lead en `Student`/inscripción real — eso pertenece a Reinscripciones/Gestión Escolar, sub-specs posteriores.
- Reportes o analítica de conversión — posible iteración futura.
- Edición de campos del lead más allá de estatus y plantel asignado (nombre/email/teléfono los captura el propio prospecto y no deberían editarse desde el panel en esta primera versión).

## Modelo de datos

Se agrega un campo de estatus al `Lead` existente (Spec 1):

```prisma
enum LeadStatus {
  NEW
  CONTACTED
  ENROLLED
  LOST
}

model Lead {
  // ...campos existentes...
  status LeadStatus @default(NEW)
}
```

`campusId` ya existe y ya es opcional — un lead sin plantel asignado queda en una "bolsa" visible para todo el Staff hasta que alguien lo reclama asignándole un plantel.

## Alcance y scoping

- **ADMIN**: ve y edita todos los leads, de cualquier plantel o sin asignar.
- **STAFF**: ve los leads de su(s) plantel(es) asignados en Fundación (`StaffCampus`), **más** los leads sin plantel asignado (`campusId: null`) — para poder reclamarlos. No ve leads asignados a un plantel que no es el suyo.
- Reutiliza `getCampusScope` (Fundación) para construir el filtro: `ALL` → sin filtro; `CAMPUS_LIST` → `campusId IN (...) OR campusId IS NULL`; los demás tipos de scope (`SINGLE_CAMPUS`, `NONE`) no aplican a este endpoint porque solo ADMIN/STAFF acceden a `/admin` (ya filtrado por el proxy de Fundación) — TEACHER/STUDENT/PARENT nunca llegan aquí.

## Endpoints

- **`GET /api/admin/leads`** — lista los leads visibles para el usuario autenticado, más recientes primero. Query param opcional `status` para filtrar por estatus. 401 sin sesión, 403 si el rol no es ADMIN/STAFF.
- **`PATCH /api/admin/leads/[id]`** — actualiza `status` y/o `campusId` de un lead. Antes de aplicar el cambio, verifica que el lead esté dentro del scope del usuario (mismas reglas que el GET); si no lo está, 404 (no revelar existencia de leads fuera de scope). 400 si el `status` no es un valor válido del enum o si el `campusId` no corresponde a un `Campus` existente.

## UI

- **`/admin/admisiones`** (Server Component): lee la sesión, calcula el scope, consulta los leads visibles directamente vía Prisma (mismo patrón que `/programas`/`/planteles`), y renderiza una tabla (reutilizando `Table`/`TableRow`/`TableCell` de Fundación) con nombre, email, teléfono, plantel (o "Sin asignar"), estatus, y fecha.
- Cada fila tiene un menú de estatus (select) y de plantel (select) que llaman a `PATCH /api/admin/leads/[id]` desde un Client Component (`LeadRowActions`), con actualización optimista simple y manejo de error visible.
- Se agrega una barra de navegación mínima dentro de `/admin` (`AdminNav`, Client Component) con un enlace a "Admisiones" — es el primer módulo real; los demás sub-specs de Spec 2 añadirán sus propios enlaces ahí según se construyan.
- La página raíz de `/admin` se actualiza para enlazar a Admisiones en vez de solo mostrar el texto placeholder.

## Testing

- Test de integración para `GET /api/admin/leads`: 401 sin sesión, 403 con rol STUDENT, ADMIN ve todos, STAFF ve solo su plantel + sin asignar, filtro por `status` funciona.
- Test de integración para `PATCH /api/admin/leads/[id]`: actualiza estatus válido (200), rechaza estatus inválido (400), rechaza `campusId` inexistente (400), devuelve 404 si el lead está fuera del scope del usuario.

## Riesgos / decisiones abiertas

- El menú de estatus/plantel por fila usa un `<select>` simple con `onChange` en vez de un componente de UI más elaborado — suficiente para esta primera versión administrativa; se puede refinar visualmente en una pasada de diseño posterior si hace falta.
