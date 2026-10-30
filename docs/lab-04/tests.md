# Lab 4 Test Plan

**Status:** Student-approved plan with verified results recorded below. Remaining cases are Planned. Results here are branch-level validation, not final verification from `main`.
**Contract:** `docs/lab-04/specification.md`
**Implementation gate:** the student approved all four contract documents. Contract PR #71 and Issues #65/#66 PRs #72/#73 were reviewed and merged to `lab4-staging`. This branch implements Issue #67.

## 1. Test Strategy

Use the existing Vitest, Supertest, Testing Library, and Playwright setup. Add tests before implementation for each Issue. Keep the complete Lab 1–3 suites enabled. The server remains the source of truth for authorization, workflow rules, versions, dashboard calculations, and safe failures.

Every new test remains **Planned** until it has actually run. Do not mark a test Pass based on intended behavior, a screenshot, or a partial run. Do not skip or disable a failing test to make a command pass.

Test database safety follows the Lab 3 guard: destructive preparation must verify the database pathname is exactly `/toktickit_test`. Migration tests use a unique disposable PostgreSQL schema and never reset the development database.

## 2. Test Inventory

| Test ID | Type | Requirement / AC | What it tests | Expected result | Automated test file | Final status |
| --- | --- | --- | --- | --- | --- | --- |
| UNIT-01 | Unit | BR-07–BR-10, AC-01, AC-04, AC-19 | Action field parsing, trimming, lengths, future timestamps, follow-up note/completion invariants, UTC conversion | Valid boundaries pass; completion cannot be true when follow-up is not required or on creation; invalid values return field errors without persistence | `server/tests/lab-04/action-validation.test.ts` | Pass, 8 tests |
| UNIT-02 | Unit | BR-06, BR-08, AC-05, AC-06 | Complete status matrix, confirmation rules, resolution gate | Only allowed transitions with required confirmation pass; gate failure leaves state unchanged | `server/tests/lab-04/workflow-rules.test.ts` | Pass, 4 tests |
| UNIT-03 | Unit | BR-16–BR-21, AC-09–AC-11 | Dashboard status sets, seven-day boundaries, zero counts, role-specific activity windows, stable sort | Counts and list ordering match fixed-clock fixtures | `server/tests/lab-04/dashboard-metrics.test.ts` | Planned |
| MIG-01 | Migration / regression | BR-12, BR-13, BR-22, BR-23, AC-07, AC-12 | Apply migration to populated Lab 3 schema, compare old table IDs/counts/relationships/statuses, create truthful history baseline and activity timestamps, verify legacy baselines are not recent resolution events, then issue raw database UPDATE and DELETE against a history row in separate transactions | Existing business rows are preserved; legacy Tickets have zero Actions Taken and one labeled baseline event; each raw history mutation is rejected by the database trigger and the row remains unchanged; failed migration can be recovered in disposable schema | `server/tests/lab-04/migration.test.ts` | Pass, 2 tests |
| SEED-01 | Seed / integration | BR-24, AC-13 | Run Lab 4 seed repeatedly and verify stable IDs, role/status/priority combinations, ownership, action counts, and metric fixtures | No duplicates or password changes; zero and non-zero metrics remain available | `server/tests/lab-04/seed.test.ts` | Pass, 1 test |
| API-01 | API / integration | FR-01–FR-03, AC-01, AC-02, AC-19 | Create multiple Actions Taken on one Ticket, default follow-up completion, auto performer, separate Owner, preserve performer on edit, complete a required follow-up in place, record latest editor | API returns correct Ticket/performer/editor; completion preserves `followUpRequired`; the server never trusts client actor, owner, or create-time completion fields | `server/tests/lab-04/actions-taken.api.test.ts` | Pass, 6 tests |
| API-02 | Authorization | FR-04, FR-21, BR-26, AC-03, AC-20 | Requester read-only ownership, Staff/Admin writes, unauthorized roles, missing session, CSRF, foreign Ticket id, create/edit on terminal Tickets and after reopen | Backend denies forbidden writes, scopes Requesters to their own Ticket, returns safe 401/403/404, rejects changed terminal-state writes with `409 ACTION_TAKEN_LOCKED`, then permits writes after reopen | `server/tests/lab-04/actions-taken.api.test.ts` | Pass, 6 tests |
| API-03 | API / integration | FR-06–FR-09, BR-15, AC-05–AC-07, AC-19 | Status transition matrix, confirmation, resolution gate against required follow-up completion, initial/transition/baseline history, ordering, visibility, update/delete prohibition, serialization contract with concurrent Action Taken changes | Successful transitions append exactly one visible event; a Ticket with any incomplete required follow-up cannot resolve, and completion passes without clearing the required flag; rejected transitions do not change Ticket or history; both write paths acquire the parent Ticket lock before reading or changing gate inputs | `server/tests/lab-04/ticket-workflow.api.test.ts` | Partial, 29 API tests pass including lock-order assertions; real database concurrency awaits test PostgreSQL. History trigger protection passed in the prior MIG-01 run |
| API-04 | Concurrency / retry | FR-16, BR-11, BR-14, BR-15, AC-08 | Simultaneous POSTs by the same actor with the same key/Ticket/payload, replay after an edit, mismatched key reuse, stale Action version including an identical retry after a lost response, stale Ticket version after status, Owner, IT Priority, Requester resolution, or Action Taken writes, and concurrent Action Taken/status writes | New Tickets start at version 0 and Actions Taken at version 1; a successful changed action write bumps each applicable version once; concurrent duplicate POSTs produce one row and successful original/replay responses with no extra replay version bump, never a 500; an identical stale PATCH returns the current row as replayed without a version bump; changed stale payloads return 409 and preserve current state; Ticket version changes invalidate an older status form; gate checks serialize for one Ticket | `server/tests/lab-04/actions-taken.api.test.ts`, `server/tests/lab-04/ticket-workflow.api.test.ts` | Partial, sequential retry and stale-version cases pass; database concurrency cases await test database |
| API-05 | API / integration | FR-10–FR-13, BR-20, AC-03, AC-09, AC-11 | Requester role access, dashboard counts, recent window, latest real resolution-transition logic, ownership isolation, zero metrics, exact-window drill-down filters, allowed requester dashboard fields, exclusion of Internal Note content and staff-only activity | Only the authenticated Requester's Tickets and approved fields are returned; requester-visible IT Priority is included, Owner and Internal Note content are excluded, Internal Notes do not affect requester recent counts/timestamps, and baseline events do not masquerade as recent resolutions | `server/tests/lab-04/requester-dashboard.api.test.ts` | Planned |
| API-06 | API / integration | FR-10–FR-13, AC-10, AC-11 | Staff/Admin access and Requester denial, unassigned/current-user-owned/current-user Actions Taken/status/priority counts, hidden Internal Note activity, zero counts, exact-window drill-down filters | Server aggregates match database fixtures and actor-specific action queries do not confuse Owner with performer | `server/tests/lab-04/staff-dashboard.api.test.ts` | Planned |
| API-07 | API / regression | FR-20, AC-18 | Ticket Owner assignment to active eligible users and rejection of inactive/ineligible targets | Existing Owner remains unchanged after safe `409 OWNER_NOT_ELIGIBLE` | `server/tests/lab-04/ticket-workflow.api.test.ts` | Planned |
| UI-01 | UI component | FR-01–FR-05, FR-21, BR-26, AC-01–AC-04, AC-08, AC-14, AC-19, AC-20 | Staff create/list/edit modes, Requester read-only detail, distinct Owner and performer, required Follow-up Note, separate completion field, terminal read-only mode, validation, retained values and safe errors, and create-key reuse after an ambiguous network failure | Labeled forms and list states match `ui-spec.md`; completed follow-up retains the required flag; terminal-state controls are hidden with reopen guidance; retrying the same create request reuses its idempotency key; hidden controls do not replace API security | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass, 15 tests, 2026-10-30 |
| UI-02 | UI component | FR-06–FR-09, AC-05–AC-08, AC-14, AC-19 | Allowed status controls, confirmation, incomplete follow-up gate message, completed follow-up state, history timeline and conflict recovery | Only permitted transitions are offered; a blocked resolution explains which required follow-ups remain incomplete; history is stable/read-only and stale state can be refreshed | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass, 15 tests |
| UI-03 | UI component | FR-10–FR-13, AC-09, AC-11, AC-14 | Requester cards, recent Ticket rows, empty/loading/forbidden/failure states and drill-down links | Counts display API data and links preserve the selected metric scope | `client/tests/lab-04/RequesterDashboard.test.tsx` | Planned |
| UI-04 | UI component | FR-10–FR-13, AC-10, AC-11, AC-14 | Staff/Admin cards, current-user Actions Taken count/list, status/priority breakdown, recent Ticket rows and drill-down links | Counts display API data and link to matching Staff Queue/action filters | `client/tests/lab-04/StaffDashboard.test.tsx` | Planned |
| STYLE-01 | UI style | FR-18, AC-14 | Zen Green tokens, card and badge contrast, form labels/errors, focus, read-only and editable surfaces | New screens reuse Lab 2–3 tokens and keep required controls visually distinct | `client/tests/lab-04/VisualStyle.test.ts` | Planned |
| RESP-01 | Responsive | FR-18, AC-14, AC-17 | Dashboards, Actions Taken, status history at desktop 1440×900, tablet 834×1112, mobile 390×844 | No clipping, overlap, hidden action, or page-level horizontal overflow | `e2e/lab-04/actions-taken-flow.spec.ts`, `e2e/lab-04/ticket-resolution.spec.ts`, `e2e/lab-04/dashboards.spec.ts` | Partial, Actions Taken and Ticket status-history suites passed nine cases each across desktop/tablet/mobile; dashboard browser coverage remains Planned |
| A11Y-01 | Manual accessibility audit | FR-18, AC-14 | Manually audit keyboard traversal, visible focus, heading order, labels, error association, status/alert announcements, and dialog focus against the checklist | The auditor records completion and any findings in the Lab 4 workflow; this is a manual check in `docs/lab-04/ui-spec.md` Section 9, not a separate automated test file | `docs/lab-04/ui-spec.md` Section 9 checklist | Planned |
| REG-01 | Migration / regression | FR-17, AC-15, AC-18 | Existing authentication, password change, requester Ticket flows, Attachments, comments, notes, Staff operations, active Owner assignment, inactive/ineligible-assignee rejection, Admin user management | Labs 1–3 tests pass unchanged or with explicitly justified Lab 4 updates | Existing `server/tests/lab-01`, `server/tests/lab-02`, `server/tests/lab-03`, matching client and E2E suites | Partial, all 191 server and 106 client tests pass; all 39 browser cases passed either in the full run or isolated reruns, but the full run had two PostgreSQL type-cache failures during repeated schema resets |
| PERF-01 | Performance smoke | FR-10–FR-13, AC-16 | Dashboard aggregate queries and actor-scoped Actions Taken query against 1,000 seeded Tickets, 25 warm requests per endpoint | Proposed local test target: p95 under 1 second, no full Ticket collection loaded | `server/tests/lab-04/dashboard-performance-smoke.test.ts` | Planned |
| E2E-01 | E2E | AC-01–AC-04, AC-08, AC-14, AC-17, AC-18 | Staff creates multiple Actions Taken, edits one in place, assigns an active Owner, sees inactive/ineligible Owner rejection, requester sees read-only rows, auth, validation, retry and responsive views | Full browser flow matches API state; no duplicate action on repeat submission and Owner remains unchanged after rejection | `e2e/lab-04/actions-taken-flow.spec.ts` | Pass, 9 cases across desktop/tablet/mobile, 2026-10-30 |
| E2E-02 | E2E | AC-05–AC-08, AC-14, AC-17, AC-19, AC-20 | Allowed/forbidden status changes, resolve and close completion, cancellation, incomplete and completed follow-up gate, confirmation, reopen, terminal Action Taken lock, stable history, requester visibility | UI refreshes after success; a required follow-up can be completed without erasing its requirement; terminal Tickets lock Action Taken until reopened; invalid or stale changes preserve state with safe feedback | `e2e/lab-04/ticket-resolution.spec.ts` | Pass, 9 cases across desktop/tablet/mobile, 2026-10-30 |
| E2E-03 | E2E | AC-09–AC-11, AC-14, AC-17 | Requester and Staff/Admin dashboard metrics, current-user Actions Taken, empty states, ownership/role protection, drill-down | Displayed counts match API/database fixtures and links open the expected Ticket/action scope | `e2e/lab-04/dashboards.spec.ts` | Planned |
| VISUAL-01 | Manual visual evidence | AC-14, AC-17 | Real application screenshots for Staff dashboard, Requester dashboard, and Actions Taken at desktop/tablet/mobile | Each genuine image proves the named state, viewport, role, and responsive/accessibility checklist item | `artifacts/lab-04/screenshots/staff-dashboard/`, `requester-dashboard/`, `actions-taken/` | Partial, 12 genuine Actions Taken screenshots captured and inspected, four states across three viewports; dashboard screenshots remain Planned |

