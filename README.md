# TokTickIT

TokTickIT is the CPE334 IT service-desk MVP. Lab 3 replaces the temporary Development Requester selector with authenticated Users, expiring sessions, first-login password change, and role-aware API protection. Attachment bytes are stored locally under the ignored `server/storage/attachments/` directory and are never committed.

## Technology

- Frontend: React, TypeScript, Vite, Bootstrap
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL, Prisma
- Testing: Vitest, Testing Library, Supertest

## Prerequisites

- Node.js 20 or later
- npm 10 or later
- Docker Desktop with the Docker engine running

## Setup

1. Copy .env.example to .env.
2. Replace the local PostgreSQL credentials in .env if needed.
3. Install dependencies:

       npm install

4. Start PostgreSQL:

       npm run db:up

5. Apply the migrations, generate the Prisma client, and repair migrated credentials:

       npm run prisma:migrate:lab3 --workspace server

6. Seed the Lab 3 reference data, local users, Tickets, comments, and notes:

       npm run db:seed

7. Start the application:

       npm run dev

The Vite frontend runs at http://localhost:5183 and the Express server runs at http://localhost:4000.

The root page retains the Lab 1 `Check System` button. Clicking it calls `GET /api/health` and the protected category endpoint, then shows the backend status and seeded category IDs and names. The authenticated Lab 3 UI is being delivered through the staged Lab 3 Issues.

## Tests and build

For the database-backed Lab 3 migration regression, first copy `.env.test.example` to `.env.test` and replace the local credentials. Then start and prepare the dedicated test database:

    npm run db:test:up
    npm run test:db:prepare

Run the configured unit and API test commands:

    npm test

Run the Lab 3 migration-preservation regression against an isolated schema in the dedicated test database:

    npm run test:lab3:migration

Build both workspaces:

    npm run build

Prepare the isolated Lab 3 test database and run the Playwright flows:

    npm run test:e2e

The E2E script starts the test service on PostgreSQL host port 5434, validates that `DATABASE_URL` points to the `toktickit_test` database, resets and seeds it, then starts the API and client. The preparation guard rejects missing, malformed, development, or differently named database URLs before running reset, migration, or seed commands. Never commit `.env.test`.

## Lab 3 local credentials

These accounts are deterministic local-development and test fixtures only. They are not production credentials. Every seeded account starts with `mustChangePassword = true`.

| Role | Email | Initial password |
| --- | --- | --- |
| Requester | `ariya@example.test` | `TokTickIT-Lab3!User-1-Aa` |
| Requester | `narin@example.test` | `TokTickIT-Lab3!User-2-Aa` |
| Requester | `pimchanok@example.test` | `TokTickIT-Lab3!User-3-Aa` |
| Requester | `kittipong@example.test` | `TokTickIT-Lab3!User-4-Aa` |
| Inactive Requester | `mali@example.test` | `TokTickIT-Lab3!User-5-Aa` |
| IT Staff | `somchai@example.test` | `TokTickIT-Lab3!Staff-Sr` |
| IT Staff | `nalinee@example.test` | `TokTickIT-Lab3!Staff-Nw` |
| IT Staff | `chaiwat@example.test` | `TokTickIT-Lab3!Staff-Ck` |
| Inactive IT Staff | `ploy@example.test` | `TokTickIT-Lab3!Staff-Ps` |
| Administrator | `anong@example.test` | `TokTickIT-Lab3!Admin-Ap` |

When the Lab 2 database is migrated, each legacy Requester keeps its original numeric id and receives the initial password `TokTickIT-Lab3!User-<legacyUserId>-Aa`. The migration SQL first writes a valid unusable scrypt placeholder for every legacy row, then `prisma:migrate:lab3` and the seed repair step derive the per-user scrypt hash. The plaintext value is not stored or returned.

Authentication endpoints are under `/api/auth`: login, current-user discovery, password change, and logout. Sessions use an HttpOnly `toktickit_session` cookie and a non-HttpOnly `toktickit_csrf` cookie for mutation protection. Normal protected API requests derive identity from the session, not from client-supplied requester or role fields.

The fixed seed contains four active Requesters, one inactive Requester, three active IT Staff, one inactive IT Staff, one active Administrator, the four required Categories, seven Related Systems, Tickets across the documented statuses, and communication records. Re-running it is idempotent.

## Lab 2 evidence

Real Playwright screenshots are stored under `artifacts/lab-02/screenshots/create-ticket/`, `artifacts/lab-02/screenshots/my-tickets/`, and `artifacts/lab-02/screenshots/ticket-detail/` for desktop `1440 x 900`, tablet `834 x 1112`, and mobile `390 x 844`. The individual Lab 2 Answer Sheet and final PDF are prepared and submitted on the course platform, not stored in this repository. Any local submission output and temporary render files remain ignored by Git.

## Lab 3 database preparation

Start PostgreSQL, apply all migrations, generate the Prisma client, and seed the fixed Lab 3 data:

    npm run db:up
    npm run prisma:migrate:lab3 --workspace server
    npm run db:seed

The repeatable seed preserves the four Lab 1 Categories and seven Lab 2 Related Systems, converts or upserts the required Users, and adds the Lab 3 workflow fixtures without duplicate Tickets, comments, or notes.

## Lab 1 Git workflow

Use main as the stable branch and lab1-staging as the integration branch. Implement each Issue on its required feature branch and open its Pull Request into lab1-staging:

- feature/1-project-foundation
- feature/2-health-check
- feature/3-category-seed
- feature/4-category-list

Every Pull Request requires peer review and updates the Lab 1 review records in docs/lab-01/.
