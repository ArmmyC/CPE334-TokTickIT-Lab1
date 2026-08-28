# Lab 2 E2E and Visual Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the dedicated Lab 2 test database guard, runnable Playwright requester flow, responsive visual evidence, and traceable final test results for Issue #19.

**Architecture:** Build on the reviewed PR #26 merge in `origin/lab2-staging`. Add a separate PostgreSQL service on host port 5434, guard all test-database destructive commands with an exact `/toktickit_test` URL check, and run the real Express API plus Vite client under Playwright. Keep product code unchanged unless a failing E2E or responsive assertion proves a defect.

**Tech Stack:** Node.js 24, npm workspaces, TypeScript, Express, Prisma, PostgreSQL 16, React 19, Vite, Vitest, Testing Library, Playwright Test, Docker Compose, and PNG screenshot artifacts.

**Spec:** `docs/lab-02/specification.md`, `docs/lab-02/api-spec.md`, `docs/lab-02/ui-spec.md`, `docs/lab-02/tests.md`, and Lab 2 sheet Sections 9 through 14.

## Global Constraints

- Work only on `feature/7-lab2-e2e-visual`, based on the reviewed `origin/lab2-staging` merge of PR #26.
- Do not add authentication, IT Staff controls, comments, Actions Taken, or post-creation status transitions.
- The test database is `toktickit_test` on host port `5434`, and the guard rejects every other database before destructive commands.
- Playwright covers desktop `1440x900`, tablet `834x1112`, and mobile `390x844`.
- Every new behavior follows red, green, refactor, and no test is skipped or disabled.
- Use ASCII hyphens in code, documentation, comments, and commit messages.

### Task 1: Baseline

**Files:** existing repository state only.

- [x] Confirm the clean branch and that `HEAD` equals `origin/lab2-staging` at merge commit `6f7c3d3`.
- [x] Run `npm test` and `npm run build`, recording the actual baseline counts of 57 server tests and 28 client tests after the reviewed Lab 2 merges.
- [x] Keep `docs/lab-02/tests.md` unchanged until final evidence is freshly verified.

### Task 2: Dedicated test database and safety guard

**Files:**
- Create: `.env.test.example`
- Create: `scripts/test-db-guard.mjs`
- Create: `scripts/test-db-prepare.mjs`
- Create: `server/tests/lab-02/test-db-guard.test.ts`
- Modify: `docker-compose.yml`, `package.json`, `.gitignore`, and `README.md`

- [x] Write tests for missing, empty, malformed, development, similarly named, unsupported-protocol, valid, and port 5434 URLs. The valid helper is `assertTestDatabaseUrl(value)`.
- [x] Run the focused Vitest file and observe failure because the guard module is missing.
- [x] Implement the pure guard with `new URL`, accepted protocols `postgresql:` and `postgres:`, and exact pathname `/toktickit_test`. It throws a safe message for all other values.
- [x] Run the focused tests and observe green.
- [x] Implement `test-db-prepare.mjs` so it loads `.env.test`, validates before spawning anything, and then runs from `server`: `npx prisma migrate reset --force --skip-seed`, `npx prisma migrate deploy`, and `npx tsx prisma/seed.ts`, propagating failures without printing secrets.
- [x] Add `db-test` with its own volume and port 5434 to Compose, add `.env.test.example`, and add root scripts `db:test:up` and `test:db:prepare`.
- [x] Document copying `.env.test.example`, starting the test service, preparing it, and running E2E. Keep `.env.test` ignored.
- [x] Create the local ignored `.env.test`, run `npm run db:test:up` and `npm run test:db:prepare`, and verify four Categories, seven Related Systems, four active Requesters, and one inactive Requester.

### Task 3: Playwright configuration and requester flow

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/lab-02/requester-ticket-flow.spec.ts`
- Modify: `package.json` and `package-lock.json`

- [x] Add `@playwright/test` as a development dependency.
- [x] Configure three serial projects named `desktop`, `tablet`, and `mobile` at `1440x900`, `834x1112`, and `390x844`, with base URL `http://127.0.0.1:5183`, API web server on port 4000 using `.env.test`, and Vite web server on port 5183.
- [x] Add `e2e:server`, `e2e:client`, and `test:e2e` root scripts.
- [x] Write the E2E assertions before fixing product behavior. The test selects an active requester, verifies the inactive requester is absent, creates a unique ticket, asserts the backend Ticket Number and NEW status, searches My Tickets, opens read-only Detail, uploads a small PDF, soft-removes it with a reason, verifies metadata remains and content actions disappear, switches requester, verifies isolation and safe not-found behavior, checks mobile navigation, and asserts `scrollWidth <= innerWidth`.
- [x] Save real full-page screenshots using `testInfo.project.name` under the three required Create Ticket, My Tickets, and Ticket Detail directories.
- [x] Run `npm run test:e2e` and record the first setup or assertion failure.

### Task 4: Evidence-driven corrections

**Files:** only files identified by a failing assertion, plus focused regression tests.

- [x] For each failure, write or update the smallest failing test and run it alone.
- [x] Implement only the minimal correction consistent with the approved contract and Lab 2 exclusions.
- [x] Run the focused regression, then the complete three-project E2E suite.

### Task 5: Traceability and visual evidence

**Files:**
- Modify: `docs/lab-02/tests.md`, `docs/lab-02/ui-spec.md`, and `README.md` if needed
- Create: real PNGs under `artifacts/lab-02/screenshots/create-ticket/`, `my-tickets/`, and `ticket-detail/`

- [x] Inspect generated PNGs at native dimensions for clipping, overlap, hidden controls, unreadable text, inconsistent buttons, and horizontal overflow.
- [x] Mark visual checklist items and planned tests as Pass only when backed by fresh output and actual file paths.
- [x] Add the date, environment prerequisites, exact Vitest counts, build result, E2E project count, screenshot paths, and genuine limitations to `tests.md`.

### Task 6: Review handoff

- [ ] Run `npm run db:test:up`, `npm run test:db:prepare`, `npm test`, `npm run build`, `npm run test:e2e`, and `git diff --check`.
- [ ] Confirm `.env.test`, database data, storage bytes, traces, and secrets are not tracked.
- [ ] Commit and push only `feature/7-lab2-e2e-visual`.
- [ ] Open a linked PR to `lab2-staging`, request Bank848, move Issue #19 to `PR Review`, reply to every review comment, and leave merging to Bank848.

## Self-Review Checklist

- [ ] Guard rejects every non-test database before destructive work.
- [ ] Seed counts and inactive-requester exclusion are verified on the dedicated database.
- [ ] E2E proves the complete requester, ticket, attachment, ownership, and responsive flow.
- [ ] All three viewport evidence groups contain real readable PNGs.
- [ ] Final documentation contains only evidence-backed statuses.
- [ ] No excluded Lab 3 functionality was added.
- [ ] Branch is clean, pushed, linked to Issue #19, and unmerged by the author.
