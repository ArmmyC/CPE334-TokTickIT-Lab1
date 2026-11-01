# Lab 4 Engineering Specification

**Status:** Approved by the student on 2026-10-30, including the Administrator read-only Staff Queue drill-down clarification. Implement through the approved Issue sequence and reviewed PRs to `lab4-staging`.
**Staging branch:** `lab4-staging`
**Release target:** `main`
**Lab 3 baseline:** PR #63, the Lab 3 screenshot integration, merged to `lab3-staging`.
**Lab 4 branch base commit:** `6354369e094f26151ecd8cc8f6b88992de93efed`, the `lab3-staging` head used to initialize `lab4-staging`.

## 1. Sprint Goal

Give Requesters and IT Staff a clear view of Ticket work, record and update the actions taken, enforce the Ticket lifecycle on the server, and provide trustworthy role-specific dashboards while preserving the complete Labs 1–3 application.

## 2. Stakeholder Request

IT Staff need to record what work was performed, its result, and whether follow-up is needed. The person coordinating a Ticket can differ from the staff member who performed an action. Requesters can read the action record for their own Tickets. IT Staff formally control Ticket status. Requesters may still indicate that a problem appears resolved, but that indication does not change formal status.

Dashboards summarize the current operational data and link to the detailed Ticket screens. They do not replace the existing Ticket lists.

## 3. Scope

### Included

- Actions Taken with the sheet's required fields, create and edit modes, role enforcement, and safe retries.
- The Ticket status transition matrix, a server-enforced resolution gate, and append-only status history.
- Requester and IT Staff dashboards with server-calculated metrics, recent items, and drill-down links.
- Prisma schema changes, non-destructive migration/backfill, recovery instructions, and idempotent seed data.
- Stale-update conflict handling, responsive and accessible UI, genuine Lab 4 screenshots, and complete Labs 1–3 regression.

### Explicitly excluded

- Automatic SLA clocks, escalation engines, on-call scheduling, and breach notifications.
- Email, SMS, LINE, push, or other external notification services.
- Inventory consumption, spare-parts management, purchasing, or service cost accounting.
- Time-sheet billing, payroll, or detailed labor-cost calculation.
- Multi-level approval workflows or electronic signatures.
- Advanced BI, custom report builders, or export warehouses.
- Multi-tenant organizations and production-scale cloud operations.
- New product features not approved in this contract.
- Uploading a file through Attachment Notes. The field is descriptive text only and uses the existing Attachment feature when an actual file is needed.

## 4. Functional Requirements

### Actions Taken

- **FR-01:** The application shall allow an authorized IT Staff member or Administrator to create and update Actions Taken on an accessible active Ticket. Actions Taken are editable in place and are not append-only revisions. There is no delete operation. Resolved, Closed, and Cancelled Tickets are read-only for Actions Taken until reopened.
- **FR-02:** An Action Taken shall contain Action Date/Time, Action Description, Result, Performed by, Follow-Up Required, Follow-up Note, Attachment Notes, and a separate Follow-Up Completed state.
- **FR-03:** The server shall derive Performed by from the authenticated actor on creation. The Ticket Owner and Action performer shall remain independent values. An edit by another staff member shall preserve the original performer and record the editor separately.
- **FR-04:** Requesters shall read Actions Taken only on their own Tickets. They shall not create or update them. The backend shall enforce these rules even when a client bypasses the UI.
- **FR-05:** The Requester-facing Action Taken fields shall be treated as visible to the Ticket's Requester. Internal Staff-only content shall continue to use Internal Notes.

### Ticket workflow

- **FR-06:** The backend shall enforce the complete status transition matrix in BR-06. The UI shall show only transitions allowed from the current status, and the server remains authoritative.
- **FR-07:** A transition to Resolved shall satisfy the resolution gate defined in BR-08. The transition to Closed shall require the Ticket to be Resolved and pass the same gate.
- **FR-08:** Each initial status and successful formal status transition shall add a Ticket status-history event. Status-history records shall be append-only, have deterministic ordering, and be visible only to roles permitted to see the Ticket.
- **FR-09:** The existing Requester “Problem Appears Resolved” action shall remain advisory. It shall not set the formal Ticket status or bypass the IT Staff resolution gate.

### Dashboards

