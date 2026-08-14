# Lab 1 Test Evidence

Issues #2 and #3 add the first real API call and a deterministic seed test for the four required request categories. The live Prisma seed command still requires a running PostgreSQL service.

| Test file | Tool | Test description | Current result |
| --- | --- | --- | --- |
| server/tests/lab-01/foundation.test.ts | Vitest | Express application is created | Passed |
| server/tests/lab-01/health.test.ts | Supertest | GET /api/health returns the required JSON response | Passed |
| client/tests/lab-01/App.test.tsx | Vitest | Real health call displays online and offline status | Passed |
| server/tests/lab-01/category-seed.test.ts | Vitest | Required categories are created once when the seed runs twice | Passed |

Run the foundation checks from the repository root:

    npm run build
    npm test

Final evidence will include the health and category Supertest checks, the idempotent seed check, and the loading, success, and error UI checks required by the labsheet.
