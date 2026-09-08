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

## Authentication and sessions

### `POST /api/auth/login`

Public endpoint. Request:

```json
{
  "email": "ariya@example.test",
  "password": "Initial-password-value"
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

The response never includes a password, password hash, raw session token, or CSRF token. Invalid input returns `400` with field errors. Invalid credentials and inactive accounts both return `401` with code `AUTHENTICATION_FAILED` and the same safe message.

### `POST /api/auth/logout`

Requires an authenticated session and CSRF header. Revokes the current session, clears both cookies, and returns `204`. A missing or already revoked session returns `204` so logout is idempotent.

### `GET /api/auth/me`

Publicly callable for session discovery. A valid session returns `200` with the same non-sensitive `user` shape and `passwordChangeRequired` flag as login. No valid session returns `401` with code `AUTHENTICATION_REQUIRED`. A valid restricted session is still returned so the client can open Change Password.

### `POST /api/auth/change-password`

Requires an authenticated session. A restricted session is permitted. Request:

```json
{
  "currentPassword": "Initial-password-value",
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

The server validates active reference data and creates a Ticket owned by the session User. It initializes IT Priority to the requested priority and status to `NEW`. Success `201` returns `{ "ticket": { ... } }` with the backend-generated Ticket Number. Client-supplied `requesterId`, owner, status, IT Priority, or Ticket Number is rejected with `400`.

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

Returns an owned Ticket, its existing Attachment metadata, Public Comments, and the Requester resolution indication. A missing or foreign Ticket returns `404` with code `TICKET_NOT_FOUND`.

### `POST /api/tickets/:ticketId/attachments`

Multipart form with one `file`. The authenticated Requester must own the Ticket. Preserve the Lab 2 allowed MIME and extension pairs, 5 MB limit, five active Attachment limit, generated storage key, safe filename metadata, and compensation behavior. Success returns `201` with `{ "attachment": { ... } }`.

### `GET /api/attachments/:attachmentId`

Returns Attachment metadata only when the authenticated User is allowed to read the owning Ticket. Removed, foreign, or missing Attachments return the same safe `404`.

### `GET /api/attachments/:attachmentId/download`

Returns active Attachment bytes with safe `Content-Disposition`, `Content-Type`, `Content-Length`, `X-Content-Type-Options: nosniff`, and private no-store caching. Accepts `disposition=inline` or `disposition=attachment`. Removed, foreign, missing, or missing-storage content returns the same safe `404`.

Requester owners, IT Staff, and Administrators with permitted Ticket visibility may read. Only Requester owners may upload or remove.

### `DELETE /api/attachments/:attachmentId`

Requires an authenticated Requester owner and CSRF header. Request:

```json
{ "removalReason": "No longer needed for this report." }
```

Soft-removes the Attachment and returns `200` with metadata. A repeat removal returns `409`. The record and removal reason remain visible as metadata.

### `GET /api/tickets/:ticketId/comments`

Returns chronological Public Comments when the session User is the owning Requester, IT Staff, or Administrator with permitted Ticket visibility. Each item is `{ id, content, author: { id, name, role }, createdAt }`.

### `POST /api/tickets/:ticketId/comments`

Allows an owning Requester or IT Staff to append a Public Comment. Request:

```json
{ "content": "The issue still occurs after restarting." }
```

Blank or overlong content returns `400`. Success returns `201` with the saved comment and backend author or timestamp.

### `POST /api/tickets/:ticketId/requester-resolution`

Allows only the owning Requester. The endpoint records `requesterResolvedAt` and `requesterResolvedById` from the authenticated User, or returns a documented `409` if the indication is already present. It does not change formal status. Success returns `200` with the Ticket's resolution indication.

## IT Staff APIs

All mutation endpoints in this section require role `IT_STAFF` and CSRF. Read-only visibility for Public Comments, Internal Notes, Ticket Detail, and Attachments may also be granted to `ADMINISTRATOR` as specified below.

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

Allows `IT_STAFF` and read-only `ADMINISTRATOR` access. Returns Ticket data, owner, priorities, status, Attachments, Public Comments, Internal Notes, and Requester resolution indication. A missing Ticket returns `404`.

### `PATCH /api/staff/tickets/:ticketId/owner`

Allows `IT_STAFF`. Request:

```json
{ "ownerId": 6 }
```

Use `ownerId: null` to clear ownership. The target must be an active IT Staff or Administrator. Invalid role or inactive target returns `400` or `409` according to the conflict. Success returns the updated owner.

### `PATCH /api/staff/tickets/:ticketId/priority`

Allows `IT_STAFF`. Request:

```json
{ "itPriority": "URGENT" }
```

The value must be `LOW`, `MEDIUM`, `HIGH`, or `URGENT`. The Requester-submitted Requested Priority is never changed.

### `PATCH /api/staff/tickets/:ticketId/status`

Allows `IT_STAFF`. Request:

```json
{ "currentStatus": "RESOLVED", "confirmed": true }
```

The server checks the transition matrix. `confirmed: true` is required for `RESOLVED`, `CLOSED`, and `CANCELLED`. Invalid transitions return `409` with the current status and allowed transitions without changing the row.

### `GET /api/staff/tickets/:ticketId/comments`

Allows `IT_STAFF` and read-only `ADMINISTRATOR`. Returns Public Comments in creation order.

### `POST /api/staff/tickets/:ticketId/comments`

Allows `IT_STAFF` with CSRF. The request and response shape match the Requester Public Comment endpoint.

### `GET /api/staff/tickets/:ticketId/notes`

Allows `IT_STAFF` and `ADMINISTRATOR`. Returns Internal Notes in creation order. Requesters receive `403` for their own Ticket and the safe protected-resource response for a foreign Ticket.

### `POST /api/staff/tickets/:ticketId/notes`

Allows `IT_STAFF` with CSRF. Request and response shape match Public Comments, but the resource is never returned to Requester APIs.

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
| Staff Ticket Detail | No | Yes | Read-only |
| Claim, assign, priority, status | No | Yes | No |
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
| `409` | `CONFLICT` | Duplicate email, invalid state transition, repeat resolution, or repeat Attachment removal |
| `413` | `ATTACHMENT_TOO_LARGE` | Attachment exceeds 5 MB |
| `415` | `ATTACHMENT_TYPE_UNSUPPORTED` | MIME and extension are not an allowed pair |
| `500` | `UNEXPECTED_ERROR` | Safe fallback for an unhandled server or database failure |

## Migration and regression contract

- The migration must be applied through Prisma and must not discard existing Category, Related System, Ticket, or Attachment data.
- A migration test records counts and requester ownership before and after the User conversion.
- The test database preparation script continues to reject any database other than `/toktickit_test` before destructive commands.
- Lab 2 requester tests are updated to establish authenticated sessions. They must continue to cover Ticket creation, list query, Ticket Detail, Attachment upload, download, preview, removal, ownership rejection, and responsive behavior.