- **FR-10:** Requester and Staff dashboards shall be backed by dedicated API responses containing concise metrics and limited recent Ticket rows, not entire Ticket collections.
- **FR-11:** All counts, date boundaries, status groupings, and activity timestamps shall be calculated by the backend using the rules in BR-11 through BR-14.
- **FR-12:** Each dashboard metric, status/priority breakdown count, and recent row shall lead to a useful filtered list or Ticket Detail view where practical. The UI shall not calculate authoritative counts from a partial client-side list.
- **FR-13:** The Requester dashboard shall be scoped to the authenticated Requester. The Staff dashboard shall use the authenticated IT Staff or Administrator identity for Owner-specific and Action-performer metrics, including a current-user Actions Taken count and recent action list.

### Data, security, and hardening

- **FR-14:** The migration shall preserve all Lab 1–3 Users, Tickets, Attachments, Public Comments, and Internal Notes. It shall document legacy Tickets with zero Actions Taken, create truthful status-history baselines, and define failure recovery.
- **FR-15:** Seeds shall be idempotent and include every required status/priority and ownership combination, zero/one/multiple Actions Taken, and both zero and non-zero dashboard metrics.
- **FR-16:** The API shall reject stale edits safely and protect Action Taken creation from duplicate network retries.
- **FR-17:** The application shall preserve Labs 1–3 authentication, ownership, Ticket, Attachment, Public Comment, Internal Note, and Administrator User Management behavior.
- **FR-18:** Major Lab 4 screens shall support desktop, tablet, mobile, keyboard use, accessible labels and feedback, and the existing Zen Green design system.
- **FR-19:** Genuine screenshots shall be stored under the three exact paths in the Lab 4 sheet and included through reviewed PRs. The Answer Sheet and final PDF remain outside Git.
- **FR-20:** Existing Ticket Owner assignment shall remain available to permitted IT Staff. Only active eligible IT Staff or Administrators can be assigned. The server shall reject inactive or ineligible assignees without changing the current Owner. Assignment remains separate from Action Taken Performed by.
- **FR-21:** The backend shall reject Action Taken create/edit requests when a Ticket is Resolved, Closed, or Cancelled. Staff must reopen the Ticket before changing Actions Taken.
- **FR-22:** Administrators shall be able to read and filter the Staff Ticket Queue for dashboard drill-downs. This read-only queue access does not change any existing per-endpoint mutation permissions.

## 5. Business Rules

### Roles and ownership

- **BR-01:** Every protected endpoint requires a normal authenticated session. State-changing requests require the existing same-origin and CSRF protections.
- **BR-02:** Requester access is restricted to Tickets whose `requesterId` equals the authenticated Requester. A client-supplied requester/user identifier never grants access.
- **BR-03:** IT Staff and Administrators may create or update Actions Taken on Tickets they are permitted to access. Requesters may read all Action Taken fields on their own Tickets and cannot write them.
- **BR-04:** Ticket status mutations remain IT Staff only, matching the Lab 3 contract. Administrators may use the Actions Taken APIs and shared Staff dashboard because the Lab 4 Actions Taken role section grants Staff behavior, and may read/filter the Staff Ticket Queue for dashboard drill-downs. Administrators do not gain formal status mutation or Ticket Owner assignment rights.
- **BR-05:** `Ticket.ownerId` identifies the primary Ticket coordinator. Existing assignment accepts only an active IT Staff or Administrator and rejects an inactive/ineligible assignee without changing the Owner. `ActionTaken.performedById` identifies the authenticated staff member who recorded/performed the action at creation. Updating a row does not change its original performer. `updatedById` records the most recent editor.

### Actions Taken data and validation

- **BR-06:** The status set remains `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, and `CANCELLED`.

| Current status | Allowed next statuses | Role | Confirmation |
| --- | --- | --- | --- |
| `NEW` | `OPEN`, `CANCELLED` | IT Staff | Cancelled |
| `OPEN` | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `CANCELLED` | IT Staff | Cancelled |
| `IN_PROGRESS` | `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | IT Staff | Resolved and Cancelled |
| `WAITING_FOR_REQUESTER` | `IN_PROGRESS`, `RESOLVED`, `CANCELLED` | IT Staff | Resolved and Cancelled |
| `RESOLVED` | `CLOSED`, `REOPENED` | IT Staff | Closed |
| `CLOSED` | `REOPENED` | IT Staff | No |
| `REOPENED` | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `CANCELLED` | IT Staff | Cancelled |
| `CANCELLED` | `REOPENED` | IT Staff | No |

The backend rejects all unlisted transitions. A Requester resolution indication is not a transition.