## 3. Acceptance-Criterion Traceability

| Acceptance criterion | Planned test IDs |
| --- | --- |
| AC-01 | API-01, UI-01, E2E-01 |
| AC-02 | API-01, UI-01, E2E-01 |
| AC-03 | API-02, API-05, API-06, E2E-01, E2E-03 |
| AC-04 | UNIT-01, API-01, UI-01, E2E-01 |
| AC-05 | UNIT-02, API-03, UI-02, E2E-02 |
| AC-06 | UNIT-02, API-03, UI-02, E2E-02 |
| AC-07 | API-03, UI-02, E2E-02 |
| AC-08 | API-04, UI-01, UI-02, E2E-01, E2E-02 |
| AC-09 | UNIT-03, API-05, UI-03, E2E-03 |
| AC-10 | UNIT-03, API-06, UI-04, E2E-03 |
| AC-11 | API-05, API-06, UI-03, UI-04, E2E-03 |
| AC-12 | MIG-01, REG-01 |
| AC-13 | SEED-01 |
| AC-14 | UI-01, UI-02, UI-03, UI-04, STYLE-01, RESP-01, A11Y-01, E2E-01, E2E-02, E2E-03 |
| AC-15 | REG-01 |
| AC-16 | PERF-01 |
| AC-17 | RESP-01, E2E-01, E2E-02, E2E-03, VISUAL-01 |
| AC-18 | API-07, REG-01, E2E-01 |
| AC-19 | UNIT-01, API-01, API-03, UI-01, UI-02, E2E-02 |
| AC-20 | API-02, UI-01, E2E-02 |

