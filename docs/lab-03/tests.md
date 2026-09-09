# Lab 3 Test DD and Traceability Plan

## 1. Test Strategy

Test planning is created before product implementation is declared complete. The suite uses TDD for new behavior and retains the Lab 2 regression suite after the authenticated identity migration.

The test layers are:

- Unit tests for password rules, hashing and verification, cookie and CSRF helpers, query parsing, status transitions, safe serialization, and Administrator safety rules.
- API and integration tests for authentication, sessions, migration, roles, ownership, Ticket workflow, comments, notes, Attachments, User Management, validation, conflicts, and safe errors.
- UI component tests for Login, Change Password, authenticated shell, Requester regression, Staff Queue, Staff Ticket Detail, and User Management.
- UI style tests for Zen Green tokens, badges, field modes, validation placement, focus, and action states.
- Responsive and visual checks for desktop, tablet, and mobile layouts with horizontal-overflow assertions.
- E2E tests against the dedicated PostgreSQL test database for complete authenticated flows.

No test may be skipped, disabled, or commented out to make a command pass. Final statuses remain `Planned` until the implementation and verification command has actually passed.

## 2. Planned Tests

| Test ID | Type | Requirement / AC | What it tests | Expected result | Automated test file | Final status |
| --- | --- | --- | --- | --- | --- | --- |
| UNIT-01 | Unit | BR-04, BR-05, AC-01 | Password validation and hashing | Valid boundaries pass, invalid rules fail, the fixed `scrypt` parameters are used, hashes differ from plaintext, and verification succeeds | `server/tests/lab-03/auth.api.test.ts` | Planned |
| UNIT-02 | Unit | BR-08, AC-04 | Session expiry and revocation | The eight-hour inactivity deadline slides on valid activity, the 24-hour absolute deadline never slides, and expired or revoked tokens cannot authenticate | `server/tests/lab-03/auth.api.test.ts` | Planned |
| UNIT-03 | Unit | BR-09 | CSRF and Origin validation | Missing or mismatched mutation protection fails safely | `server/tests/lab-03/auth.api.test.ts` | Planned |
| UNIT-04 | Unit | BR-25, AC-15 | Status transition matrix | Only documented transitions are accepted | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| UNIT-05 | Unit | BR-37, BR-38, AC-20 | Administrator safety rules | Self-deactivation and last-active-Administrator removal fail | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| UNIT-06 | Unit | BR-45, AC-02 | Login-attempt limiter | Five failed attempts within the window trigger a temporary throttle, successful login clears it, and no permanent account lock is created | `server/tests/lab-03/auth.api.test.ts` | Planned |
| MIG-01 | Migration | BR-17, BR-18, AC-03, AC-05 | DevelopmentRequester migration | IDs, Ticket ownership, Attachments, active state, and counts survive conversion. Each migrated Requester can use the documented local initial password, is restricted to password change, and gains normal access only after changing it | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| SEED-01 | Unit or integration | BR-40, BR-41, BR-42, AC-06 | Idempotent Lab 3 seed | Required active and inactive role counts and workflow records exist without duplicates | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-01 | API | FR-01, AC-01 | Valid login | Active credentials establish a safe session and return identity and role | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-02 | API | FR-02, BR-02, BR-45, AC-02 | Invalid, inactive, and throttled login | Invalid and inactive failures share the same safe authentication response, repeated failures produce the documented temporary `429`, and successful login clears the limiter | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-03 | API | FR-05, AC-03 | Initial password restriction | Restricted session can change password but cannot enter normal APIs | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-04 | API | FR-04, AC-04 | Logout | Session is revoked, cookies are cleared, and direct protected access fails | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-05 | API | FR-06, BR-07 | Password change | Valid change clears requirement and revokes other sessions, invalid boundaries fail | `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-06 | API | FR-07, BR-12, AC-12 | Role middleware | Requester, Staff, Administrator, unauthenticated, and restricted sessions receive correct status | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| API-07 | API | FR-09, BR-19, AC-07 | Authenticated ownership | Client requesterId or userId cannot select another identity | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| API-08 | API | FR-11, AC-08 | Authenticated Ticket creation | Ticket uses session Requester, copies requested priority, and starts NEW | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-09 | API | FR-12, AC-08 | Authenticated owned list | Existing search, filters, sorting, pagination, and safe ownership continue | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-10 | API | FR-13, BR-32, AC-08 | Authenticated Attachment lifecycle | Upload, metadata, download, preview, soft removal, and foreign rejection continue | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-11 | API | FR-14, AC-09 | Requester comments and resolution | Own Requester can append Public Comment and indicate resolution without formal status change | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-12 | API | FR-15, AC-10 | Staff Queue query | Search, filters, sorting, pagination, owner, priority, status, and metadata match contract | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| API-13 | API | FR-15, AC-11 | Staff Queue invalid queries | Invalid values return field errors without silent coercion | `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| API-14 | API | FR-16, AC-13, AC-16 | Staff and Administrator Ticket Detail | Staff sees operational data, Attachments, comments, notes, and resolution indication. Administrator sees permitted read-only content without Staff mutations | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-15 | API | FR-17, AC-13 | Claim, assign, reassign | Active eligible owner succeeds, inactive or invalid role fails, unassigned is supported | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-16 | API | FR-18, AC-14 | IT Priority | IT Staff or Administrator changes IT Priority without changing Requested Priority, and other Administrator Ticket mutations remain forbidden | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-17 | API | FR-18, AC-15 | Status transitions | Valid transitions save, invalid transitions and missing confirmations fail safely | `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-18 | API | FR-19, AC-16, AC-17 | Comments and Notes | Visibility, authorship, append-only behavior, blank rejection, length boundaries, and safe text hold | `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-19 | API | FR-20, FR-21, AC-18 | Administrator list | Name or email search and one role filter return safe User data | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-20 | API | FR-22, FR-23, AC-19 | User create and edit | Basic fields, one role, activation state, duplicate email, and validation behave correctly | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-21 | API | FR-24, BR-39, AC-21 | Administrator initial password | New password marks target User and revokes sessions | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-22 | API | FR-25, AC-20 | Administrator safety | Self-deactivation and last active Administrator protection hold under direct API calls | `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| UI-01 | UI component | FR-01, FR-02, AC-01, AC-02 | Login screen | Validation, busy, safe failure, inactive account feedback, and successful navigation work | `client/tests/lab-03/Login.test.tsx` | Planned |
| UI-02 | UI component | FR-05, FR-06, AC-03 | Change Password screen | Rules, confirmation, busy, success, and failure behavior work | `client/tests/lab-03/ChangePassword.test.tsx` | Planned |
| UI-03 | UI component | FR-10, AC-04, AC-07 | Authenticated shell | User and role display, permitted nav, logout, and stale context clearing work | `client/tests/lab-03/Login.test.tsx` | Planned |
| UI-04 | UI regression | FR-11, FR-12, FR-13, AC-08 | Requester regression | Create, My Tickets, Detail, Attachments, and no-selector flow continue | `client/tests/lab-02/CreateTicket.test.tsx`, `client/tests/lab-02/MyTickets.test.tsx`, `client/tests/lab-02/RequesterTicketDetail.test.tsx`, `client/tests/lab-02/AttachmentSection.test.tsx` | Planned |
| UI-05 | UI component | FR-14, AC-09 | Requester comments and resolution | Public comment form and resolution indication are clear and safe | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | Planned |
| UI-06 | UI component | FR-15, AC-10, AC-11, AC-12 | Staff Queue | Controls, table/cards, ownership, badges, loading, empty, no-results, forbidden, and failures work | `client/tests/lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-07 | UI component | FR-16, FR-18, FR-19, AC-13, AC-14, AC-15, AC-16 | Staff and Administrator Ticket Detail | Staff claim, assignment, priority, status, comments, notes, Attachments, and resolution indication work. Administrator receives read-only Ticket communication and only the permitted IT Priority edit | `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-08 | UI component | FR-20, FR-21, FR-22, FR-23, FR-24, AC-18, AC-19, AC-20, AC-21 | User Management | List, search, role filter, create, edit, password action, safety feedback, and forbidden state work | `client/tests/lab-03/UserManagement.test.tsx` | Planned |
| STYLE-01 | UI style | FR-27, AC-22 | Zen Green controls | Tokens, labels, required markers, focus, badges, editable/read-only fields, and busy controls match `ui-spec.md` | `client/tests/lab-03/Login.test.tsx`, `client/tests/lab-03/StaffTicketQueue.test.tsx`, `client/tests/lab-03/StaffTicketDetail.test.tsx`, `client/tests/lab-03/UserManagement.test.tsx`, `client/tests/lab-02/VisualStyle.test.ts` | Planned |
| RESP-01 | Responsive | FR-26, FR-27, AC-22 | Auth and shell responsive behavior | Login, Change Password, and role navigation remain readable at all reference viewports | `e2e/lab-03/authentication.spec.ts` | Planned |
| RESP-02 | Responsive | FR-15, AC-10, AC-22 | Staff Queue responsive behavior | Table-to-card representation has no clipping or page horizontal overflow | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| RESP-03 | Responsive | FR-16, FR-20, AC-22 | Staff Detail and User Management responsive behavior | Operational cards, comments, notes, forms, and actions remain usable | `e2e/lab-03/staff-ticket-flow.spec.ts`, `e2e/lab-03/user-administration.spec.ts` | Planned |
| SEC-01 | Security | BR-10, AC-01, AC-02, AC-04 | Secret and safe-error audit | No password or session secret leaks and generic failures remain safe | `server/tests/lab-03/auth.api.test.ts`, `server/tests/lab-03/authorization.api.test.ts` | Planned |
| SEC-02 | Security | BR-12, BR-16, AC-07, AC-12, AC-16 | Direct authorization bypasses | Hidden controls are bypassed through direct API calls and still fail | `server/tests/lab-03/authorization.api.test.ts`, `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| REG-01 | Migration/regression | BR-17, BR-18, AC-05 | Lab 2 data migration | Existing records and ownership survive the migration | `server/tests/lab-03/authorization.api.test.ts` | Planned |
| REG-02 | Migration/regression | FR-11, FR-12, FR-13, AC-08 | Lab 2 Requester regression | Existing Ticket and Attachment behavior passes under authenticated identity | `server/tests/lab-02/create-ticket.api.test.ts`, `server/tests/lab-02/my-tickets.api.test.ts`, `server/tests/lab-02/ticket-detail.api.test.ts`, `server/tests/lab-02/attachments.api.test.ts` | Planned |
| E2E-01 | E2E | AC-01, AC-02, AC-03, AC-04, AC-22, AC-23 | Authentication flow | Valid and invalid login, inactive account, first password change, role display, logout, direct block, and responsive states pass | `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-02 | E2E | AC-10, AC-13, AC-14, AC-15, AC-16, AC-22, AC-23 | IT Staff flow | Seeded queue, search, filter, sort, pagination, detail, ownership, priority, status, comments, notes, Attachments, authorization, and responsive states pass | `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| E2E-03 | E2E | AC-14, AC-18, AC-19, AC-20, AC-21, AC-22, AC-23 | Administrator flow | User list, search, filter, create, edit, password change, safety guards, protected Ticket visibility with IT Priority edit, forbidden Staff mutations, and responsive states pass | `e2e/lab-03/user-administration.spec.ts` | Planned |

