# Lab 1 Test Evidence

Issues #2, #3, and #4 now cover the health API, deterministic category seed, and Prisma-backed category list. Live seed/list verification still requires a running PostgreSQL service.

| Test file | Tool | Test description | Current result |
| --- | --- | --- | --- |
| server/tests/lab-01/foundation.test.ts | Vitest | Express application is created | Passed |
| server/tests/lab-01/health.test.ts | Supertest | GET /api/health returns the required JSON response | Passed |
| client/tests/lab-01/App.test.tsx | Vitest | Real health call displays online and offline status | Passed |
| server/tests/lab-01/category-seed.test.ts | Vitest | Required categories are created once when the seed runs twice | Passed |
| server/tests/lab-01/categories.test.ts | Supertest | GET /api/categories returns IDs and names ordered by ascending ID | Passed |
| client/tests/lab-01/App.test.tsx | Vitest | API categories render after loading and show an error when the category request fails | Passed |

Run the foundation checks from the repository root:

    npm run build
    npm test

Final evidence includes the health and category Supertest checks, the idempotent seed check, and the loading, success, and error UI checks required by the labsheet.