## 4. UI Style, Responsive, and Accessibility Checklist

- [ ] Existing Zen Green tokens, typography, surfaces, buttons, badges, feedback, and focus rules are used.
- [ ] Staff and Requester dashboards have loading, empty, forbidden, conflict, and safe-failure states.
- [ ] Actions Taken create/edit retains form values after recoverable failure and clearly identifies the original performer and latest editor.
- [ ] Requester view has no create/edit control and exposes only owned Ticket data.
- [ ] Status history is read-only, chronological, and role appropriate.
- [ ] At desktop 1440×900, tablet 834×1112, and mobile 390×844, no required action is clipped or obscured.
- [ ] No page-level horizontal overflow, card overlap, unreadable table, or inaccessible responsive navigation exists.
- [ ] Keyboard focus is visible, labels are associated, validation is announced, and focus returns after a dialog closes.
- [ ] Screenshot paths and captions are checked against the Lab 4 sheet order before Answer Sheet capture.

## 5. Complete Labs 1–3 Regression Inventory

The final regression run uses root `npm test` to run all server and client Vitest suites, not only the Lab 4 files. It includes:

- Every existing server test under `server/tests/lab-01/`, `server/tests/lab-02/`, and `server/tests/lab-03/`.
- Every existing client test under `client/tests/lab-01/`, `client/tests/lab-02/`, and `client/tests/lab-03/`.
- Lab 2 browser regression: `e2e/lab-02/requester-ticket-flow.spec.ts`.
- Lab 3 browser regression: `e2e/lab-03/authentication.spec.ts`, `e2e/lab-03/requester-ticket-flow.spec.ts`, `e2e/lab-03/staff-ticket-flow.spec.ts`, and `e2e/lab-03/user-administration.spec.ts`, run by root `npm run test:e2e`.
- Lab 3 migration regression: root `npm run test:lab3:migration`.
- The existing staff Ticket Detail API and E2E regression continue to verify active Owner assignment and inactive/ineligible target rejection.