## 3. Acceptance-Criterion Traceability

| Acceptance criterion | Planned tests |
| --- | --- |
| AC-01 | UNIT-01, API-01, UI-01, E2E-01 |
| AC-02 | UNIT-06, API-02, UI-01, SEC-01, E2E-01 |
| AC-03 | MIG-01, API-03, API-05, UI-02, E2E-01 |
| AC-04 | API-04, UI-03, E2E-01 |
| AC-05 | MIG-01, REG-01 |
| AC-06 | SEED-01, API-01, E2E-01 |
| AC-07 | API-07, SEC-02, UI-03 |
| AC-08 | API-08, API-09, API-10, UI-04, REG-02 |
| AC-09 | API-11, UI-05, E2E-02 |
| AC-10 | API-12, UI-06, RESP-02, E2E-02 |
| AC-11 | API-13, UI-06 |
| AC-12 | API-06, SEC-02, UI-06, E2E-02, E2E-03 |
| AC-13 | API-14, API-15, UI-07, E2E-02 |
| AC-14 | API-16, UI-07, E2E-02, E2E-03 |
| AC-15 | UNIT-04, API-17, UI-07, E2E-02 |
| AC-16 | API-14, API-18, SEC-02, UI-07, E2E-02, E2E-03 |
| AC-17 | API-18, UI-07 |
| AC-18 | API-19, API-20, UI-08, E2E-03 |
| AC-19 | API-20, API-22, UI-08, E2E-03 |
| AC-20 | UNIT-05, API-22, UI-08, E2E-03 |
| AC-21 | API-21, UI-08, E2E-03 |
| AC-22 | STYLE-01, RESP-01, RESP-02, RESP-03, E2E-01, E2E-02, E2E-03 |
| AC-23 | E2E-01, E2E-02, E2E-03 |