- **BR-07:** Action Date/Time is the time the work occurred, supplied as an offset-aware ISO 8601 timestamp and stored/returned in UTC. It may be historical but not in the future. `createdAt` and `updatedAt` are server-managed.
- **BR-08:** A Ticket may enter `RESOLVED` only when it has at least one Action Taken and every Action Taken with `followUpRequired = true` also has `followUpCompleted = true`. `CLOSED` requires a current `RESOLVED` state and the same gate. A required follow-up remains marked required after completion. Completing it changes the separate completion state, and the follow-up work itself is recorded as an Action Taken when it represents substantive work. The backend enforces this gate in the same transaction as the status transition.
- **BR-09:** `followUpNote` is required and non-blank when `followUpRequired = true`. When false, the server stores it as null and `followUpCompleted` must be false. When true, `followUpCompleted` starts false and may be set true by an authorized Staff/Administrator on an active Ticket after the follow-up is complete. It cannot be set true on Action Taken creation. Marking a follow-up complete does not clear or rewrite `followUpRequired`. Attachment Notes are optional plain text that describes what file to look for; they do not upload or link a file.
- **BR-10:** Maximum lengths are 4,000 characters for Action Description and Result, and 2,000 characters for Follow-up Note and Attachment Notes. Values are trimmed before validation. Empty descriptions/results and future Action Date/Time are rejected.
- **BR-11:** A repeated Action Taken creation with the same actor-scoped `Idempotency-Key` and equivalent payload returns the existing record without creating a duplicate. Reusing that key with a different payload or Ticket returns `409 IDEMPOTENCY_KEY_REUSED`. Persist an immutable request fingerprint with the Action Taken so a later in-place edit cannot change the result of a retry check.

### Status history and concurrency

- **BR-12:** Status history is append-only. It has no update/delete API, and the database rejects updates/deletes to history rows. History is ordered by `createdAt ASC, id ASC`.
- **BR-13:** New Tickets receive an initial `NEW` event in the Ticket-creation transaction. Existing Tickets receive a `LEGACY_BASELINE` event with null actor, null prior status, current status as the observed status, and migration time. This records the state seen at migration, not an invented historical transition.
- **BR-14:** `Ticket.version` starts at zero for new and migrated Tickets. It increments in the same transaction as formal status changes, Owner assignment, IT Priority changes, Requester resolution indications, and Action Taken create/edit, including follow-up completion. These writes invalidate a stale status form. Public Comments, Internal Notes, Attachments, and activity-timestamp maintenance do not increment this workflow version because they do not change the transition or resolution-gate inputs. Each Action Taken has its own independent version, starts at one on creation, and increments on edit. A stale expected version returns a 409 conflict with the current safe representation and does not overwrite newer data.
- **BR-15:** Status and its history event commit in one database transaction. No event is written when validation, authorization, gate, or stale-version checks fail. Action Taken create/edit and status transitions that evaluate the resolution gate serialize on the parent Ticket within their transactions, so concurrent writes cannot pass the gate against an outdated Action Taken set.

### Dashboard calculations

