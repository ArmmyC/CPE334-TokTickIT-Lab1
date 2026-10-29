# Lab 4 REST API Specification

**Status:** Approved by the student. Implementation may begin after PR #71 comments are resolved and the reviewer merges it to `lab4-staging`.
**Base path:** `/api`
**Compatibility:** Preserve all approved Lab 2–3 routes and behavior.

## 1. Authentication and Mutation Rules

- Protected routes use the existing session middleware and require normal access. A session requiring an initial password change cannot access these routes.
- The existing same-origin check applies to API requests.
- Every state-changing route requires the existing CSRF token in `X-CSRF-Token`.
- Identity and authorization come from the authenticated session. The server never trusts a client-supplied requester ID, user ID, role, Ticket Owner, performer, editor, or action ID.
- Errors use the existing safe JSON style: `{ "error": "safe message", "code": "STABLE_CODE" }`. Validation may add `fieldErrors`. Do not return SQL, stack traces, file paths, credentials, session tokens, or protected resource existence.
- Requester access to a missing or foreign Ticket/Action Taken uses the same safe not-found response.

## 2. Role and Ownership Matrix

| Capability | Requester | IT Staff | Administrator |
| --- | --- | --- | --- |
| Requester dashboard | Own identity only | No | No |
| Staff dashboard | No | Yes | Yes, shared Staff metrics |
| Read Ticket Detail and Actions Taken | Owned Tickets only | Accessible Tickets | Permitted protected Ticket Detail |
| Create/update Actions Taken | No | Active accessible Tickets only | Active accessible Tickets only, as Lab 4 Section 4.3 permits |
| Read Ticket status history | Owned Tickets only | Accessible Tickets | Permitted protected Ticket Detail |
| Change formal Ticket status | No | Yes, matrix and gate enforced | No, preserve Lab 3 status authorization |
| Read Internal Notes | No | Existing Staff access | Existing permitted read-only access |

All role checks run in backend middleware/handlers. Hiding UI controls is not authorization.

## 3. Data Shapes

### Action Taken response

```json
{
  "id": 41,
  "ticketId": 12,
  "actionAt": "2026-10-29T03:00:00.000Z",
  "description": "Replaced the damaged power adapter.",
  "result": "The workstation starts normally.",
  "performedBy": { "id": 6, "name": "Nok Staff", "role": "IT_STAFF" },
  "followUpRequired": false,
  "followUpCompleted": false,
  "followUpNote": null,
  "attachmentNotes": "See the existing power test report in Attachments.",
  "version": 1,
  "createdAt": "2026-10-29T03:05:00.000Z",
  "updatedAt": "2026-10-29T03:05:00.000Z",
  "updatedBy": { "id": 6, "name": "Nok Staff", "role": "IT_STAFF" }
}
```

`performedBy` is immutable after creation. `updatedBy` describes the last editor and appears only in Staff/Admin detail. Requester responses omit `updatedBy` and still include the performer required by the sheet. New records start at `version: 1`; `updatedBy` is the creating actor until another authorized user edits the record. `followUpCompleted` starts false and is false whenever `followUpRequired` is false. No response returns the idempotency key or request fingerprint.

### Ticket status-history response

```json
{
  "id": 18,
  "fromStatus": "IN_PROGRESS",
  "toStatus": "RESOLVED",
  "eventKind": "TRANSITION",
  "actor": { "id": 6, "name": "Nok Staff", "role": "IT_STAFF" },
  "createdAt": "2026-10-29T03:10:00.000Z"
}
```

A `LEGACY_BASELINE` has null `fromStatus` and `actor`, and is labeled “Status at Lab 4 migration” in the UI. History is returned oldest first by `createdAt ASC, id ASC`. There is no update or delete endpoint.

## 4. Ticket Detail API Extensions

### `GET /api/tickets/:ticketId`

Preserve the Lab 3 Requester response shape and add:

