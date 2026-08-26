# Bristol — Spec 0: Fundación

## Contexto

Bristol es un sistema integral para una escuela de inglés (marca "Bristol — Inglés Profesional") con operación **presencial en múltiples planteles**, escala **mediana** (cientos de alumnos). El sistema completo se compone de tres subsistemas, cada uno con su propio spec:

1. **Landing page** comercial (marketing, animaciones)
2. **Panel administrativo** (cobranzas/pagos, admisiones, reinscripciones, comunicaciones, gestión escolar, marketing)
3. **Portal académico** (dashboards de profesor, alumno y padre/tutor)

Este documento cubre exclusivamente la **Fundación**: la base técnica y de datos compartida que los tres subsistemas necesitan para existir (autenticación, roles, modelo de datos núcleo, scoping por plantel, y el sistema de diseño compartido). Es un proyecto nuevo, repo independiente (`migcbs/Bristol`), sin relación con otros proyectos del autor.

## Objetivo

Dejar una base funcional sobre la que los specs 1–3 puedan construirse sin retrabajo: login funcionando para los 5 roles, modelo de datos que representa correctamente planteles/personas/grupos, un mecanismo reutilizable de scoping por plantel, y un shell visual (tokens + componentes base) con la identidad de marca de Bristol.

## Fuera de alcance

- Landing pública, contenido de marketing (Spec 1)
- Cobranzas, pagos en línea, admisiones, reinscripciones, comunicaciones, gestión escolar (Spec 2)
- Dashboards de contenido académico: material de clase, asistencia, calificaciones, horarios (Spec 3)
- Dark mode
- Videollamadas / clases en línea (se resolverá en Spec 3 como un enlace externo embebido a Zoom/Meet cuando se necesite; no se construye infraestructura de video propia)

## Stack técnico

- **Framework**: Next.js (App Router), TypeScript
- **Base de datos**: PostgreSQL (Neon o Vercel Postgres)
- **ORM**: Prisma
- **Autenticación**: Auth.js (NextAuth) v5, proveedor de Credentials (email + password), sesiones JWT
- **Email transaccional**: Resend (verificación de cuenta, reset de password)
- **Estilos**: Tailwind CSS con tokens de marca vía CSS variables
- **Hosting**: Vercel

## Roles

Un único campo `role` en `User`, enum: `ADMIN`, `STAFF`, `TEACHER`, `STUDENT`, `PARENT`.

- **ADMIN**: acceso global, todos los planteles, sin necesidad de tabla de scoping.
- **STAFF**: administrativo; asignado a **uno o más** planteles específicos (`StaffCampus`). Solo ve/opera sobre esos planteles.
- **TEACHER**: puede dar clases en **uno o más** planteles (`TeacherCampus`), y puede tener más de un grupo/curso asignado dentro de esos planteles.
- **STUDENT**: pertenece a **exactamente un** plantel (FK directa `campusId` en `Student`, sin tabla puente).
- **PARENT**: puede vincularse a **uno o más** alumnos (`ParentStudent`), típicamente hermanos en la misma escuela; ve la información consolidada de todos sus hijos desde un solo login.

## Modelo de datos (núcleo)

```
Campus
  id, name, address, createdAt, updatedAt

User
  id, email (unique), passwordHash, name, role (enum), emailVerifiedAt, createdAt, updatedAt

StaffCampus (puente Staff <-> Campus)
  id, userId (FK User, role=STAFF), campusId (FK Campus)
  unique(userId, campusId)

TeacherCampus (puente Teacher <-> Campus)
  id, userId (FK User, role=TEACHER), campusId (FK Campus)
  unique(userId, campusId)

Student
  id, userId (FK User, role=STUDENT, 1:1), campusId (FK Campus, requerido), createdAt

ParentStudent (puente Parent <-> Student)
  id, parentUserId (FK User, role=PARENT), studentId (FK Student)
  unique(parentUserId, studentId)

Level
  id, code (A1|A2|B1|B2|C1|C2), name

Group
  id, campusId (FK Campus), levelId (FK Level), teacherId (FK User, role=TEACHER), name, createdAt

Enrollment (puente Student <-> Group)
  id, studentId (FK Student), groupId (FK Group), enrolledAt
  unique(studentId, groupId)
```