## 4. Responsive and Visual Checklist

- [ ] Zen Green primary, secondary, pale, background, text, error, warning, and focus tokens match `ui-spec.md`.
- [ ] Login and Change Password remain usable at desktop, tablet, and mobile sizes.
- [ ] Authenticated shell shows only role-permitted navigation and exposes no selector controls.
- [ ] Status, Requested Priority, IT Priority, User role, User status, and owner badges are consistent.
- [ ] Editable operational fields and read-only submitted fields are visually distinct.
- [ ] Public Comments and Internal Notes use different surfaces and explicit visibility labels.
- [ ] Validation and safe API failures appear beside the affected form or action.
- [ ] Busy and disabled controls retain readable Zen Green styling.
- [ ] Queue table or cards show every required field without unreadable mega-grid behavior.
- [ ] Queue filters and pagination remain usable without page-level horizontal scrolling.
- [ ] Staff Detail attachments, comments, notes, and operations wrap without clipping.
- [ ] User Management create and edit modes remain readable and operable on mobile.
- [ ] Focus is visible, keyboard actions work, and dialogs restore focus.
- [ ] `scrollWidth <= innerWidth` passes for each required major screen.
- [ ] Screenshots are stored under the four required `artifacts/lab-03/screenshots/` directories and each has a caption in the external Answer Sheet.

## 5. Test Commands

Run from the repository root after copying `.env.test.example` to the uncommitted `.env.test` and setting the dedicated test database credentials:

```text
npm run db:test:up
npm run test:db:prepare
npm test
npm run build
npm run test:e2e
```

The `test:db:prepare` guard must parse `DATABASE_URL` and require the database pathname to be exactly `/toktickit_test` before reset, migration, or seed. No test command may use the development database for destructive setup.

The E2E suite uses desktop `1440 x 900`, tablet `834 x 1112`, and mobile `390 x 844`. The API server and Vite client are started through `playwright.config.ts`, with one worker so seeded records and evidence remain deterministic.

## 6. Final status rules

- A row changes from `Planned` to `Pass` only after the named command or E2E project completes with zero failures.
- A test failure is recorded with the actual error, the Issue or branch where it was fixed, and a fresh rerun result.
- A screenshot is final evidence only after visual inspection confirms readable layout, correct state, and required viewport.
- The final-main table is updated only after the release merge into `main`, not from a feature branch or local assumption.
