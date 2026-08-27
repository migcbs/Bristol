# Bristol — Spec 1: Landing Page

## Contexto

Spec 0 (Fundación) está completa y mergeada a `main`: autenticación, roles, modelo de datos base (planteles, niveles CEFR, usuarios), sistema de diseño compartido (tokens de marca, componentes UI), y rutas protegidas `/admin` y `/portal`. Este spec construye el sitio público de marketing — la primera cara que ve un visitante que no es alumno, profesor ni staff.

## Objetivo

Un sitio de marketing moderno con animaciones y efecto parallax que comunique la propuesta de valor de Bristol, muestre programas/planteles/precios, capture leads de admisión, y sirva como entrada visual coherente con el resto del sistema (reutilizando marca y componentes de la Fundación).

## Fuera de alcance

- Fotografía real y copy final (se usa contenido de marcador de posición en español, ajustable después).
- Integración con un CRM externo — los leads solo se guardan en la base de datos propia.
- SEO avanzado (metadata enriquecida por página, sitemap.xml, structured data) — se puede añadir en una iteración posterior sin rediseño.
- Panel de administración de leads (eso es Spec 2 — Admisiones, que consumirá la misma tabla `Lead`).
- Internacionalización (i18n) — el sitio es solo en español.

## Estructura de rutas (híbrida)

- **`/`** — Landing de una sola página con scroll y nav de anclas: Hero → Programas (preview) → Planteles (preview) → Testimonios/métricas → Precios (preview) → CTA final con formulario de lead.
- **`/programas`** — Detalle completo de los 6 niveles CEFR (A1–C2), cada uno con descripción, duración estimada y objetivos.
- **`/planteles`** — Detalle de cada plantel (nombre, dirección, mapa placeholder, horarios de atención placeholder).
- **`/precios`** — Desglose completo de paquetes/planes con montos de marcador de posición.

Las secciones "preview" en `/` muestran un resumen (2–3 tarjetas destacadas) con un enlace "Ver más" hacia la página dedicada correspondiente.

## Animaciones

**Framer Motion** (`npm install framer-motion`) para:
- Fade/slide-in al hacer scroll, vía `whileInView`, encapsulado en un componente reutilizable `Section` (`src/components/ui/section.tsx`) para no repetir la configuración en cada sección.
- Parallax en el Hero: 2–3 capas de formas/gradientes abstractas en los colores de marca (`--color-primary`, `--color-accent`) que se mueven a distinta velocidad al hacer scroll, usando `useScroll`/`useTransform` de Framer Motion.
- Transiciones de página suaves (fade) entre `/` y las páginas dedicadas.
- Micro-interacciones en botones y tarjetas (hover/tap scale sutil).

Sin fotografía real disponible, todo el impacto visual se construye con formas/gradientes abstractos, no imágenes — evita depender de assets inexistentes y mantiene el peso de página bajo.

## Modelo de datos: Lead

Nuevo modelo Prisma, sin relación con `User` (un lead es un prospecto, no una cuenta del sistema):

```prisma
model Lead {
  id        String   @id @default(cuid())
  name      String
  email     String
  phone     String?
  message   String?
  campusId  String?
  createdAt DateTime @default(now())

  campus Campus? @relation(fields: [campusId], references: [id])
}
```

`campusId` es opcional porque el visitante puede no especificar un plantel de interés. `phone`/`message` opcionales porque el formulario solo exige nombre y email como mínimo.

## Endpoint: captura de leads

`POST /api/leads` — público, sin autenticación (es el punto de entrada de gente que aún no tiene cuenta).

- Body: `{ name: string, email: string, phone?: string, message?: string, campusId?: string }`.
- Validación mínima en el servidor: `name` y `email` no vacíos y `email` con formato válido (regex simple, no una librería de validación completa — YAGNI para un solo endpoint).
- Respuesta: `201` con el lead creado en éxito; `400` con mensaje de error si falta `name`/`email` o el email no tiene formato válido.
- No se envía email de confirmación al lead ni notificación al staff en este spec — eso es responsabilidad de Comunicaciones (Spec 2). El registro en base de datos es suficiente para no perder el lead.

## Componentes nuevos

Todos bajo `src/components/landing/`, cada uno responsable de una sola sección visual:

- `Nav.tsx` — navegación con scroll-a-ancla cuando se está en `/`, enlaces normales de página en las subpáginas; incluye enlace "Iniciar sesión" → `/login` (ruta ya existente de Spec 0).
- `Hero.tsx` — título, subtítulo, CTA principal, capas de parallax.
- `ProgramsPreview.tsx` — 3 tarjetas de niveles destacados (usa el catálogo `Level` sembrado en Spec 0) con enlace a `/programas`.
- `CampusesPreview.tsx` — tarjetas de plantel (usa `Campus`) con enlace a `/planteles`.
- `Testimonials.tsx` — grid de 3–4 testimonios placeholder.
- `PricingPreview.tsx` — 2–3 tarjetas de paquete con precios placeholder, enlace a `/precios`.
- `LeadForm.tsx` — formulario controlado que llama a `POST /api/leads`, usa `Input`/`Button` de Spec 0.
- `Footer.tsx` — enlaces, datos de contacto placeholder, copyright.

Y un componente de soporte en `src/components/ui/`:

- `section.tsx` — wrapper `<Section>` que aplica la animación de entrada por scroll de Framer Motion a cualquier hijo.

Páginas dedicadas (`src/app/programas/page.tsx`, `src/app/planteles/page.tsx`, `src/app/precios/page.tsx`) reutilizan `Nav`/`Footer` y muestran el contenido completo correspondiente (leyendo `Level`/`Campus` de Prisma donde aplique).

## Testing

- Test de integración para `POST /api/leads`: rechaza `name`/`email` faltante o email inválido (400), crea el `Lead` con datos válidos (201), incluyendo `campusId` cuando se provee.
- Sin tests de animación — Framer Motion no se presta a pruebas automatizadas significativas con Vitest. Verificación visual manual en navegador de las 4 rutas (`/`, `/programas`, `/planteles`, `/precios`) antes de dar el spec por completo, cubriendo el "golden path" (scroll por toda la landing, envío del formulario de lead) y un caso de error (formulario con email inválido).

## Riesgos / decisiones abiertas

- **Contenido placeholder**: todo el copy y precios son de marcador de posición; se reemplazan sin cambios estructurales cuando Bristol entregue el contenido real.
- **Sin fotografía real**: el diseño depende de formas/gradientes abstractos; si Bristol prefiere fotografía real desde el inicio, el Hero y las tarjetas de plantel necesitarán ajuste visual (no estructural) en una iteración posterior.
