# Lab 1 Test Evidence

Issue #2 adds the first real API call and verifies both successful and unavailable-backend states.

| Test file | Tool | Test description | Current result |
| --- | --- | --- | --- |
| server/tests/lab-01/foundation.test.ts | Vitest | Express application is created | Passed |
| server/tests/lab-01/health.test.ts | Supertest | GET /api/health returns the required JSON response | Passed |
| client/tests/lab-01/App.test.tsx | Vitest | Real health call displays online and offline status | Passed |

Run the foundation checks from the repository root:

    npm run build
    npm test

Final evidence will include the category Supertest checks and the loading, success, and error UI checks required by the labsheet.
