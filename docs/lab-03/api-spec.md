# Lab 3 REST API Specification

## Contract conventions

- Base path: `/api`.
- JSON request and response bodies use camelCase.
- Dates are ISO 8601 strings in JSON.
- Protected endpoints use the authenticated session from the `toktickit_session` HttpOnly cookie.
- The client sends the non-HttpOnly `toktickit_csrf` value in the `X-CSRF-Token` header for state-changing requests.
- A same-origin `Origin` header is required when the browser sends one. The API rejects an unexpected Origin before the route handler.
- The server never trusts a client-supplied requesterId, userId, ownerId, authorId, or role for identity or authorization.
- Error responses use `{ "error": "safe message", "code": "stable code" }`. Validation responses may add `{ "fieldErrors": { "field": "message" } }`.
- Error messages do not contain stack traces, SQL, password data, session tokens, filesystem paths, or whether a foreign protected resource exists.

### Authentication decisions

- Passwords use Node `scrypt` with `N = 32768`, `r = 8`, `p = 1`, a random 16-byte salt, a 32-byte derived key, and a 64 MiB maximum-memory limit. The stored hash is versioned with these parameters and verification uses constant-time comparison.
- `toktickit_session` contains an opaque session identifier. The database stores only its hash, the CSRF token hash, User id, `createdAt`, `lastUsedAt`, `expiresAt` for the sliding eight-hour inactivity deadline, `absoluteExpiresAt` for the fixed 24-hour lifetime, and `revokedAt`.
- A valid protected request updates `lastUsedAt` and the sliding deadline but never extends `absoluteExpiresAt`. Logout sets `revokedAt` and clears both cookies.
- After five failed login attempts for the same normalized email and source IP within 15 minutes, attempts are throttled for 15 minutes. A successful login clears the limiter. Throttling returns `429` with a generic `AUTHENTICATION_THROTTLED` response and never permanently locks the account.

## Authentication and sessions

### `POST /api/auth/login`

Public endpoint. Request:

```json
{
  "email": "ariya@example.test",
  "password": "Initial-password1!"
}
```

Success `200` sets `toktickit_session` and `toktickit_csrf` cookies and returns:

```json
{
  "user": {
    "id": 1,
    "name": "Ariya Anderson",
    "email": "ariya@example.test",
    "role": "REQUESTER",
    "isActive": true,
    "mustChangePassword": true
  },
  "passwordChangeRequired": true
}
```

The response never includes a password, password hash, raw session token, or CSRF token. Invalid input returns `400` with field errors. Invalid credentials and inactive accounts both return `401` with code `AUTHENTICATION_FAILED` and the same safe message. A throttled attempt returns `429` with code `AUTHENTICATION_THROTTLED` and a generic safe message. None of these responses reveal whether the email exists.

### `POST /api/auth/logout`

Requires an authenticated session and CSRF header. Revokes the current session, clears both cookies, and returns `204`. A missing or already revoked session returns `204` so logout is idempotent.

### `GET /api/auth/me`

Publicly callable for session discovery. A valid session returns `200` with the same non-sensitive `user` shape and `passwordChangeRequired` flag as login. No valid session returns `401` with code `AUTHENTICATION_REQUIRED`. A valid restricted session is still returned so the client can open Change Password.

### `POST /api/auth/change-password`

Requires an authenticated session. A restricted session is permitted. Request:

```json
{
  "currentPassword": "Initial-password1!",
  "newPassword": "New-strong-password1!",
  "confirmPassword": "New-strong-password1!"
}
```

The server verifies the current password, applies the password rules, clears `mustChangePassword`, revokes other sessions, refreshes the current session expiry, and returns `200` with the current non-sensitive User. Invalid values return `400`, incorrect current password returns `401` with code `PASSWORD_CHANGE_FAILED`, and an already invalid session returns `401`.

## Authenticated reference data

### `GET /api/categories`

Requires any authenticated User without a pending password change. Returns active Categories ordered by id:

```json
[
  { "id": 1, "name": "Account and Access" }
]
```

### `GET /api/related-systems`