- **BR-16:** Dashboard `asOf` is server UTC time. The recent window is the rolling seven days `[asOf - 7 days, asOf]`. API timestamps are ISO 8601 UTC. The UI formats them in the viewer's local timezone.
- **BR-17:** Active statuses are `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, and `REOPENED`. Terminal statuses are `RESOLVED`, `CLOSED`, and `CANCELLED`.
- **BR-18:** Requester `openTickets` counts the authenticated Requester's Tickets in active statuses. `waitingForRequester` counts their Tickets in `WAITING_FOR_REQUESTER`. `recentlyUpdated` counts Tickets whose latest Requester-visible activity falls in the recent window. `recentlyResolved` counts Tickets currently `RESOLVED` or `CLOSED` whose latest real transition into `RESOLVED` falls in the window. `LEGACY_BASELINE` is not a resolution event.
- **BR-19:** Staff `unassigned` counts active Tickets with no Owner. `ownedByMe` counts active Tickets whose Owner is the authenticated user. `actionsTakenByMe` counts all Actions Taken whose immutable `performedById` equals the authenticated user. `activeByStatus` counts active Tickets grouped by status. `activeByItPriority` counts active Tickets grouped by IT Priority, including `UNASSIGNED`. The recent action list returns the latest five of the current user's actions by Action Date/Time descending, then action ID descending.
- **BR-20:** Staff recent activity includes Ticket changes, Actions Taken, Public Comments, Internal Notes, Attachments, and Requester resolution indications. Requester-visible recent activity includes Ticket creation, changes to Requester-visible Ticket fields (`ticketDate`, category, related system, summary, description, requested priority, IT Priority, and current status), Public Comments, Attachments available to the Requester, Actions Taken, and Requester resolution indications. It excludes Internal Notes and staff-only Owner assignment. The Ticket stores separate staff and Requester-visible activity timestamps to keep metrics efficient without exposing internal activity.
- **BR-21:** Recent lists return at most five rows, sorted by activity/resolution timestamp descending and Ticket number descending. Every known status/priority key is returned with a numeric count, including zero.

### Migration, seeds, and recovery

- **BR-22:** Migration adds child records and Ticket fields without deleting or rewriting existing business records. Legacy Tickets start with zero Actions Taken. Existing status-history detail is unavailable, so only a labeled migration baseline is created.
- **BR-23:** Before applying the migration to any non-disposable environment, take a database backup and record row counts/ownership for existing tables. If migration fails before new writes are accepted, restore that snapshot. After new Actions Taken/history writes are accepted, recover by forward-fix or a consistent snapshot restore, never by silently dropping new records.
- **BR-24:** Seed operations use stable unique keys/upserts and can run repeatedly without duplicates or changing existing user passwords.
- **BR-25:** Activity timestamps are updated in the same transaction as the event that caused them. Dashboard counts are database aggregates over indexed filters, not stored counters and not calculations over a full Ticket collection.
- **BR-26:** Actions Taken may be created or edited only while the Ticket is in `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, or `REOPENED`. Requests on `RESOLVED`, `CLOSED`, or `CANCELLED` Tickets return `409 ACTION_TAKEN_LOCKED` without changing data. Reopen the Ticket before recording or correcting an action.
- **BR-27:** Administrator access to the Staff Ticket Queue is read-only and limited to the documented list fields and filters used for dashboard drill-downs. Queue access does not grant Ticket Owner assignment, formal status mutation, Public Comment creation, Internal Note creation, or any other endpoint permission. Existing Administrator Actions Taken permissions remain as defined in FR-01 and BR-03.

## 6. UI Specification Summary

The complete UI contract is in `ui-spec.md`. It covers the Requester dashboard, Staff/Admin dashboard, Actions Taken area on Ticket Detail, Ticket status history, role-specific controls, loading and failure states, Zen Green styling, responsive behavior, and accessibility.

## 7. Data Changes

The implementation must extend the existing PostgreSQL/Prisma models without replacing Lab 1–3 records.

### Proposed models and fields

- **`ActionTaken`:** `id`, `ticketId`, `actionAt`, `description`, `result`, `performedById`, `followUpRequired`, `followUpCompleted`, nullable `followUpNote`, nullable `attachmentNotes`, `idempotencyKey`, immutable `idempotencyPayloadHash`, `version`, `createdAt`, `updatedAt`, `updatedById`. `performedById` and `updatedById` reference User with Restrict deletion. On create, `updatedById` is the same authenticated user as `performedById`; later edits set it to the current editor. `followUpCompleted` is false by default and may be true only when `followUpRequired` is true. Ticket deletion is restricted while actions exist. Enforce uniqueness on `(performedById, idempotencyKey)`.
- **`TicketStatusHistory`:** `id`, `ticketId`, nullable `fromStatus`, `toStatus`, nullable `actorId`, `eventKind` (`INITIAL`, `TRANSITION`, `LEGACY_BASELINE`), and `createdAt`. Ticket deletion is restricted. Actor is nullable only for a migration baseline.
- **`Ticket`:** add `version`, `lastStaffActivityAt`, and `lastRequesterVisibleActivityAt`. Existing `updatedAt` retains its current row-update meaning.
- **Enums:** use the existing `TicketStatus` and `UserRole` enums. Do not introduce a second status set.

### Indexes and design decisions

1. Actions are child records because a Ticket has many work entries and each entry has its own performer, time, follow-up, and edit version. Use indexes `ActionTaken(ticketId, actionAt, id)` for stable Ticket Detail ordering and `ActionTaken(performedById, actionAt, id)` for actor lookup and recent-action ordering. Keep Ticket Owner on Ticket, not copied as action performer.
2. Status history is a separate append-only table because the current Ticket status is mutable while each transition is immutable. Use `TicketStatusHistory(ticketId, createdAt, id)` and prohibit updates/deletes.
3. Integer versions avoid timestamp-precision races for stale edits. An actor-scoped unique idempotency key prevents duplicate Action Taken rows after network retries.
4. Separate staff and Requester-visible activity timestamps make dashboard sorting efficient and prevent Internal Note activity from changing the Requester's recent-activity metric. Index `Ticket(requesterId, lastRequesterVisibleActivityAt, id)` and `Ticket(ownerId, lastStaffActivityAt, id)`.

