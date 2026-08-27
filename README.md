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

| Email | Role |
| --- | --- |
| `admin@bristol-ingles.com` | ADMIN |
| `staff.coatepec@bristol-ingles.com` | STAFF (Coatepec) |
| `staff.xalapa@bristol-ingles.com` | STAFF (Xalapa) |
| `profesor.itinerante@bristol-ingles.com` | TEACHER (both campuses) |
| `alumno.demo@bristol-ingles.com` | STUDENT |
| `padre.demo@bristol-ingles.com` | PARENT |

### Other scripts

- `npm run db:migrate` — apply pending Prisma migrations (`prisma migrate deploy`).
- `npm run db:reset` — drop and recreate the database from migrations (`prisma migrate reset`).
- `npm test` — run the test suite.
- `npm run build` — production build.