Requires any authenticated User without a pending password change. Returns active Related Systems ordered by name using the Lab 2 shape.

The old `GET /api/development-requesters` selector endpoint is removed from the Lab 3 product contract. A direct call returns `404` or another documented non-selector response and never creates an authentication context.

## Requester Ticket APIs

All endpoints in this section require role `REQUESTER` unless the authorization matrix below explicitly permits another role. The Requester identity comes from the session.

### `POST /api/tickets`

Request:

```json
{
  "categoryId": 1,
  "relatedSystemId": 2,
  "summary": "Campus Wi-Fi disconnects",
  "description": "The connection drops repeatedly in the engineering lab.",
  "requestedPriority": "HIGH"
}
```

The server validates active reference data and creates a Ticket owned by the session User. It initializes IT Priority to the requested priority and status to `NEW`. Success `201` returns this exact shape with the backend-generated Ticket Number:

```json
{
  "ticket": {
    "id": 12,
    "ticketNumber": "TKT-2026-000012",
    "ticketDate": "2026-09-08T10:00:00.000Z",
    "requester": { "id": 1, "name": "Ariya Anderson", "email": "ariya@example.test" },
    "category": { "id": 1, "name": "Account and Access" },
    "relatedSystem": { "id": 2, "name": "Campus Wi-Fi" },
    "summary": "Campus Wi-Fi disconnects",
    "description": "The connection drops repeatedly in the engineering lab.",
    "requestedPriority": "HIGH",
    "itPriority": "HIGH",
    "currentStatus": "NEW",
    "owner": null,
    "createdAt": "2026-09-08T10:00:00.000Z",
    "updatedAt": "2026-09-08T10:00:00.000Z"
  }
}
```

Client-supplied `requesterId`, owner, status, IT Priority, or Ticket Number is rejected with `400`.

### `GET /api/tickets`

Returns only Tickets owned by the session Requester. Supported query parameters:

- `page`, default `1`, positive integer.
- `pageSize`, one of `10`, `20`, or `50`, default `10`.
- `search`, up to `120` characters, case-insensitive over Ticket Number, Summary, and Description.
- `categoryId`, active Category id.
- `relatedSystemId`, active Related System id.
- `requestedPriority`, one of `LOW`, `MEDIUM`, `HIGH`, or `URGENT`.
- `currentStatus`, one of the Lab 3 status values.
- `sortBy`, one of `ticketDate`, `updatedAt`, or `ticketNumber`, default `updatedAt`.
- `sortOrder`, `asc` or `desc`, default `desc`.