### Migration and backfill

- Add the new tables/columns and indexes using a Prisma migration.
- Initialize Ticket version to zero. Existing Tickets have no Actions Taken, so no follow-up completion values require backfill.
- Backfill staff activity time from the maximum of Ticket `updatedAt`, Public Comment creation, Internal Note creation, Attachment upload/removal, and Requester resolution time.
- Backfill Requester-visible activity time from the maximum of Ticket creation/update, Public Comment creation, Attachment upload/removal, and Requester resolution time. Exclude Internal Notes. Lab 3 has no field-level activity log, so legacy `updatedAt` is an approximate recency marker and may include staff-only Owner changes. Do not expose the private change itself. After migration, update the Requester-visible timestamp only for the events listed in BR-20.
- Insert one `LEGACY_BASELINE` history event per existing Ticket at migration time. Do not invent an actor or earlier transition. A baseline is not a resolution event and does not qualify a legacy Ticket for the `recentlyResolved` metric.
- Existing Tickets receive no Actions Taken during migration.
- Test migration from a snapshot of populated Lab 3 tables and compare IDs, counts, relationships, statuses, and representative file metadata before/after. Test failure recovery in a disposable schema. Preserve a pre-migration backup for any persistent database.

### Seed decisions

Seeds shall be repeatable and use deterministic unique keys. Include every status, every priority, active assigned/unassigned Tickets, zero/one/multiple Actions Taken, both follow-up states, multiple performers different from Ticket Owners, and dashboard examples with zero and non-zero counts. Include recent and older activity on both public and Internal Note channels so privacy filters can be checked.

## 8. API Contract

The detailed request/response and authorization contract is in `api-spec.md`. It extends existing Lab 2–3 Ticket Detail responses, adds Actions Taken create/update, Requester and Staff dashboard endpoints, a Ticket version on status changes, and drill-down query filters. All writes remain protected by the existing session, same-origin, and CSRF middleware.

## 9. Acceptance Criteria

- **AC-01:** Given an authorized staff actor and valid Action Taken data on an active Ticket, when it is created, then the row is saved under the correct Ticket with server-managed performer identity, `followUpCompleted = false`, and all required fields.
- **AC-02:** Given a Ticket Owner and a different action performer, when the action is created/edited, then the Owner remains unchanged and the performer reflects the authenticated creator.
- **AC-03:** Given a Requester, IT Staff member, Administrator, unauthenticated user, or foreign Ticket id, when Action Taken APIs are called, then backend role and ownership rules are enforced with safe responses.
- **AC-04:** Given invalid Action Date/Time, blank/oversized fields, or a missing required Follow-up Note, when an action is submitted, then validation fails without creating/updating a row.
- **AC-05:** Given any current/next status pair, when the status API is called, then only the documented transition is accepted for an authorized IT Staff actor.
- **AC-06:** Given a Ticket with no Actions Taken or any incomplete required follow-up, when staff requests Resolved or Closed, then the server rejects it and leaves status/history unchanged. Once there is at least one Action Taken and every required follow-up is complete, the gate passes without changing the original `followUpRequired` value.
- **AC-07:** Given a successful Ticket transition, when status history is read, then the event is appended once, ordered deterministically, visible to permitted viewers, and not editable/deletable.
- **AC-08:** Given a duplicate create retry, identical stale Action Taken update retry, or stale Ticket version, when a write is retried, then no duplicate or overwrite occurs and the documented idempotent response or 409 conflict is returned.
- **AC-09:** Given a Requester, when their dashboard is read, then metric counts and recent rows use only their own Tickets and the documented seven-day UTC window.
- **AC-10:** Given IT Staff or permitted Administrator access, when the Staff dashboard is read, then backend counts correctly reflect unassigned, current-user-owned, current-user Actions Taken, status, priority, and staff-visible recent activity.
- **AC-11:** Given dashboard metric cards or recent rows, when activated, then the user reaches a useful filtered Ticket list or the matching Ticket Detail without receiving another role's data.
- **AC-12:** Given a populated Lab 3 database, when the migration runs, then all legacy business data is preserved, legacy Tickets get no fabricated Actions Taken, and truthful status baselines/activity timestamps are created.
- **AC-13:** Given the Lab 4 seed is run repeatedly, then it produces the required examples without duplicate records or credential changes.
- **AC-14:** Given create/edit/status/dashboard workflows at desktop, tablet, and mobile widths, then controls remain usable, focusable, readable, and free of clipping, overlap, or horizontal overflow, with safe feedback and retained input after recoverable failures.
- **AC-15:** Given the complete application, when the Lab 4 and Labs 1–3 regression suites run, then all required tests pass with no skipped or fabricated results.
- **AC-16:** Given the documented dashboard performance-smoke fixture, when dashboard APIs run repeatedly, then indexed aggregate queries meet the proposed local smoke target without loading complete Ticket collections.
- **AC-17:** Given the final app state, when evidence is captured, then genuine screenshots exist in all three required Lab 4 screenshot directories and demonstrate the required views and responsive states.
- **AC-18:** Given a Staff member assigns a Ticket Owner, when the target is inactive or has an ineligible role, then the backend returns a safe conflict and leaves the existing Owner unchanged. An active eligible assignee can still be assigned.
- **AC-19:** Given an Action Taken with `followUpRequired = true`, when its follow-up is completed, then staff can set `followUpCompleted = true` while the original required flag remains true, and the Ticket cannot resolve until all required follow-ups are complete.
- **AC-20:** Given a Ticket in `RESOLVED`, `CLOSED`, or `CANCELLED`, when staff creates or edits an Action Taken, then the server returns `409 ACTION_TAKEN_LOCKED` and leaves the record unchanged. After the Ticket is reopened, authorized staff can create or edit Actions Taken.

