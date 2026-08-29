# Bristol

## Quick Start

Requires Node **≥22** (see `.nvmrc`):

```bash
nvm use
```

1. Create a local PostgreSQL 16 database:

   ```bash
   createdb bristol
   ```

2. Copy the environment template and fill in `DATABASE_URL` (and the other
   values, e.g. `NEXTAUTH_SECRET`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`) for your machine:

   ```bash
   cp .env.example .env
   ```

   Checkout is inert while `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` are
   left as placeholders. Once you have real keys, forward webhook events to
   your local server with the Stripe CLI:

   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

3. Install dependencies, run migrations, seed the database, and start the dev
   server:

   ```bash
   npm install
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```

### Seeded accounts

The seed script creates the following accounts, all sharing the password
`Bristol123!`:

| Email | Role | Puesto | Campus |
| --- | --- | --- | --- |
| `admin@bristol-ingles.com` | ADMIN | — | both |
| `staff.coatepec@bristol-ingles.com` | STAFF | — | Coatepec |
| `staff.xalapa@bristol-ingles.com` | STAFF | — | Xalapa |
| `recepcion.coatepec@bristol-ingles.com` | STAFF | RECEPCION | Coatepec |
| `caja.xalapa@bristol-ingles.com` | STAFF | CAJA | Xalapa |
| `controlescolar.coatepec@bristol-ingles.com` | STAFF | CONTROL_ESCOLAR | Coatepec |
| `comercial@bristol-ingles.com` | STAFF | COMERCIAL | both |
| `calidadycontrol@bristol-ingles.com` | STAFF | CALIDAD_CONTROL | both |
| `direccion.xalapa@bristol-ingles.com` | STAFF | DIRECCION_CAMPUS | Xalapa |
| `profesor.itinerante@bristol-ingles.com` | TEACHER | — | both |
| `alumno.demo@bristol-ingles.com` | STUDENT | — | minor, linked parent |
| `alumno.adulto.demo@bristol-ingles.com` | STUDENT | — | adult, pays for themselves |
| `padre.demo@bristol-ingles.com` | PARENT | — | linked to `alumno.demo@bristol-ingles.com` |

### Other scripts

- `npm run db:migrate` — apply pending Prisma migrations (`prisma migrate deploy`).
- `npm run db:reset` — drop and recreate the database from migrations (`prisma migrate reset`).
- `npm test` — run the test suite.
- `npm run build` — production build.