Success `200` returns:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 10,
  "totalItems": 0,
  "totalPages": 0,
  "hasNext": false,
  "hasPrevious": false
}
```

Invalid query values return `400` with field errors. A valid page beyond the end returns an empty `items` array with accurate metadata.

### `GET /api/tickets/:ticketId`

Returns `200` with this exact response shape for an owned Ticket:

```json
{
  "ticket": {
    "id": 12,
    "ticketNumber": "TKT-2026-000012",
    "ticketDate": "2026-09-08T10:00:00.000Z",
    "summary": "Campus Wi-Fi disconnects",
    "description": "The connection drops repeatedly in the engineering lab.",
    "requester": { "id": 1, "name": "Ariya Anderson", "email": "ariya@example.test" },
    "category": { "id": 4, "name": "Network" },
    "relatedSystem": { "id": 2, "name": "Campus Wi-Fi" },
    "requestedPriority": "HIGH",
    "itPriority": "HIGH",
    "currentStatus": "NEW",
    "owner": null,
    "attachments": [],
    "publicComments": [],
    "requesterResolution": null,
    "createdAt": "2026-09-08T10:00:00.000Z",
    "updatedAt": "2026-09-08T10:00:00.000Z"
  }
}
```

A missing or foreign Ticket returns `404` with code `TICKET_NOT_FOUND`.

### `POST /api/tickets/:ticketId/attachments`

Multipart form with one `file`. The authenticated Requester must own the Ticket. Preserve the Lab 2 allowed MIME and extension pairs, 5 MB limit, five active Attachment limit, generated storage key, safe filename metadata, and compensation behavior. Success returns `201` with this exact metadata shape:

```json
{
  "attachment": {
    "id": 1,
    "ticketId": 12,
    "originalName": "evidence.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 12000,
    "uploadedAt": "2026-09-08T10:05:00.000Z",
    "removedAt": null,
    "removalReason": null,
    "downloadAvailable": true
  }
}
```

### `GET /api/attachments/:attachmentId`

Returns `200` with `{ "attachment": { "id": 1, "ticketId": 12, "originalName": "evidence.pdf", "mimeType": "application/pdf", "sizeBytes": 12000, "uploadedAt": "2026-09-08T10:05:00.000Z", "removedAt": null, "removalReason": null, "downloadAvailable": true } }` only when the authenticated User is allowed to read the owning Ticket. Removed, foreign, or missing Attachments return the same safe `404`.

### `GET /api/attachments/:attachmentId/download`

Returns active Attachment bytes with safe `Content-Disposition`, `Content-Type`, `Content-Length`, `X-Content-Type-Options: nosniff`, and private no-store caching. Accepts `disposition=inline` or `disposition=attachment`. Removed, foreign, missing, or missing-storage content returns the same safe `404`.

Requester owners, IT Staff, and Administrators with permitted Ticket visibility may read. Only Requester owners may upload or remove.

### `DELETE /api/attachments/:attachmentId`

Requires an authenticated Requester owner and CSRF header. Request:

```json
{ "removalReason": "No longer needed for this report." }
```

Soft-removes the Attachment and returns `200` with `{ "attachment": { "id": 1, "ticketId": 12, "originalName": "evidence.pdf", "mimeType": "application/pdf", "sizeBytes": 12000, "uploadedAt": "2026-09-08T10:05:00.000Z", "removedAt": "2026-09-08T10:10:00.000Z", "removalReason": "No longer needed for this report.", "downloadAvailable": false } }`. A repeat removal returns `409`. The record and removal reason remain visible as metadata.

### `GET /api/tickets/:ticketId/comments`

Returns `200` with `{ "items": [{ "id": 4, "content": "The issue still occurs.", "author": { "id": 1, "name": "Ariya Anderson", "role": "REQUESTER" }, "createdAt": "2026-09-08T11:00:00.000Z" }] }` when the session User is the owning Requester, IT Staff, or Administrator with permitted Ticket visibility.

### `POST /api/tickets/:ticketId/comments`

Allows an owning Requester or IT Staff to append a Public Comment. Request:

```json
{ "content": "The issue still occurs after restarting." }
```

Blank or overlong content returns `400` with `VALIDATION_FAILED`. Success returns `201` with `{ "comment": { "id": 4, "content": "The issue still occurs after restarting.", "author": { "id": 1, "name": "Ariya Anderson", "role": "REQUESTER" }, "createdAt": "2026-09-08T11:00:00.000Z" } }`.

### `POST /api/tickets/:ticketId/requester-resolution`

Allows only the owning Requester. The endpoint records `requesterResolvedAt` and `requesterResolvedById` from the authenticated User. Success returns `200` with `{ "requesterResolution": { "resolvedAt": "2026-09-08T11:45:00.000Z", "resolvedBy": { "id": 1, "name": "Ariya Anderson", "role": "REQUESTER" } } }`. A repeated indication returns `409` with `{ "error": "The resolution indication has already been recorded.", "code": "RESOLUTION_ALREADY_RECORDED" }`. It does not change formal status.

## IT Staff and permitted Administrator Ticket APIs

All mutation endpoints in this section require CSRF. Ownership and status mutations require role `IT_STAFF`. IT Priority mutation permits `IT_STAFF` or `ADMINISTRATOR`. Read-only visibility for Public Comments, Internal Notes, Ticket Detail, and Attachments may also be granted to `ADMINISTRATOR` as specified below.

### `GET /api/staff/tickets`

Requires `IT_STAFF`. Supported query parameters:

- `page`, positive integer, default `1`.
- `pageSize`, one of `10`, `20`, or `50`, default `20`.
- `search`, up to `120` characters over Ticket Number, Summary, Description, Requester name, and Requester email.
- `status`, one Ticket Status.
- `requestedPriority`, one Requested Priority.
- `itPriority`, one Ticket Priority or `UNASSIGNED`.
- `ownerId`, positive integer or `UNASSIGNED`.
- `categoryId`, active Category id.
- `relatedSystemId`, active Related System id.
- `sortBy`, one of `ticketDate`, `updatedAt`, `ticketNumber`, `requestedPriority`, `itPriority`, or `currentStatus`, default `updatedAt`.
- `sortOrder`, `asc` or `desc`, default `desc`.

The default order is `updatedAt desc, id desc`. When a sort field and direction are supplied, the requested field uses that direction and `id` uses the same direction as the deterministic tie breaker.

Response:

```json
{
  "items": [
    {
      "id": 12,
      "ticketNumber": "TKT-2026-000012",
      "ticketDate": "2026-09-08T10:00:00.000Z",
      "summary": "Campus Wi-Fi disconnects",
      "requester": { "id": 1, "name": "Ariya Anderson", "email": "ariya@example.test" },
      "category": { "id": 4, "name": "Network" },
      "relatedSystem": { "id": 2, "name": "Campus Wi-Fi" },
      "requestedPriority": "HIGH",
      "itPriority": "URGENT",
      "currentStatus": "IN_PROGRESS",
      "owner": { "id": 6, "name": "Nok Staff", "role": "IT_STAFF" },
      "updatedAt": "2026-09-08T11:00:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalItems": 1,
  "totalPages": 1,
  "hasNext": false,
  "hasPrevious": false
}
```

Invalid values return `400` with field errors. Unauthenticated callers receive `401`, and authenticated non-Staff callers receive `403` without queue data.

### `GET /api/staff/tickets/:ticketId`

Allows `IT_STAFF` and read-only `ADMINISTRATOR` access. Returns `200` with this exact response shape:

```json
{
  "ticket": {
    "id": 12,
    "ticketNumber": "TKT-2026-000012",
    "ticketDate": "2026-09-08T10:00:00.000Z",
    "summary": "Campus Wi-Fi disconnects",
    "description": "The connection drops repeatedly in the engineering lab.",
    "requester": { "id": 1, "name": "Ariya Anderson", "email": "ariya@example.test" },
    "category": { "id": 4, "name": "Network" },
    "relatedSystem": { "id": 2, "name": "Campus Wi-Fi" },
    "requestedPriority": "HIGH",
    "itPriority": "URGENT",
    "currentStatus": "IN_PROGRESS",
    "owner": { "id": 6, "name": "Nok Staff", "email": "nok@example.test", "role": "IT_STAFF" },
    "attachments": [],
    "publicComments": [],
    "internalNotes": [],
    "requesterResolution": null,
    "createdAt": "2026-09-08T10:00:00.000Z",
    "updatedAt": "2026-09-08T11:00:00.000Z"
  }
}
```

A missing Ticket returns `404` with code `TICKET_NOT_FOUND`.

### `PATCH /api/staff/tickets/:ticketId/owner`

Allows `IT_STAFF` with CSRF. Request:

```json
{ "ownerId": 6 }
```

Use `ownerId: null` to clear ownership. The target must be an active IT Staff or Administrator. A missing, non-integer, or malformed `ownerId` returns `400` with `VALIDATION_FAILED`. An inactive User or a User with an ineligible role returns `409` with `OWNER_NOT_ELIGIBLE`. Success returns `200` with the Staff Ticket Detail response shape.

### `PATCH /api/staff/tickets/:ticketId/priority`

Allows `IT_STAFF` or `ADMINISTRATOR` with CSRF. Request:

```json
{ "itPriority": "URGENT" }
```

The value must be `LOW`, `MEDIUM`, `HIGH`, or `URGENT`. The Requester-submitted Requested Priority is never changed. Success returns `200` with the Staff Ticket Detail response shape. Invalid input returns `400` with `VALIDATION_FAILED`, and a missing or protected Ticket returns `404` with `TICKET_NOT_FOUND`.

### `PATCH /api/staff/tickets/:ticketId/status`

Allows `IT_STAFF`. Request:

```json
{ "currentStatus": "RESOLVED", "confirmed": true }
```

The server checks the transition matrix. `confirmed: true` is required for `RESOLVED`, `CLOSED`, and `CANCELLED`. Success returns `200` with the Staff Ticket Detail response shape. Invalid transitions return `409` with `{ "error": "The requested status transition is not allowed.", "code": "STATUS_TRANSITION_CONFLICT", "currentStatus": "IN_PROGRESS", "allowedStatuses": ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"] }` without changing the row. Invalid input returns `400` with `VALIDATION_FAILED`.

### `GET /api/staff/tickets/:ticketId/comments`

Allows `IT_STAFF` and read-only `ADMINISTRATOR`. Returns `200` with `{ "items": [{ "id": 4, "content": "The issue still occurs.", "author": { "id": 6, "name": "Nok Staff", "role": "IT_STAFF" }, "createdAt": "2026-09-08T11:00:00.000Z" }] }` in creation order.

### `POST /api/staff/tickets/:ticketId/comments`

Allows `IT_STAFF` with CSRF. The request shape is `{ "content": "The issue still occurs after restarting." }`, and success returns `201` with `{ "comment": { "id": 4, "content": "The issue still occurs after restarting.", "author": { "id": 6, "name": "Nok Staff", "role": "IT_STAFF" }, "createdAt": "2026-09-08T11:00:00.000Z" } }`. Blank or overlong content returns `400` with `VALIDATION_FAILED`.

### `GET /api/staff/tickets/:ticketId/notes`

Allows `IT_STAFF` and `ADMINISTRATOR`. Returns `200` with `{ "items": [{ "id": 7, "content": "Waiting for network team confirmation.", "author": { "id": 6, "name": "Nok Staff", "role": "IT_STAFF" }, "createdAt": "2026-09-08T11:30:00.000Z" }] }` in creation order. Requesters receive `403` for their own Ticket and the safe protected-resource response for a foreign Ticket.

### `POST /api/staff/tickets/:ticketId/notes`

Allows `IT_STAFF` with CSRF. The request shape is `{ "content": "Waiting for network team confirmation." }`, and success returns `201` with `{ "note": { "id": 7, "content": "Waiting for network team confirmation.", "author": { "id": 6, "name": "Nok Staff", "role": "IT_STAFF" }, "createdAt": "2026-09-08T11:30:00.000Z" } }`. Blank or overlong content returns `400` with `VALIDATION_FAILED`. The resource is never returned to Requester APIs.

## Administrator User APIs

All endpoints require role `ADMINISTRATOR` and CSRF for mutations.

### `GET /api/admin/users`

Query parameters:

- `search`, optional trimmed text over name or email, maximum `120` characters.
- `role`, optional one of `REQUESTER`, `IT_STAFF`, or `ADMINISTRATOR`.

Returns an array of `{ id, name, email, role, isActive, mustChangePassword, createdAt, updatedAt }`. Password hashes, sessions, and initial password values are never returned. Invalid role or search value returns `400`.

### `POST /api/admin/users`

Request:

```json
{
  "name": "New Requester",
  "email": "new.requester@example.test",
  "role": "REQUESTER",
  "isActive": true,
  "initialPassword": "Initial-password1!"
}
```

Success `201` returns the safe User shape. Duplicate normalized email returns `409`. Invalid role, name, email, or initial password returns `400`.

### `PATCH /api/admin/users/:userId`

Request may include any of `name`, `email`, `role`, and `isActive` but must include at least one. The endpoint applies duplicate-email, role, self-deactivation, and last-active-Administrator protections. Changing role or activation state does not delete Ticket history. Success `200` returns the safe User shape.

### `POST /api/admin/users/:userId/initial-password`

Request:

```json
{ "initialPassword": "New-initial-password1!" }
```

Sets a new password hash, sets `mustChangePassword = true`, revokes all existing sessions for the target User, and returns the safe User shape. The new password is never returned.

## Authorization matrix

| Capability | Requester | IT Staff | Administrator |
| --- | --- | --- | --- |
| Health | Public | Public | Public |
| Login, logout, current user | Own session | Own session | Own session |
| Categories and Related Systems | Yes | Yes | Yes |
| Create Ticket | Own identity | No | No |
| List or detail own Tickets | Own only | No through Requester route | No through Requester route |
| Staff Queue | No | Yes | No |
| Staff Ticket Detail | No | Yes | Read-only except IT Priority |
| Claim, assign, status | No | Yes | No |
| IT Priority | No | Yes | Yes |
| Read Public Comments | Own Ticket | Any visible Ticket | Visible Ticket |
| Create Public Comments | Own Ticket | Any visible Ticket | No |
| Read Internal Notes | No | Any visible Ticket | Visible Ticket |
| Create Internal Notes | No | Any visible Ticket | No |
| Requester resolution indication | Own Ticket | No | No |
| Attachment read | Own Ticket | Visible Ticket | Visible Ticket |
| Attachment upload or soft removal | Own Ticket | No | No |
| User Management | No | No | Yes |

## Status transition matrix

| Current status | Allowed next statuses | Role | Confirmation |
| --- | --- | --- | --- |
| `NEW` | `OPEN`, `CANCELLED` | IT Staff | Cancelled yes |
| `OPEN` | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `CANCELLED` | IT Staff | Cancelled yes |
| `IN_PROGRESS` | `WAITING_FOR_REQUESTER`, `RESOLVED`, `CANCELLED` | IT Staff | Resolved and Cancelled yes |
| `WAITING_FOR_REQUESTER` | `IN_PROGRESS`, `RESOLVED`, `CANCELLED` | IT Staff | Resolved and Cancelled yes |
| `RESOLVED` | `CLOSED`, `REOPENED` | IT Staff | Closed yes |
| `CLOSED` | `REOPENED` | IT Staff | No |
| `REOPENED` | `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `CANCELLED` | IT Staff | Cancelled yes |
| `CANCELLED` | `REOPENED` | IT Staff | No |

The Requester resolution indication is not a transition. The backend rejects every transition not listed above.

## Error matrix

| Status | Code | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_FAILED` | Input or query values are invalid |
| `401` | `AUTHENTICATION_REQUIRED` or `AUTHENTICATION_FAILED` | No valid session or safe login failure |
| `403` | `FORBIDDEN` or `PASSWORD_CHANGE_REQUIRED` | Session exists but role or password state is not permitted |
| `404` | `TICKET_NOT_FOUND`, `ATTACHMENT_NOT_FOUND`, or `USER_NOT_FOUND` | Missing or protected resource uses safe not-found behavior |
| `409` | `CONFLICT`, `OWNER_NOT_ELIGIBLE`, `STATUS_TRANSITION_CONFLICT`, or `RESOLUTION_ALREADY_RECORDED` | Duplicate email, ineligible owner, invalid state transition, repeat resolution, or repeat Attachment removal |
| `413` | `ATTACHMENT_TOO_LARGE` | Attachment exceeds 5 MB |
| `415` | `ATTACHMENT_TYPE_UNSUPPORTED` | MIME and extension are not an allowed pair |
| `429` | `AUTHENTICATION_THROTTLED` | Temporary login throttle after repeated failed attempts |
| `500` | `UNEXPECTED_ERROR` | Safe fallback for an unhandled server or database failure |

## Migration and regression contract

- The migration must be applied through Prisma and must not discard existing Category, Related System, Ticket, or Attachment data.
- A migration test records counts and requester ownership before and after the User conversion.
- Each migrated Requester receives the documented local initial-password convention, has `mustChangePassword = true`, can authenticate only into the restricted password-change flow, and can enter normal APIs only after a successful password change. No password is emailed or returned by the migration.
- The test database preparation script continues to reject any database other than `/toktickit_test` before destructive commands.
- Lab 2 requester tests are updated to establish authenticated sessions. They must continue to cover Ticket creation, list query, Ticket Detail, Attachment upload, download, preview, removal, ownership rejection, and responsive behavior.
