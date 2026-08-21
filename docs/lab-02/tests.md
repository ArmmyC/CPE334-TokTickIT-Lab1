# Lab 2 Test Plan and Results

## 1. Test Strategy

Use Spec-Driven Development and Test-Driven Development. Planned tests are created from the approved functional requirements, business rules, and acceptance criteria before implementation is declared complete. The test set includes unit, API/integration, UI component/style, responsive, visual, and E2E levels.

Tests must cover happy paths, invalid input, boundaries, ownership, failures, loading, empty and no-results states, attachment lifecycle, requester switching, and responsive behavior. No test may be skipped, disabled, or commented out to make a command pass.

## 2. Planned Tests

| Test ID | Type | Requirement / AC | What it tests | Expected result | Automated test file | Final status |
| --- | --- | --- | --- | --- | --- | --- |
| UNIT-01 | Unit | BR-02, AC-06 | Ticket Number generation | Format is unique and backend-derived | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| UNIT-02 | Unit | BR-12-17, AC-05 | Ticket validation and trimming | Valid values pass; invalid values return field errors | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| UNIT-03 | Unit | BR-19-27, AC-07, AC-15 | Attachment validation and removal reason | Type, size, count, and reason rules are enforced | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| UNIT-04 | Unit | BR-30, AC-01, AC-04 | Repeatable Lab 2 seed | Required reference data and Requesters are upserted without duplicates | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| INFRA-01 | Script safety | BR-43 | Test-database preparation guard | Missing, malformed, and non-`toktickit_test` URLs exit non-zero before any destructive database command; the dedicated test URL may continue | `server/tests/lab-02/test-db-guard.test.ts` | Planned |
| API-01 | API | AC-01 | Active Requester retrieval | Active Requesters returned; inactive excluded | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-02 | API | AC-04 | Reference-data retrieval | Active Categories and Related Systems are returned from the database | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-03 | API | AC-06 | Valid Ticket creation | 201, saved Ticket, matching requesterId, unique number, NEW status | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-04 | API | AC-05, AC-08 | Invalid and failed creation | Field errors and safe failures; no duplicate submission behavior | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-05 | API | AC-09-10 | Owned list query | Search, filters, sorting, pagination, metadata, and ownership | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-06 | API | AC-11-12 | Owned detail and cross-requester access | Owner succeeds; different requester receives safe 404 | `server/tests/lab-02/ticket-detail.api.test.ts` | Planned |
| API-07 | API | AC-13-16 | Attachment lifecycle | Upload, metadata, active download, soft removal, blocked removed download | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-08 | API | AC-10, AC-19 | List boundaries and invalid queries | Blank search, overlong search, invalid filters/sorts/pages, out-of-range page | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-09 | API | AC-07, AC-13-16, AC-20 | Attachment boundaries and failures | Five-file limit, MIME/extension mismatch, 5 MB boundary, compensation, disposition, repeat removal | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| UI-01 | UI | AC-01-03 | Requester selector and shell context | Loading, active list, empty/failure, selection, display, switching | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-02 | UI | AC-04-08 | Create Ticket form | Reference data, field validation, busy, success, failure, invalid file | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-03 | UI | AC-09-10 | My Tickets behavior | List, search, filters, sort, pagination, empty/no-results/failure | `client/tests/lab-02/MyTickets.test.tsx` | Planned |
| UI-04 | UI | AC-12-16 | Detail and attachments | Read-only fields, attachment states, removal reason, blocked download | `client/tests/lab-02/RequesterTicketDetail.test.tsx` and `client/tests/lab-02/AttachmentSection.test.tsx` | Planned |
| UI-05 | UI | AC-02-03 | Route guard and Requester change | Missing context redirects; change clears old data and returns to selector | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| STYLE-01 | UI style | AC-17 | Zen Green and control rules | Tokens, labels, asterisks, focus, disabled/busy, message placement | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| STYLE-02 | UI style | AC-12, AC-17 | Read-only detail, badges, and action hierarchy | IT Priority fallback, status text, destructive and disabled states | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | Planned |
| RESP-01 | Responsive | AC-17 | Desktop, tablet, mobile layout | No clipping, overlap, hidden buttons, or horizontal overflow | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| RESP-02 | Responsive | AC-10, AC-17 | Navigation and list representation | Mobile menu and cards preserve every required action and value | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| E2E-01 | E2E | AC-01-08, AC-18 | Complete requester flow | Select requester, create ticket, find it, view detail, manage attachment | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| E2E-02 | E2E | AC-09-17 | Multi-requester and responsive evidence | Switch requester, reject foreign data, inspect required viewports | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |

## 3. Acceptance-Criterion Traceability

| Acceptance criteria | Planned tests |
| --- | --- |
| AC-01 | API-01, UI-01, E2E-01 |
| AC-02 | UI-01, E2E-01 |
| AC-03 | UI-01, E2E-01 |
| AC-04 | API-02, UI-02, E2E-01 |
| AC-05 | UNIT-02, API-04, UI-02 |
| AC-06 | UNIT-01, API-03, UI-02, E2E-01 |
| AC-07 | UNIT-03, API-07, UI-02 |
| AC-08 | API-04, UI-02, E2E-01 |
| AC-09 | API-05, UI-03, E2E-01 |
| AC-10 | API-05, UI-03, E2E-01 |
| AC-11 | API-06, API-07, E2E-02 |
| AC-12 | API-06, UI-04, E2E-01 |
| AC-13 | API-07, UI-04, E2E-01 |
| AC-14 | API-07, UI-04, E2E-01 |
| AC-15 | UNIT-03, API-07, UI-04, E2E-01 |
| AC-16 | API-07, UI-04, E2E-01 |
| AC-17 | STYLE-01, RESP-01, E2E-02 |
| AC-18 | E2E-01, E2E-02 |
| AC-19 | API-05, API-08, E2E-02 |
| AC-20 | API-09, UI-04, E2E-01 |

## 4. Responsive and Visual Checklist

- [ ] Primary, secondary, pale, background, surface, text, error, warning, and success tokens match `ui-spec.md`.
- [ ] Editable and read-only fields are visually distinct and readable.
- [ ] Required markers and field messages are visible beside their fields.
- [ ] Primary, secondary, destructive, disabled, and busy buttons are distinguishable.
- [ ] Desktop layout is centered and has no excessive whitespace or clipping.
- [ ] Tablet layout keeps Summary and Description usable.
- [ ] Mobile layout stacks fields and has no horizontal page scroll.
- [ ] Tables/cards, badges, filters, pagination, empty states, and attachment rows remain usable.
- [ ] Screenshot artifacts are stored in the required Lab 2 directories.

## 5. Test Commands

Run from the repository root:

```text
npm test
npm run build
npm run test:e2e
```

Database-dependent checks additionally require Docker PostgreSQL, Prisma migration, and the repeatable seed command documented in `README.md`.

The E2E environment uses a dedicated `db-test` PostgreSQL service on host port `5434` and an uncommitted `.env.test` copied from `.env.test.example`. Its `DATABASE_URL` points only to `toktickit_test`. Before any destructive command, `test:db:prepare` parses `DATABASE_URL` and requires its database pathname to equal `/toktickit_test`; missing, malformed, or differently named database URLs hard-fail with a non-zero exit. Only after that guard passes may the command reset, deploy migrations, and seed the test database before Playwright starts the API and client.

Required final command sequence:

```text
npm run db:test:up
npm run test:db:prepare
npm test
npm run build
npm run test:e2e
```

Playwright projects use desktop `1440x900`, tablet `834x1112`, and mobile `390x844`. Failure/loading UI tests use controlled API responses; success, persistence, ownership, and attachment E2E scenarios use the dedicated PostgreSQL database.

## 6. Final Results

This section is updated only with actual command output from the final `main` branch. It must include the date, command, environment prerequisites, pass/fail result, and any relevant test count.

## 7. Known Limitations or Deferred Tests

Only genuine, reviewed limitations may be listed here. Lab 3 authentication, IT Staff workflow, comments, Actions Taken, and later Ticket status transitions are intentionally deferred because they are outside Lab 2 scope.
