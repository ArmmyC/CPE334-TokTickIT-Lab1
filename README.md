# TokTickIT

TokTickIT is the CPE334 Lab 1 IT service-desk starter. This first increment establishes the React, Express, Prisma, PostgreSQL, and test tooling that later Lab 1 Issues build on.

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

5. Generate the Prisma client:

       npm run prisma:generate --workspace server

6. Start the application:

       npm run dev

The Vite frontend runs at http://localhost:5183 and the Express server runs at http://localhost:4000.

## Tests and build

Run the configured unit and API test commands:

    npm test

Build both workspaces:

    npm run build

## Lab 1 Git workflow

Use main as the stable branch and lab1-staging as the integration branch. Implement each Issue on its required feature branch and open its Pull Request into lab1-staging:

- feature/1-project-foundation
- feature/2-health-check
- feature/3-category-seed
- feature/4-category-list

Every Pull Request requires peer review and updates the Lab 1 review records in docs/lab-01/.