## 6. Commands and Verification

Planned final commands after implementation and before the release PR:

```text
npm test
npm run build
npm run test:lab3:migration
npm test --workspace server -- tests/lab-04/migration.test.ts
npm test --workspace server -- tests/lab-04/seed.test.ts
npm run test:e2e
```

Run the targeted Lab 4 API and unit tests through the corresponding workspace Vitest command. Run dashboard performance smoke separately so its timing output is recorded. Run the test database guard before any destructive test preparation. The command block is the planned release-verification set; branch-level results are recorded below.

### Issue #65 branch verification, 2026-10-30

- `npm test` passed, 157 server tests and 76 client tests.
- `npx playwright test` passed, 21 Lab 2–3 browser checks across desktop, tablet, and mobile.
- `server/tests/lab-04/migration.test.ts`, `server/tests/lab-04/seed.test.ts`, and `server/tests/lab-03/migration.test.ts` passed, 4 integration tests total.
- `npm run build` passed for the server and client.
- The review regression checks passed, including rejection of impossible calendar dates and repair of the exact legacy seeded-completion state. The repaired action has a separate completion editor and version 2, its Ticket version increments once, and a repeated seed leaves both unchanged.
- During an earlier `npm test` run that overlapped Playwright, `RequesterTicketDetail.test.tsx` failed once because its deferred API response resolver had not yet been set. The targeted file passed alone, then the complete `npm test` rerun passed after Playwright ended. No Lab 2 or Lab 3 source or test files were changed.