Notas de diseño:

- `Student.campusId` es una FK directa (no tabla puente) porque un alumno pertenece a un solo plantel — decisión explícita para evitar over-engineering.
- `TeacherCampus` sí es tabla puente porque un profesor puede dar clases en más de un plantel y tener más de un grupo asignado.
- `Group.teacherId` referencia a un solo profesor titular por grupo; si en el futuro se necesitan co-profesores, se puede evolucionar a una tabla puente sin romper el modelo actual (YAGNI: no se construye ahora).
- Los niveles CEFR son un catálogo fijo (seed de datos), no editable por usuarios en este spec.

## Autorización y scoping por plantel

- Middleware de Next.js valida sesión (Auth.js) y redirige según `role` a su área correspondiente: `/admin/*` (ADMIN, STAFF), `/portal/*` (TEACHER, STUDENT, PARENT). Un usuario sin sesión válida es redirigido a `/login`.
- Un helper de autorización central (`getCampusScope(user)`) devuelve:
  - `"ALL"` si `role === ADMIN`
  - la lista de `campusId` asociados si `role === STAFF` (vía `StaffCampus`) o `TEACHER` (vía `TeacherCampus`)
  - el `campusId` único si `role === STUDENT`
- Todas las queries de Prisma en rutas/admin y rutas/portal que lean datos por plantel (grupos, alumnos, etc.) deben pasar por este helper para construir el `where`. Este patrón es la pieza que reutilizan Spec 2 (cobranzas/admisiones filtradas por plantel del staff) y Spec 3 (grupos/alumnos filtrados por plantel del profesor).
- Este spec **implementa** el helper y lo aplica a un endpoint de ejemplo (listado de Students), pero no implementa las pantallas completas de administración — eso es Spec 2/3.

## Autenticación — flujo

1. Login con email + password (Credentials provider de Auth.js).
2. Alta de usuarios: en este spec, solo vía seed/script administrativo (no hay pantalla de auto-registro pública — el registro de alumnos/staff es responsabilidad de Spec 2/3). Excepción: el flujo de "olvidé mi contraseña" sí se construye aquí, vía Resend, porque es parte del núcleo de auth.
3. Verificación de email: al crear un usuario se envía un correo de verificación vía Resend; el usuario debe verificar antes de iniciar sesión.
4. Sesión JWT con `role` y `id` embebidos, para que el middleware no necesite golpear la base de datos en cada request.

## Sistema de diseño (shell visual)

Basado en el logo de Bristol (azul marino + rojo, tipografía sans-serif bold/condensada):

- Tokens Tailwind vía CSS variables: `--color-primary` (azul marino, ~`#2B2B7A`), `--color-accent` (rojo, ~`#E63329`), `--color-bg` (blanco/gris claro), más las variantes neutras estándar (texto, bordes, hover states).
- Los valores exactos de color y la tipografía final se confirman en Spec 1 (Landing) cuando se reciban los assets de marca completos; por ahora estos tokens son la base y quedan centralizados en un solo archivo para ajustarse sin tocar componentes.
- Modo claro únicamente (sin dark mode en este spec).
- Componentes base en `src/components/ui`: `Button`, `Card`, `Input`, `Table`, `Badge`. Construidos sin dependencia de una librería de componentes de terceros (se puede evaluar shadcn/ui como base de implementación, pero el spec no lo exige).

## Testing

- Tests unitarios para el helper `getCampusScope` (los 5 casos de rol).
- Test de integración del flujo de login (credenciales válidas/inválidas, email no verificado).
- Seed de datos de prueba: 2 planteles, 1 admin, 2 staff (cada uno en un plantel distinto), 2 profesores (uno en ambos planteles), niveles CEFR completos, algunos grupos/alumnos/padres de ejemplo — para poder probar el scoping manualmente y en los specs siguientes.

## Riesgos / decisiones abiertas

- **Assets de marca definitivos**: se usan valores aproximados extraídos del logo; se confirmarán en Spec 1.
- **Elección de librería de UI base** (shadcn/ui vs. componentes propios desde cero): se decide al iniciar el plan de implementación, no bloquea este spec.
