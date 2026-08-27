# TokTickIT

TokTickIT is the CPE334 Lab 1 IT service-desk starter. This first increment establishes the React, Express, Prisma, PostgreSQL, and test tooling that later Lab 1 Issues build on.

Lab 2 extends that foundation with Development Requesters, Related Systems, Tickets, and attachment metadata. Attachment bytes are stored locally under the ignored `server/storage/attachments/` directory and are never committed.

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

5. Create the initial database table and generate the Prisma client:

       npm run prisma:migrate --workspace server
       npm run prisma:generate --workspace server

6. Seed the four supported request categories:

       npm run db:seed

7. Start the application:

       npm run dev

The Vite frontend runs at http://localhost:5183 and the Express server runs at http://localhost:4000.

The web page displays a `Check System` button. Clicking it calls `GET /api/health` and `GET /api/categories`; the page then shows the backend status and the seeded category IDs and names in ascending ID order. Loading, success, and useful error states are displayed while the requests run.

## Tests and build

Run the configured unit and API test commands:

    npm test

Build both workspaces:

    npm run build

Prepare the isolated Lab 2 test database and run the Playwright requester flow:

    Copy .env.test.example to .env.test and replace the local credentials.
    npm run test:e2e

The E2E script starts the test service on PostgreSQL host port 5434, validates that `DATABASE_URL` points to the `toktickit_test` database, resets and seeds it, then starts the API and client. The preparation guard rejects missing, malformed, development, or differently named database URLs before running reset, migration, or seed commands. Never commit `.env.test`.

## Lab 2 database preparation

Start PostgreSQL, apply the Lab 2 migration, generate the Prisma client, and seed the fixed reference data:

    npm run db:up
    npm run prisma:migrate:lab2 --workspace server
    npm run prisma:generate --workspace server
    npm run db:seed

The repeatable seed preserves the four Lab 1 Categories and upserts seven Related Systems, four active Development Requesters, and one inactive Development Requester. Re-running it does not create duplicate rows.

## Lab 1 Git workflow

Use main as the stable branch and lab1-staging as the integration branch. Implement each Issue on its required feature branch and open its Pull Request into lab1-staging:

- feature/1-project-foundation
- feature/2-health-check
- feature/3-category-seed
- feature/4-category-list

Every Pull Request requires peer review and updates the Lab 1 review records in docs/lab-01/.
