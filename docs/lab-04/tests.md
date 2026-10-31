# Lab 4 Test Plan

**Status:** Student-approved plan with branch-level verification recorded below. Final release verification from `main` remains pending.
**Contract:** `docs/lab-04/specification.md`
**Implementation gate:** the student approved all four contract documents. Contract PR #71 and Issues #65–#68 PRs #72–#75 were reviewed and merged to `lab4-staging`. This branch implements Issue #69.

## 1. Test Strategy

Use the existing Vitest, Supertest, Testing Library, and Playwright setup. Add tests before implementation for each Issue. Keep the complete Lab 1–3 suites enabled. The server remains the source of truth for authorization, workflow rules, versions, dashboard calculations, and safe failures.

Every new test remains **Planned** until it has actually run. Do not mark a test Pass based on intended behavior, a screenshot, or a partial run. Do not skip or disable a failing test to make a command pass.

Test database safety follows the Lab 3 guard: destructive preparation must verify the database pathname is exactly `/toktickit_test`. Migration tests use a unique disposable PostgreSQL schema and never reset the development database.

## 2. Test Inventory

| Test ID | Type | Requirement / AC | What it tests | Expected result | Automated test file | Final status |
| --- | --- | --- | --- | --- | --- | --- |
| UNIT-01 | Unit | BR-07–BR-10, AC-01, AC-04, AC-19 | Action field parsing, trimming, lengths, future timestamps, follow-up note/completion invariants, UTC conversion | Valid boundaries pass; completion cannot be true when follow-up is not required or on creation; invalid values return field errors without persistence | `server/tests/lab-04/action-validation.test.ts` | Pass, 8 tests |
| UNIT-02 | Unit | BR-06, BR-08, AC-05, AC-06 | Complete status matrix, confirmation rules, resolution gate | Only allowed transitions with required confirmation pass; gate failure leaves state unchanged | `server/tests/lab-04/workflow-rules.test.ts` | Pass, 4 tests |
| UNIT-03 | Unit | BR-16–BR-21, AC-09–AC-11 | Dashboard status sets, seven-day boundaries, zero counts, role-specific activity windows, stable sort | Counts and list ordering match fixed-clock fixtures | `server/tests/lab-04/dashboard-metrics.test.ts` | Pass, 1 test |
| MIG-01 | Migration / regression | BR-12, BR-13, BR-22, BR-23, AC-07, AC-12 | Apply migration to populated Lab 3 schema, compare old table IDs/counts/relationships/statuses, create truthful history baseline and activity timestamps, verify legacy baselines are not recent resolution events, then issue raw database UPDATE and DELETE against a history row in separate transactions | Existing business rows are preserved; legacy Tickets have zero Actions Taken and one labeled baseline event; each raw history mutation is rejected by the database trigger and the row remains unchanged; failed migration can be recovered in disposable schema | `server/tests/lab-04/migration.test.ts` | Pass, 2 tests |
| SEED-01 | Seed / integration | BR-24, AC-13 | Run Lab 4 seed repeatedly and verify stable IDs, role/status/priority combinations, ownership, action counts, and metric fixtures | No duplicates or password changes; zero and non-zero metrics remain available | `server/tests/lab-04/seed.test.ts` | Pass, 1 test |
| API-01 | API / integration | FR-01–FR-03, AC-01, AC-02, AC-19 | Create multiple Actions Taken on one Ticket, default follow-up completion, auto performer, separate Owner, preserve performer on edit, complete a required follow-up in place, record latest editor | API returns correct Ticket/performer/editor; completion preserves `followUpRequired`; the server never trusts client actor, owner, or create-time completion fields | `server/tests/lab-04/actions-taken.api.test.ts` | Pass, covered by the 8-test Actions Taken API suite |
| API-02 | Authorization | FR-04, FR-21, BR-26, AC-03, AC-20 | Requester read-only ownership, Staff/Admin writes, unauthorized roles, missing session, CSRF, foreign Ticket id, create/edit on terminal Tickets and after reopen | Backend denies forbidden writes, scopes Requesters to their own Ticket, returns safe 401/403/404, rejects changed terminal-state writes with `409 ACTION_TAKEN_LOCKED`, then permits writes after reopen | `server/tests/lab-04/actions-taken.api.test.ts` | Pass, covered by the 8-test Actions Taken API suite |
| API-03 | API / integration | FR-06–FR-09, BR-15, AC-05–AC-07, AC-19 | Status transition matrix, confirmation, resolution gate against required follow-up completion, initial/transition/baseline history, ordering, visibility, update/delete prohibition, serialization contract with concurrent Action Taken changes | Successful transitions append exactly one visible event; a Ticket with any incomplete required follow-up cannot resolve, and completion passes without clearing the required flag; rejected transitions do not change Ticket or history; both write paths acquire the parent Ticket lock before reading or changing gate inputs | `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass, 30 tests including real PostgreSQL concurrency, lock-order assertions, and immutable-history regression |
| API-04 | Concurrency / retry | FR-16, BR-11, BR-14, BR-15, AC-08 | Simultaneous POSTs by the same actor with the same key/Ticket/payload, replay after an edit, mismatched key reuse, stale Action version including an identical retry after a lost response, stale Ticket version after status, Owner, IT Priority, Requester resolution, or Action Taken writes, and concurrent Action Taken/status writes | New Tickets start at version 0 and Actions Taken at version 1; a successful changed action write bumps each applicable version once; concurrent duplicate POSTs produce one row and successful original/replay responses with no extra replay version bump, never a 500; an identical stale PATCH returns the current row as replayed without a version bump; changed stale payloads return 409 and preserve current state; Ticket version changes invalidate an older status form; gate checks serialize for one Ticket | `server/tests/lab-04/actions-taken.api.test.ts`, `server/tests/lab-04/ticket-workflow.api.test.ts` | Pass, PostgreSQL-backed duplicate create, stale edit, and Action Taken/resolution race cases passed |
| API-05 | API / integration | FR-10–FR-13, BR-20, AC-03, AC-09, AC-11 | Requester role access, dashboard counts, recent window, latest real resolution-transition logic, ownership isolation, zero metrics, exact-window drill-down filters, allowed requester dashboard fields, exclusion of Internal Note content and staff-only activity | Only the authenticated Requester's Tickets and approved fields are returned; requester-visible IT Priority is included, Owner and Internal Note content are excluded, Internal Notes do not affect requester recent counts/timestamps, and baseline events do not masquerade as recent resolutions | `server/tests/lab-04/requester-dashboard.api.test.ts` | Pass, 5 tests |
| API-06 | API / integration | FR-10–FR-13, FR-22, BR-27, AC-10, AC-11 | Staff/Admin dashboard access and Requester denial, Admin read/filter access to the Staff Queue for dashboard drill-downs, unchanged mutation authorization, unassigned/current-user-owned/current-user Actions Taken/status/priority counts, hidden Internal Note activity, zero counts, exact-window drill-down filters | Server aggregates match database fixtures, Admin queue reads are scoped by authenticated identity and return only queue fields, Requester access is denied, and actor-specific action queries do not confuse Owner with performer | `server/tests/lab-04/staff-dashboard.api.test.ts` | Pass, 3 tests |
| API-07 | API / regression | FR-20, AC-18 | Ticket Owner assignment to active eligible users and rejection of inactive/ineligible targets | Existing Owner remains unchanged after safe `409 OWNER_NOT_ELIGIBLE` | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Pass, 8 regression tests including inactive/ineligible assignment preservation |
| UI-01 | UI component | FR-01–FR-05, FR-21, BR-26, AC-01–AC-04, AC-08, AC-14, AC-19, AC-20 | Staff create/list/edit modes, Requester read-only detail, distinct Owner and performer, required Follow-up Note, separate completion field, terminal read-only mode, validation, retained values and safe errors, and create-key reuse after an ambiguous network failure | Labeled forms and list states match `ui-spec.md`; completed follow-up retains the required flag; terminal-state controls are hidden with reopen guidance; retrying the same create request reuses its idempotency key; hidden controls do not replace API security | `client/tests/lab-04/ActionsTaken.test.tsx` | Pass, 17 tests, including form focus entry/return, validation focus preservation, and error association, 2026-10-31 |
| UI-02 | UI component | FR-06–FR-09, AC-05–AC-08, AC-14, AC-19 | Allowed status controls, confirmation, incomplete follow-up gate message, completed follow-up state, history timeline and conflict recovery | Only permitted transitions are offered; a blocked resolution explains which required follow-ups remain incomplete; history is stable/read-only and stale state can be refreshed | `client/tests/lab-04/TicketWorkflow.test.tsx` | Pass, 15 tests |
| UI-03 | UI component | FR-10–FR-13, AC-09, AC-11, AC-14 | Requester cards, recent Ticket rows, empty/loading/forbidden/failure states and drill-down links | Counts display API data and links preserve the selected metric scope | `client/tests/lab-04/RequesterDashboard.test.tsx` | Pass, 5 tests |
| UI-04 | UI component | FR-10–FR-13, FR-22, BR-27, AC-10, AC-11, AC-14 | Staff/Admin cards, current-user Actions Taken count/list, every status/priority breakdown count including zero, recent Ticket rows and drill-down links; Admin uses the same queue read-only and opens Admin Ticket Detail | Counts display API data and link to the exact matching queue/action filters; Admin sees no queue mutation controls and is routed to permitted Admin detail | `client/tests/lab-04/StaffDashboard.test.tsx` | Pass, 4 tests, 2026-10-30 |
| STYLE-01 | UI style | FR-18, AC-14 | Zen Green tokens, card and badge contrast, form labels/errors, focus, read-only and editable surfaces | New screens reuse Lab 2–3 tokens and keep required controls visually distinct | `client/tests/lab-04/VisualStyle.test.ts` | Pass, 3 contrast/focus/style tests |
| RESP-01 | Responsive | FR-18, AC-14, AC-17 | Dashboards, Actions Taken, status history at desktop 1440×900, tablet 834×1112, mobile 390×844 | No clipping, overlap, hidden action, or page-level horizontal overflow | `e2e/lab-04/actions-taken-flow.spec.ts`, `e2e/lab-04/ticket-resolution.spec.ts`, `e2e/lab-04/dashboards.spec.ts` | Pass, full 48-case suite and refreshed 12-case Actions Taken suite passed across all three viewports |
| A11Y-01 | Manual accessibility audit | FR-18, AC-14 | Manually audit keyboard traversal, visible focus, heading order, labels, error association, status/alert announcements, and dialog focus against the checklist | The auditor records completion and any findings in the Lab 4 workflow; this is a manual check in `docs/lab-04/ui-spec.md` Section 9, not a separate automated test file | `docs/lab-04/ui-spec.md` Section 9 checklist | Pass, manual source/visual review plus dashboard, Actions Taken, dialog, and validation focus tests; audit details and screen-reader limitation recorded in Section 9 |
| REG-01 | Migration / regression | FR-17, AC-15, AC-18 | Existing authentication, password change, requester Ticket flows, Attachments, comments, notes, Staff operations, active Owner assignment, inactive/ineligible-assignee rejection, Admin user management | Labs 1–3 tests pass unchanged or with explicitly justified Lab 4 updates | Existing `server/tests/lab-01`, `server/tests/lab-02`, `server/tests/lab-03`, matching client and E2E suites | Pass, serial server suite 204/204, client suite 124/124, and full Lab 2–4 browser suite 48/48; Lab 3 owner regression included |
| PERF-01 | Performance smoke | FR-10–FR-13, AC-16 | Dashboard aggregate queries and actor-scoped Actions Taken query against 1,000 seeded Tickets, 25 warm requests per endpoint | Proposed local test target: p95 under 1 second, no full Ticket collection loaded | `server/tests/lab-04/dashboard-performance-smoke.test.ts` | Pass, 1,000 Tickets, 25 requests per endpoint, Requester p95 16.2 ms and Staff p95 18.7 ms |
| E2E-01 | E2E | AC-01–AC-04, AC-08, AC-14, AC-17, AC-18 | Staff creates multiple Actions Taken, edits one in place, assigns an active Owner, sees inactive/ineligible Owner rejection, requester sees read-only rows, auth, validation, retry and responsive views | Full browser flow matches API state; no duplicate action on repeat submission and Owner remains unchanged after rejection | `e2e/lab-04/actions-taken-flow.spec.ts` | Pass, 12 cases across desktop/tablet/mobile, including keyboard-only creation, 2026-10-31 |
| E2E-02 | E2E | AC-05–AC-08, AC-14, AC-17, AC-19, AC-20 | Allowed/forbidden status changes, resolve and close completion, cancellation, incomplete and completed follow-up gate, confirmation, reopen, terminal Action Taken lock, stable history, requester visibility | UI refreshes after success; a required follow-up can be completed without erasing its requirement; terminal Tickets lock Action Taken until reopened; invalid or stale changes preserve state with safe feedback | `e2e/lab-04/ticket-resolution.spec.ts` | Pass, 9 cases across desktop/tablet/mobile, 2026-10-30 |
| E2E-03 | E2E | FR-22, BR-27, AC-09–AC-11, AC-14, AC-17 | Requester and Staff/Admin dashboard metrics, current-user Actions Taken, every status/priority breakdown drill-down including zero counts, empty states, ownership/role protection; Admin reads/filters Staff Queue and opens Admin Ticket Detail without Staff-only queue/status/Owner controls | Displayed counts match API/database fixtures; status and priority links open the exact selected filters; Admin queue access does not grant mutation privileges | `e2e/lab-04/dashboards.spec.ts` | Pass, 9 cases across desktop/tablet/mobile after status/priority count links, 2026-10-30 |
| VISUAL-01 | Manual visual evidence | AC-14, AC-17 | Real application screenshots for Staff dashboard, Requester dashboard, and Actions Taken at desktop/tablet/mobile | Each genuine image proves the named state, viewport, role, and responsive/accessibility checklist item | `artifacts/lab-04/screenshots/staff-dashboard/`, `requester-dashboard/`, `actions-taken/` | Pass, all 18 genuine Lab 4 images refreshed and visually inspected on 2026-10-31 |

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

- [x] Existing Zen Green tokens, typography, surfaces, buttons, badges, feedback, and focus rules are used.
- [x] Staff and Requester dashboards have loading, empty, forbidden, conflict, and safe-failure states.
- [x] Actions Taken create/edit retains form values after recoverable failure and clearly identifies the original performer and latest editor.
- [x] Requester view has no create/edit control and exposes only owned Ticket data.
- [x] Status history is read-only, chronological, and role appropriate.
- [x] At desktop 1440×900, tablet 834×1112, and mobile 390×844, no required action is clipped or obscured.
- [x] No page-level horizontal overflow, card overlap, unreadable table, or inaccessible responsive navigation exists.
- [x] Keyboard focus is visible, labels are associated, validation is announced, and focus returns after a dialog closes or an inline Actions Taken form is canceled/saved.
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

Planned branch verification commands:

```text
npm run test:db:prepare
npm test --workspace server -- --maxWorkers=1 --minWorkers=1
npm test --workspace client
npm run build
npm run test:lab3:migration
npm run test:e2e
```

Run the test database guard before destructive test preparation. Run dashboard performance smoke separately so its timing output is recorded. If the Windows shell cannot access the WSL Docker CLI, start the already-available dedicated test database through WSL, rerun `npm run test:db:prepare`, then run `npx playwright test`. Branch-level results are recorded below.

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

At the Issue #67 handoff, dashboard browser coverage and screenshots were still outstanding. Issue #68 now adds and verifies that coverage. The manual accessibility audit and final verification from `main` remain outstanding. A prior browser run exposed PostgreSQL type-cache errors after repeated schema resets; the test database preparation was changed before Issue #68 and the complete 48-case Lab 2–4 browser run then passed. Do not claim final verification until the required tests and evidence are verified from `main`.

### Issue #68 branch verification, 2026-10-31

- `npm run build` passed for the server and client.
- `npm test --workspace server -- --maxWorkers=1 --minWorkers=1` passed in the Playwright Docker environment, 200 tests across 26 files. `npm test --workspace client` passed, 115 tests across 15 files.
- `npm run test:db:prepare` passed against the guarded dedicated `toktickit_test` database.
- The complete Lab 2–4 browser suite passed 48 cases after the test database preparation fix. Following the status/priority count drill-down refinement, the focused dashboard browser suite passed all 9 cases across desktop, tablet, and mobile in the Playwright Docker environment.
- The first full browser run before the database-preparation fix passed 45 of 48 cases and failed three legacy Ticket creation flows after `scripts/test-db-prepare.mjs` repeatedly ran `prisma migrate reset` while the Playwright API server and its Prisma client stayed alive. PostgreSQL reported `XX000 cache lookup failed for type <oid>`. Investigation traced the failure to schema/enum type recreation and the long-lived server connection pool, not the dashboard endpoints.
- `scripts/test-db-prepare.mjs` now applies pending migrations without dropping the schema, truncates only data tables in the guarded `public` schema while preserving `_prisma_migrations`, restarts identities, and reseeds. The full browser suite then passed 48 of 48 cases without the stale-type failures.
- Dashboard browser coverage verifies Requester ownership and Staff/Admin scopes, displayed metric agreement with API data, exact metric/status/priority drill-down filters including zero-count rows, Admin read-only queue access, no horizontal overflow, focused page headings, keyboard metric order, a keyboard-focused status count with a visible gold outline, and Enter activation. Six genuine dashboard summary images were refreshed at 1440×900, 834×1112, and 390×844 and visually inspected.
- Default-parallel combined test attempts had environment-specific failures: the Windows run could not reach the WSL PostgreSQL port; one Docker run had three unrelated 5-second timeouts under concurrent load; another had one non-reproduced client failure. The serial server suite passed 200/200, and the complete client suite passed independently, 115/115. These attempts are recorded so the verified commands and runner environment remain clear.
- The dashboard keyboard checks do not replace the full manual accessibility audit in Section 9. Performance smoke, final visual/accessibility review, and verification from `main` remain open for the later final-hardening and release steps.

### Issue #69 branch verification, 2026-10-31

- `npm run test:db:prepare` passed against the guarded dedicated `toktickit_test` database, with all four migrations applied and Lab 3 and Lab 4 fixtures reseeded.
- `npm test --workspace server -- --maxWorkers=1 --minWorkers=1` passed, 204 tests across 27 files. This includes Lab 3 and Lab 4 migration tests, seed tests, PostgreSQL-backed duplicate Action Taken creation, stale edits, resolution serialization, and inactive Owner regression coverage.
- `npm test --workspace client` passed, 124 tests across 16 files after the inline-form focus change. The focused `client/tests/lab-04/ActionsTaken.test.tsx` rerun passed 17 tests after adding validation focus-preservation and `aria-describedby` assertions.
- `npm run build` passed for the server and client.
- The full `npx playwright test` run passed 48 cases across desktop, tablet, and mobile in 9.9 minutes. After the Actions Taken focus-entry/return changes and keyboard-only test were added, `npx playwright test e2e/lab-04/actions-taken-flow.spec.ts` passed all 12 cases across those viewports.
- The standard `npm run test:e2e` wrapper could not start from Windows PowerShell because `docker` is not on its PATH. Starting the worktree-specific Docker service through WSL then reported host port 5434 was already owned by the running `toktickit-lab4-contract-db-test-1` container. The guarded test preparation succeeded against that existing test database, and the equivalent `npx playwright test` command completed successfully. No development database was used.
- The first keyboard-only E2E draft assumed one Tab moved from `datetime-local` to the next field. The browser trace showed Chromium's native segmented date/time input retains focus while Tab advances through its date/time segments, with no Tab event canceled by application code. The test now tabs to the next labeled field with a bounded loop. Desktop, tablet, and mobile keyboard create flows then passed.
- The manual audit found that opening an inline Action Taken form removed focus from its Add/Edit button. Regression tests first failed for create and edit. The component now focuses the Action Date/Time field on open and restores focus to the initiating Add/Edit button on cancel or save. Validation tests confirm focus remains on Save after an error and the Follow-Up Note control references its field error.
- The serial performance smoke used 1,000 Tickets and 25 warm requests per endpoint. Requester dashboard p95 was 16.2 ms, Staff dashboard p95 was 18.7 ms, both below the 1-second target.
- E2E capture refreshed the 6 dashboard and 12 Actions Taken screenshots in the required Lab 4 folders. All 18 images were visually inspected for role, meaningful seeded data, state, readability, and viewport layout. The full browser run also regenerated Lab 2–3 evidence as a test side effect; those paths were restored, leaving only Lab 4 screenshot changes.
- The accessibility audit was recorded in `docs/lab-04/ui-spec.md` Section 9. It covered Requester and IT Staff source/UI states at 1440×900, 834×1112, and 390×844, semantic headings and landmarks, labels and error associations, text-based status/follow-up distinctions, progress/error announcements, dialog focus behavior, inline form focus entry/return, and visible focus styling. No screen-reader session was run.
- These are branch-level results. Required verification and evidence inspection from `main` remain pending after the reviewed release flow.

## 7. Final Status Rules

- New tests begin as Planned.
- Mark Pass only after the named command/file has run successfully and its output has been inspected.
- Record failures, fixes, and reruns without deleting the first failure from the evidence.
- Do not claim final completion until the required tests and screenshots have been verified from `main`.
