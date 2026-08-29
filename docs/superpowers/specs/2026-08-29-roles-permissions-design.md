# Bristol — Spec 5: Roles y Permisos (Refactorización)

## Contexto

El sistema actual tiene 5 roles (`ADMIN`, `STAFF`, `TEACHER`, `STUDENT`, `PARENT`) donde **todo `STAFF` ve exactamente lo mismo** (Admisiones, Cobranzas, Reinscripciones, Gestión Escolar, Comunicaciones, Mercadotecnia, Recepción — el panel completo), y `STUDENT`/`PARENT` tienen visiones casi idénticas del portal. Esto no refleja el organigrama real (Recepción, Caja, Control Escolar, Comercial, Calidad y Control son puestos distintos con responsabilidades distintas) ni la realidad de quién debe poder pagar una colegiatura.

## Comparación con sistemas del mercado

- **PowerSchool SIS** (líder de EUA, ~85% del mercado de SIS): separa el **nivel de acceso** (Admin / Staff / Teacher / Student-Parent) del **perfil de permisos** — un administrador puede crear "User Access Roles" personalizados que habilitan o deshabilitan funciones específicas (p. ej. "puede borrar datos de alumnos permanentemente") independientemente del nivel base. El staff de cafetería, orientación y administración comparten el nivel "Admin portal" pero con perfiles de permisos distintos. ([ps.powerschool-docs.com](https://ps.powerschool-docs.com/pssis-admin/latest/user-access-roles))
- **SchoolMatic** (sistema chileno comparable en tamaño a Bristol): define seis perfiles de puesto (Administrador, Docente, UTP, Inspectoría, Psicólogo/Trabajador Social, Docente PIE), cada uno con acceso a módulos específicos, más un control granular que permite habilitar/deshabilitar módulos individuales por encima del perfil. ([schoolmatic.gitbook.io](https://schoolmatic.gitbook.io/funcionarios/administracion-del-sistema/control-de-acceso))

**Decisión de arquitectura:** replicar este patrón de dos capas — **nivel de acceso** (sin tocar, ya funciona) + **puesto/departamento** (nuevo, granular) — en vez de reemplazar el enum `Role` por roles nuevos. Cambiar el enum `Role` directamente rompería literalmente cada verificación `role !== "ADMIN" && role !== "STAFF"` en ~30 rutas ya construidas y revisadas a lo largo de 6 specs — es el mismo riesgo que este proyecto ha evitado consistentemente prefiriendo extender modelos existentes en vez de reemplazarlos.

## Modelo propuesto

### Capa 1 — Nivel de acceso (`Role`, sin cambios)

`ADMIN` | `STAFF` | `TEACHER` | `STUDENT` | `PARENT` — determina a qué portal entra el usuario (`/admin` vs `/portal`) y sigue siendo la base de `proxy.ts` y de todo el sistema de scoping por plantel ya construido (`getCampusScope`). No se toca.

### Capa 2 — Puesto (`StaffPosition`, nuevo, solo aplica a `STAFF`)

```prisma
enum StaffPosition {
  RECEPCION
  CAJA
  CONTROL_ESCOLAR
  COMERCIAL
  CALIDAD_CONTROL
  DIRECCION_CAMPUS
}

model User {
  // ...campos existentes...
  staffPosition StaffPosition?   // solo poblado cuando role = STAFF
}
```

`ADMIN` nunca tiene `staffPosition` — ve todo, sin restricción, exactamente como hoy. Un `STAFF` sin `staffPosition` asignado (dato legado o error de captura) **no ve ningún módulo** (fail-closed, mismo criterio que el resto del proyecto) hasta que Dirección de Campus le asigne un puesto.

### Matriz de módulos por puesto

| Módulo | Recepción | Caja | Control Escolar | Comercial | Calidad y Control | Dirección de Campus | Admin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Búsqueda global (Cmd+K) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Alta rápida de alumno | ✅ | — | — | — | — | ✅ | ✅ |
| Lista de espera | ✅ | — | — | ✅ | — | 👁 solo lectura | ✅ |
| Agenda de exámenes de ubicación | ✅ | — | — | ✅ | — | 👁 | ✅ |
| Bitácora + reporte de altas/bajas | ✅ | — | — | — | 👁 | ✅ | ✅ |
| Admisiones (leads) | 👁 | — | — | ✅ | 👁 | ✅ | ✅ |
| Mercadotecnia (métricas de conversión) | — | — | — | ✅ | 👁 | ✅ | ✅ |
| Cobranzas ("Enviar a Caja") | ✅ (solo crear) | ✅ (cobrar/conciliar) | — | — | 👁 | 👁 | ✅ |
| Disponibilidad de grupos | ✅ | — | ✅ | 👁 | — | 👁 | ✅ |
| Reinscripciones | — | — | ✅ | — | 👁 | 👁 | ✅ |
| Solicitudes de baja/cambio de grupo (aprobar) | ⛔ (solo iniciar) | — | ✅ | — | ✅ | ✅ | ✅ |
| Incidencias (lectura) | 👁 | — | 👁 | — | ✅ | 👁 | ✅ |
| Calificaciones por bloque (lectura) | — | — | ✅ | — | 👁 | 👁 | ✅ |
| Comunicaciones (anuncios) | 👁 | — | — | ✅ (a leads) | ✅ | ✅ | ✅ |
| Tickets internos | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

✅ = acceso completo (leer + escribir) · 👁 = solo lectura · ⛔ = puede iniciar una acción pero no aprobarla · — = sin acceso

Esta tabla es un punto de partida razonable basado en el organigrama y en lo que cada puesto hace hoy en papel — **debe confirmarse contigo antes de implementar**, en particular las filas marcadas 👁/⛔ que son las que más cambian el comportamiento actual (hoy todo STAFF tiene ✅ en todo).

### Implementación técnica

- `getCampusScope` no cambia — sigue determinando *qué plantel(es)* puede ver un STAFF.
- Nuevo helper `hasModuleAccess(user, module)` en `src/lib/staff-permissions.ts`, con una tabla estática `MODULE_ACCESS: Record<StaffPosition, Record<Module, "full" | "read" | "initiate" | "none">>` reflejando la matriz de arriba.
- `AdminNav` deja de mostrar todos los módulos a todo STAFF — filtra según `hasModuleAccess(user, module) !== "none"`.
- Cada ruta de escritura ya existente agrega **una línea** al inicio: `if (role === "STAFF" && hasModuleAccess(user, "cobranzas") !== "full") return 403`. No se reescribe ninguna lógica de negocio ya construida y revisada.

## Alumno adulto = su propio tutor (sin cuenta de padre separada)

**Decisión:** un alumno de 18+ años (calculado con `computeAgeBracket(fechaNacimiento)`, ya construido en Spec 4a) obtiene automáticamente las mismas capacidades de pago que un `PARENT` **sobre su propia cuenta** — no se crea una segunda cuenta ni se fusionan roles a nivel de base de datos.

- **Hoy** (verificado en el código de Cobranzas): tanto `STUDENT` como `PARENT` ya comparten la misma lógica de alcance de facturas (`getVisibleStudentIds`) y el mismo botón de pago — es decir, **un alumno mayor de edad ya puede pagar hoy**, por accidente de diseño, no por decisión explícita. El hueco real es el opuesto al que describes: **un alumno menor de edad también puede pagar hoy**, y no debería.
- **Cambio necesario:** en el endpoint de checkout y en el botón "Pagar" del portal, si `role === "STUDENT"` y el alumno es menor de edad (`computeAgeBracket !== "ADULTO"`), bloquear el pago y mostrar Cobranzas como **solo notificación** (ve el estatus de sus facturas, sin botón de pago) — el pago debe venir de la cuenta `PARENT` vinculada vía `ParentStudent`. `PARENT` siempre puede pagar, sin importar la edad del hijo. `STUDENT` adulto puede pagar sin restricción (comportamiento actual, ahora ya intencional).
- **Decisión confirmada:** un alumno con `fechaNacimiento` en `null` se trata como menor (no se puede verificar mayoría de edad → se bloquea el pago hasta que Recepción capture la fecha de nacimiento).

## Cuentas de prueba a sembrar

Sustituyendo/ampliando las 6 cuentas actuales del seed:

| Correo | Rol | Puesto | Plantel |
|---|---|---|---|
| `admin@bristol-ingles.com` | ADMIN | — | ambos |
| `recepcion.coatepec@bristol-ingles.com` | STAFF | RECEPCION | Coatepec |
| `caja.xalapa@bristol-ingles.com` | STAFF | CAJA | Xalapa |
| `controlescolar.coatepec@bristol-ingles.com` | STAFF | CONTROL_ESCOLAR | Coatepec |
| `comercial@bristol-ingles.com` | STAFF | COMERCIAL | ambos |
| `calidadycontrol@bristol-ingles.com` | STAFF | CALIDAD_CONTROL | ambos |
| `direccion.xalapa@bristol-ingles.com` | STAFF | DIRECCION_CAMPUS | Xalapa |
| `profesor.itinerante@bristol-ingles.com` | TEACHER | — | ambos |
| `alumno.menor.demo@bristol-ingles.com` | STUDENT | — | (menor de edad, con padre vinculado) |
| `alumno.adulto.demo@bristol-ingles.com` | STUDENT | — | (18+, paga por sí mismo) |
| `padre.demo@bristol-ingles.com` | PARENT | — | (vinculado al alumno menor) |

Todas con contraseña `Bristol123!`.

## Decisiones confirmadas por el usuario (2026-08-29)

- La matriz de módulos por puesto queda aprobada tal como está en este documento.
- Fecha de nacimiento faltante = tratado como menor de edad (bloquea pago).

## Alcance de la implementación (primera versión)

Dado el tamaño de la matriz completa (toca rutas de 6 specs ya construidas), esta primera versión implementa:

1. **Filtrado de navegación por puesto** (`AdminNav` deja de mostrar módulos sin acceso) — el cambio de mayor impacto y menor riesgo, cubre toda la matriz a nivel de visibilidad.
2. **Aplicación a nivel de ruta** para los tres casos de mayor riesgo si se dejan solo a nivel de navegación (un usuario podría llamar la API directamente sin pasar por el menú):
   - Cobranzas: Caja con acceso completo, Recepción solo puede crear (vía "Enviar a Caja"), Control Escolar y Comercial bloqueados.
   - Reinscripciones: solo Control Escolar (y Admin).
   - Aprobación de solicitudes de baja/cambio de grupo: solo Control Escolar, Calidad y Control, Dirección de Campus (y Admin).
3. **Restricción de pago por edad**: bloquear el botón/endpoint de pago para `STUDENT` menor de edad; `PARENT` siempre puede pagar.
4. **Cuentas de prueba nuevas** por puesto + alumno menor/adulto.

Las demás filas de la matriz (Admisiones/Mercadotecnia limitado a Comercial, Comunicaciones, Incidencias, Disponibilidad, Calificaciones por bloque a nivel admin) quedan cubiertas por el filtrado de navegación de este mismo pase, pero **sin bloqueo a nivel de ruta todavía** — es una extensión directa (una línea por ruta, usando el mismo helper `hasModuleAccess`) que se puede hacer como fast-follow sin rediseño.

## Fuera de alcance de esta spec

- No se introduce una UI de administración de permisos (asignar `staffPosition` se hace hoy vía seed/base de datos directamente, o vía una edición simple en un futuro "Editar usuario" — no está en el organigrama pedido explícitamente).
- No se reconstruye el sistema de autenticación ni se agregan roles nuevos al enum `Role`.
