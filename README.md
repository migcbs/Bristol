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
   values, e.g. `NEXTAUTH_SECRET`, `RESEND_API_KEY`) for your machine:

   ```bash
   cp .env.example .env
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
| `staff.norte@bristol-ingles.com` | STAFF (Bristol Norte) |
| `staff.sur@bristol-ingles.com` | STAFF (Bristol Sur) |
| `profesor.itinerante@bristol-ingles.com` | TEACHER (both campuses) |
| `alumno.demo@bristol-ingles.com` | STUDENT |
| `padre.demo@bristol-ingles.com` | PARENT |

### Other scripts

- `npm run db:migrate` — apply pending Prisma migrations (`prisma migrate deploy`).
- `npm run db:reset` — drop and recreate the database from migrations (`prisma migrate reset`).
- `npm test` — run the test suite.
- `npm run build` — production build.