- `version`
- `lastActivityAt` set to Requester-visible activity time
- `actionsTaken: ActionTaken[]`
- `statusHistory: TicketStatusHistory[]`

The authenticated Requester must own the Ticket. A foreign or missing Ticket returns `404 TICKET_NOT_FOUND`. No Internal Notes or staff-only activity timestamp is returned.

### `GET /api/staff/tickets/:ticketId`

Preserve the Lab 3 Staff/Admin detail shape and add:

- `version`
- `lastActivityAt` set to staff activity time
- `actionsTaken: ActionTaken[]`
- `statusHistory: TicketStatusHistory[]`

IT Staff and permitted Administrators can read the existing accessible Ticket Detail. Administrator content retains the Lab 3 read-only restrictions except for the Actions Taken create/update permission explicitly granted by Lab 4 Section 4.3. It does not receive formal status mutation permission.

Both detail routes order Actions Taken by `actionAt ASC, id ASC`. They include all Action Taken records for the Ticket, not only the latest one.

## 5. Actions Taken Endpoints

### `POST /api/staff/tickets/:ticketId/actions`

Allowed roles: `IT_STAFF`, `ADMINISTRATOR`. Requires CSRF and access to the Ticket.

Required header:

```text
Idempotency-Key: <UUID>
```

Request body:

```json
{
  "actionAt": "2026-10-29T03:00:00.000Z",
  "description": "Replaced the damaged power adapter.",
  "result": "The workstation starts normally.",
  "followUpRequired": false,
  "followUpNote": null,
  "attachmentNotes": "See the existing power test report in Attachments."
}
```

