# Lab 1 Test Evidence

The foundation increment provides smoke tests for both workspaces. The endpoint and integrated UI tests will be added with Issues #2–#4.

| Test file | Tool | Test description | Current result |
| --- | --- | --- | --- |
| server/tests/lab-01/foundation.test.ts | Vitest | Express application is created | Passed |
| client/tests/lab-01/App.test.tsx | Vitest | TokTickIT heading renders | Passed |

Run the foundation checks from the repository root:

    npm run build
    npm test

Final evidence will include the Supertest health/category checks and the loading, success, and error UI checks required by the labsheet.