These results validate the current Issue #65 branch. They do not replace the required final regression and evidence verification from `main` after the reviewed release merge.

### Issue #66 branch verification, 2026-10-30

- `npm test --workspace server -- tests/lab-04/ticket-workflow.api.test.ts tests/lab-04/actions-taken.api.test.ts --reporter=dot` passed, 36 tests. `server/tests/lab-04/workflow-rules.test.ts` passed, 4 tests.
- `npm test --workspace client -- tests/lab-04/TicketWorkflow.test.tsx --reporter=dot` passed, 15 tests. The complete client suite passed, 91 tests.
- `npm test --workspace server -- --exclude tests/lab-03/migration.test.ts --exclude tests/lab-04/migration.test.ts --exclude tests/lab-04/seed.test.ts --reporter=dot` passed, 187 tests in 20 files. The three excluded files require PostgreSQL.
- `npm run build` passed for the server and client.
- `npx playwright test e2e/lab-04/ticket-resolution.spec.ts --list` discovered 9 cases across desktop, tablet, and mobile. The E2E execution did not start because `npm run test:e2e` requires Docker, which is unavailable. No container runtime or PostgreSQL service was present at `localhost:5434`. A temporary PostgreSQL 16 cluster also could not initialize because the installed binaries lack `share/postgres.bki`; the empty temporary folder was removed.
- The first full `npm test` run also caught an outdated Lab 3 mock expectation for the new Ticket version/activity updates. That expectation was updated, and the database-free server suite then passed. Earlier client failures were stale Ticket Detail fixtures missing `statusHistory`; the fixtures were updated and the complete client suite passed.

The database-backed migration/seed suites, browser E2E runs, and final verification from `main` remain unverified. Do not treat the Issue #65 migration/seed result above as a substitute for rerunning them on the current release path.

### Issue #67 branch verification, 2026-10-30

- `npm test` passed sequentially, 191 server tests across 23 files and 105 client tests across 13 files. The database-backed migration and seed tests ran against the dedicated test database.
- `npm test --workspace client -- --reporter=dot tests/lab-04/ActionsTaken.test.tsx` passed, 14 tests, including draft retention and locking when a Ticket becomes terminal during a conflict refresh.
- `npm test --workspace server -- --reporter=dot tests/lab-04/actions-taken.api.test.ts` passed, 7 tests after generating the Prisma client.
- `npm run build` passed for the server and client.
- `npm run test:db:prepare` passed against the guarded `toktickit_test` database, applying all four migrations and seeding Lab 3 and Lab 4 records.
- The first guarded database preparation attempt stopped with Prisma `P1017` after two migrations. PostgreSQL logs showed the WSL distro shutting down the idle database connection; keeping the Ubuntu WSL session open during database work stabilized the dedicated container. A later guarded preparation applied all four migrations and seeded the database successfully.
- The first browser run exposed a wrong expected Owner after the test reassigned the Ticket, an unscoped alert assertion, and an ambiguous repeated field locator. The safe-failure flow also showed that its exact label selector could not match a required asterisk inside the label. The visible marker was moved outside the associated label, and the affected assertions were scoped to their correct Actions Taken region/card. Targeted reruns passed.
- `npx playwright test` ran all 39 existing Lab 2–4 browser cases. 37 passed; desktop and tablet runs of the Lab 3 Staff Ticket creation flow failed with PostgreSQL `XX000 cache lookup failed for type <OID>` after repeated per-test schema resets. Both failed cases passed when rerun individually with a fresh Playwright and API-server process. The E2E setup runs `prisma migrate reset` between tests while the API server's Prisma connection pool remains alive, which can leave a stale PostgreSQL type-cache entry. Record the full-suite command as Partial until it completes cleanly in one run.
- The full browser run passed all 9 Actions Taken cases and all 9 Ticket workflow/history cases across desktop/tablet/mobile. It captured 12 genuine screenshots in `artifacts/lab-04/screenshots/actions-taken/`, four states across all three viewports. The images were inspected for role, state, readability, and seeded-only data.

Dashboard browser coverage and screenshots, the manual accessibility audit, and final verification from `main` remain outstanding. The full browser suite also needs one clean run because repeated schema resets intermittently invalidate the still-running API server's PostgreSQL type cache. Do not claim final verification until the required tests and evidence are verified from `main`.

## 7. Final Status Rules

- New tests begin as Planned.
- Mark Pass only after the named command/file has run successfully and its output has been inspected.
- Record failures, fixes, and reruns without deleting the first failure from the evidence.
- Do not claim final completion until the required tests and screenshots have been verified from `main`.