The body does not accept `ticketId`, `performedById`, `updatedById`, `ownerId`, `role`, `version`, or `followUpCompleted`. The server takes the actor from the session, forces `followUpCompleted = false`, and in a transaction serialized on the parent Ticket requires an active status: `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, or `REOPENED`. It stores a unique `(performedById, Idempotency-Key)` pair and an immutable fingerprint of the canonical request payload. An exact replay returns the existing row's current representation without mutation, even if it was edited after creation or the Ticket has since become terminal. If simultaneous requests race on the unique key, the loser reloads the existing row and applies the same fingerprint comparison instead of surfacing a database error.

- First successful submission returns `201 { "actionTaken": ActionTaken }`.
- A replay with the same actor, key, Ticket, and equivalent payload returns `200 { "actionTaken": ActionTaken, "replayed": true }` without another row.
- Reusing the key with a different Ticket or normalized payload returns `409 IDEMPOTENCY_KEY_REUSED`. A missing or malformed UUID key returns `400 VALIDATION_FAILED`.
- Invalid values return `400 VALIDATION_FAILED` with field errors.
- Missing/foreign Ticket returns `404 TICKET_NOT_FOUND`.
- A new Action Taken on `RESOLVED`, `CLOSED`, or `CANCELLED` returns `409 ACTION_TAKEN_LOCKED` without creating a row. Reopen the Ticket before recording work.
- Missing session returns `401 AUTHENTICATION_REQUIRED`; forbidden role/CSRF returns `403`.

### `PATCH /api/staff/tickets/:ticketId/actions/:actionId`

Allowed roles: `IT_STAFF`, `ADMINISTRATOR`. Requires CSRF and access to both the parent Ticket and Action Taken.

Request body:

```json
{
  "expectedVersion": 1,
  "actionAt": "2026-10-29T03:00:00.000Z",
  "description": "Replaced the damaged power adapter.",
  "result": "The workstation starts normally.",
  "followUpRequired": true,
  "followUpCompleted": true,
  "followUpNote": "Check battery health next week.",
  "attachmentNotes": null
}
```

The server updates the current Action Taken row in place and preserves `performedBy` and the original idempotency fingerprint. When `followUpRequired` is true, `followUpCompleted` may be set true only after the work is complete; the required flag and note remain intact. When `followUpRequired` is false, the note is null and completion is false. A successful changed edit increments the Action Taken version and parent `Ticket.version`, and sets `updatedAt`/`updatedBy`. A no-op retry whose normalized mutable fields already equal the stored row returns `200 { "actionTaken": ActionTaken, "replayed": true }` without changing either version or editor metadata, including when its `expectedVersion` is stale or the Ticket has since become terminal. This state comparison is performed before stale-version and terminal-lock checks.

Other edits require an active Ticket. A changed edit on `RESOLVED`, `CLOSED`, or `CANCELLED` returns `409 ACTION_TAKEN_LOCKED` and leaves the row unchanged; staff must reopen the Ticket before editing. On an active Ticket, a stale version whose requested state differs from the current row returns `409 ACTION_TAKEN_VERSION_CONFLICT` with the current safe Action Taken representation. A valid changed edit uses the expected current Action Taken version. It never creates an edit revision. Other validation, ownership, session, role, and CSRF failures follow the POST behavior.

There is no Action Taken delete endpoint.

## 6. Ticket Status Endpoint

### `PATCH /api/staff/tickets/:ticketId/status`

Allowed role: `IT_STAFF` only. Requires CSRF. Request:

```json
{
  "expectedVersion": 4,
  "nextStatus": "RESOLVED",
  "confirmed": true
}
```

The server reads current status from the database and never trusts a client-supplied current status. It validates `nextStatus` against the Lab 3 transition matrix plus the approved resolution gate. `confirmed: true` is required for `RESOLVED`, `CLOSED`, and `CANCELLED`. The resolution gate requires at least one Action Taken and requires `followUpCompleted = true` for every Action Taken where `followUpRequired = true`. The gate check and status write serialize with Action Taken create/edit on the same parent Ticket. Success atomically updates Ticket status/version and inserts exactly one immutable status-history event. Return `200` with the Staff Ticket Detail shape.

New and migrated Tickets start at `version: 0`. `Ticket.version` increments in the same transaction as a formal status transition, Owner assignment, IT Priority change, Requester resolution indication change, or Action Taken create/edit. Public Comments, Internal Notes, Attachments, and activity-timestamp maintenance do not increment it. A stale status form therefore conflicts after any write that changes an Owner, IT Priority, Requester resolution indication, status, or Action Taken. Successful action changes return the current Action Taken representation; the client reloads Ticket Detail to obtain the new Ticket version and resolution-gate state.

- Unlisted transition: `409 STATUS_TRANSITION_CONFLICT`, including current status and permitted next statuses.
- Failed resolution gate: `409 RESOLUTION_GATE_BLOCKED`, with safe conditions that must be met.
- Stale `expectedVersion`: `409 TICKET_VERSION_CONFLICT`, including the current status/version.
- Invalid body or missing confirmation: `400 VALIDATION_FAILED`.
- Missing/foreign Ticket: `404 TICKET_NOT_FOUND`.
- No row/event changes on any failure.

### Existing Owner assignment guard

`PATCH /api/staff/tickets/:ticketId/owner` remains IT Staff only and requires CSRF. A target must be an active IT Staff member or Administrator. An inactive or ineligible target returns `409 OWNER_NOT_ELIGIBLE` and leaves the current Owner unchanged. This endpoint changes Ticket Owner only and never changes Action Taken Performed by.

## 7. Dashboard Endpoints

All metric counts and recent rows are calculated by the server from PostgreSQL. Clients do not submit a user ID. `asOf` and `windowStart` are server-generated UTC timestamps; the rolling window is the inclusive lower bound `[asOf - 7 days, asOf]`.

### `GET /api/requester/dashboard`

Allowed role: `REQUESTER`. Example:

```json
{
  "dashboard": {
    "asOf": "2026-10-29T03:00:00.000Z",
    "windowStart": "2026-10-22T03:00:00.000Z",
    "metrics": {
      "openTickets": 4,
      "waitingForRequester": 1,
      "recentlyUpdated": 2,
      "recentlyResolved": 1
    },
    "recentlyUpdatedTickets": [
      {
        "ticketId": 12,
        "ticketNumber": "TKT-2026-000012",
        "summary": "Campus Wi-Fi disconnects",
        "currentStatus": "IN_PROGRESS",
        "itPriority": "HIGH",
        "lastActivityAt": "2026-10-29T02:40:00.000Z"
      }
    ],
    "recentlyResolvedTickets": []
  }
}
```

Definitions:
- `openTickets`: owned Tickets in `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, or `REOPENED`.
- `waitingForRequester`: owned Tickets with current status `WAITING_FOR_REQUESTER`.
- `recentlyUpdated`: owned Tickets whose Requester-visible activity is within the window.
- `recentlyResolved`: owned Tickets currently `RESOLVED` or `CLOSED` whose latest `TRANSITION` event into `RESOLVED` is within the window. A later `REOPENED` or `CANCELLED` state excludes the Ticket. A `LEGACY_BASELINE` is never treated as a resolution event.
- Recent arrays contain at most five rows, sorted by their event/activity timestamp descending, then Ticket number descending. A metric with no matches returns zero and an empty array.
- Requester dashboard rows expose only approved Requester-visible fields: Ticket number, Summary, current status, IT Priority, and Requester-visible activity or resolution time. They never include Owner, Internal Notes, or staff-only activity timestamps.