Every AC maps to planned tests in `tests.md`. Status remains Planned until a real run is performed.

## 10. Definition of Done

- [x] Student has reviewed and approved this specification plus `tests.md`, `ui-spec.md`, and `api-spec.md` before product implementation.
- [x] Every AC maps to at least one planned test and all required filenames match the Lab 4 sheet.
- [ ] Backend authorization, Owner/performer separation, the transition matrix, resolution gate, and append-only status history match this contract.
- [ ] Migration/backfill/recovery and repeatable seeds preserve all earlier data and meet the documented policy.
- [ ] Requester and Staff dashboards are authoritative, privacy-safe, and have working drill-downs.
- [ ] Responsive/accessibility and Labs 1–3 regression checks pass, including active-owner assignment and inactive/ineligible-assignee rejection.
- [ ] Genuine screenshots are stored in the required paths and reach `main` through reviewed PRs.
- [ ] All Issue PRs target `lab4-staging`, link through Development, and receive actual review/merge by the confirmed reviewer.
- [ ] The release PR to `main` is actually approved and merged by the confirmed reviewer.
- [ ] Every review comment receives a response, and requested fixes are made on that same PR branch. Work proceeds on one approved Issue and feature branch at a time, with no direct pushes to `lab4-staging` or `main`.
- [ ] Final test and evidence verification is performed from `main`.
- [ ] Exactly one concise PDF with Answer Parts 1–9 is prepared outside Git. The Answer Sheet, PDF, and generation files are not committed.

## 11. Approved Contract Decisions

1. **Append-only interpretation:** Ticket status history is append-only; Actions Taken are editable in place.
2. **Resolution gate:** at least one Action Taken is required, and every Action Taken that requires follow-up must have its separate completion state set before resolution.
3. **Action Taken status access:** create/edit is allowed on active statuses only. Resolved, Closed, and Cancelled Tickets must be reopened before Actions Taken changes.
4. **Administrator status access:** remains IT Staff only as in Lab 3. Administrators can use Actions Taken and Staff dashboards as the Lab 4 sheet permits.
5. **Dashboard recent window:** rolling seven days in UTC, with zero counts returned explicitly and recent lists limited to five rows.
6. **Action validation:** the approved lengths and date/required-note validation are defined in BR-07, BR-09, and BR-10.
7. **Legacy workflow history:** migration records a labeled current-state baseline at migration time because historical transitions/actors cannot be reconstructed.
8. **Activity privacy:** Internal Notes affect Staff activity only; they do not change Requester-visible recent activity. Requester-visible fields are enumerated in BR-20.
9. **Review and release:** Bank848 is the Lab 4 reviewer confirmed by the student. The reviewer must provide actual approval and perform the merge. Every comment receives a response and fixes remain on the same branch.
10. **Submission boundary:** Answer Sheet, final PDF, and PDF-generation files remain outside Git; the three required screenshot directories are committed through reviewed PRs.