### `GET /api/staff/dashboard`

Allowed roles: `IT_STAFF`, `ADMINISTRATOR`. Example:

```json
{
  "dashboard": {
    "asOf": "2026-10-29T03:00:00.000Z",
    "windowStart": "2026-10-22T03:00:00.000Z",
    "metrics": {
      "unassigned": 2,
      "ownedByMe": 3,
      "actionsTakenByMe": 9,
      "recentlyUpdated": 5
    },
    "activeByStatus": {
      "NEW": 1,
      "OPEN": 2,
      "IN_PROGRESS": 3,
      "WAITING_FOR_REQUESTER": 1,
      "REOPENED": 0
    },
    "activeByItPriority": {
      "LOW": 1,
      "MEDIUM": 2,
      "HIGH": 3,
      "URGENT": 0,
      "UNASSIGNED": 1
    },
    "recentlyUpdatedTickets": [],
    "recentActionsTakenByMe": [
      {
        "actionId": 41,
        "ticketId": 12,
        "ticketNumber": "TKT-2026-000012",
        "summary": "Campus Wi-Fi disconnects",
        "actionAt": "2026-10-29T02:40:00.000Z",
        "result": "Connection remains stable.",
        "followUpRequired": false
      }
    ]
  }
}
```

Definitions:
- `unassigned`: active Tickets with no Owner.
- `ownedByMe`: active Tickets whose Owner is the authenticated user.
- `actionsTakenByMe`: all Action Taken rows performed by the authenticated user, across Ticket statuses. It is independent of Ticket Owner.
- `recentActionsTakenByMe`: at most five Actions Taken by the authenticated user, ordered by Action Date/Time descending, then action ID descending. Each row links to its Ticket Detail.
- `activeByStatus` and `activeByItPriority`: counts over active statuses only, including zero values for every key.
- `recentlyUpdated`: Tickets whose staff-visible activity is within the rolling window.
- Recent rows are limited to five and sorted by staff activity descending, then Ticket number descending. They include only fields permitted in Staff Ticket Queue/Detail.
- Administrator uses the same approved operational dashboard. Optional account-count metrics are excluded from this increment unless separately approved.

### Dashboard drill-down filters

Dashboard links use the existing detailed Ticket lists, extended by the following server-side query parameters:

- Requester `GET /api/tickets`: `statusGroup=ACTIVE|RESOLVED`, optional `activitySince=<UTC ISO timestamp>` and `activityUntil=<UTC ISO timestamp>`, and optional `resolvedSince=<UTC ISO timestamp>` and `resolvedUntil=<UTC ISO timestamp>`.
- Staff `GET /api/staff/tickets`: `statusGroup=ACTIVE`, optional `activitySince` and `activityUntil`, existing status/priority filters, `ownerId=ME` for the authenticated user or `UNASSIGNED`, and `actionPerformedBy=ME` to list Tickets with at least one action by the authenticated user. Existing numeric owner filters retain their permission checks. The `actionsTakenByMe` card uses `actionPerformedBy=ME` without `statusGroup` to include work on any Ticket status.
- `statusGroup=ACTIVE` means `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, or `REOPENED`; `statusGroup=RESOLVED` means current `RESOLVED` or `CLOSED`. Requester `activitySince`/`activityUntil` filter `lastRequesterVisibleActivityAt`; Staff filters use `lastStaffActivityAt`. All provided time bounds are inclusive and the dashboard supplies the same `windowStart` and `asOf` used by its metric.
- `resolvedSince`/`resolvedUntil` filter the latest real transition into `RESOLVED`, and return only Tickets currently `RESOLVED` or `CLOSED`. `ownerId=ME` is resolved from the session, and `actionPerformedBy=ME` matches immutable `performedById`, not Ticket Owner or latest editor.
- A `statusGroup` cannot be combined with a single-status filter. Invalid or contradictory filters return `400 VALIDATION_FAILED`.
- Requester recently updated links use `activitySince=<windowStart>&activityUntil=<asOf>`; recent resolved links use `statusGroup=RESOLVED&resolvedSince=<windowStart>&resolvedUntil=<asOf>`. Staff recently updated links use the matching staff-activity time range. The Actions Taken by Me card links to the `actionPerformedBy=ME` Ticket Queue filter, whose Ticket Details show the matching action records. The recent-actions list also links directly to each matching Ticket Detail.

## 8. Status History and Activity Updates

- Requester detail returns only the owned Ticket's Actions Taken and status history.
- Staff/Admin detail returns status history for an accessible Ticket. Requester-visible status events contain only status, actor summary, event kind, and time, never Internal Note content.
- Initial Ticket creation, status changes, Action Taken changes, Public Comments, Attachments, Requester resolution indications, and relevant Ticket field changes update the appropriate activity timestamps in the same transaction. Staff-only Owner assignment updates staff activity but not Requester-visible activity. Legacy migration baselines are not treated as resolution events.
- Internal Notes update staff activity only. They do not affect Requester-visible recent counts or timestamps.
- Status history is inserted only. The database trigger and application layer reject update/delete attempts.

## 9. Common Error Matrix

| HTTP status | Code | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | Body/query value invalid or missing |
| 401 | `AUTHENTICATION_REQUIRED` | No valid normal-access session |
| 403 | `FORBIDDEN`, `CSRF_VALIDATION_FAILED` | Role, same-origin, or CSRF rule failed |
| 404 | `TICKET_NOT_FOUND`, `ACTION_TAKEN_NOT_FOUND` | Missing or protected resource, with no foreign-resource disclosure |
| 409 | `STATUS_TRANSITION_CONFLICT` | Transition not permitted by matrix |
| 409 | `RESOLUTION_GATE_BLOCKED` | Resolution prerequisites are unmet |
| 409 | `TICKET_VERSION_CONFLICT`, `ACTION_TAKEN_VERSION_CONFLICT` | Stale version |
| 409 | `IDEMPOTENCY_KEY_REUSED` | Key replayed with a different payload/Ticket |
| 409 | `ACTION_TAKEN_LOCKED` | A changed Action Taken write targets a Resolved, Closed, or Cancelled Ticket |
| 500 | `INTERNAL_ERROR` | Safe generic operation failure |

## 10. Existing API Regression

All approved Lab 2–3 routes remain available with their existing semantics, including authentication, requester Ticket create/list/detail, Attachments, Public Comments, Requester resolution indication, Staff Queue and Ticket Detail, ownership, priority, status, Internal Notes, and Administrator User Management. Only documented response additions and dashboard drill-down query parameters change.
