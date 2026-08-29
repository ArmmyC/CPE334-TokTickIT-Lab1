# Lab 2 REST API Specification

## Contract conventions

- Base path: `/api`.
- JSON uses camelCase field names.
- Every requester-scoped request includes an explicit `requesterId` because Lab 2 has no authentication.
- Success responses use 200 for retrieval, 201 for creation/upload, and 200 for soft removal.
- Error shape:

```json
{
  "error": "Safe user-facing message.",
  "fieldErrors": {
    "fieldName": "Optional field-level message."
  }
}
```

- 400 means invalid input or invalid query values.
- 404 means the resource is missing or is not owned by the selected Requester. This prevents ownership disclosure.
- 409 means a conflict such as a duplicate business value.
- 413 means an attachment exceeds 5 MB.
- 415 means the MIME type or extension is not permitted.
- 500 means an unexpected safe server failure without implementation details.
- Dates are ISO 8601 UTC strings. Unknown JSON properties and attempts to set server-controlled fields are rejected with `400`.
- Positive integer identifiers must contain decimal digits only and be within the JavaScript safe-integer range.

## Reference data

### `GET /api/categories`

Returns active Categories ordered by ascending id.

Response `200`:

```json
[
  { "id": 1, "name": "Account and Access" }
]
```

An unexpected database failure returns `500`. An empty active set returns `200` with `[]` so the selector can show its required empty state.

### `GET /api/related-systems`

Returns active Related Systems ordered by ascending name.

Response `200`:

```json
[
  { "id": 1, "name": "Campus Wi-Fi" }
]
```

### `GET /api/development-requesters`

Returns active Development Requesters ordered by ascending name. Inactive Requesters are never returned.

Response `200`:

```json
[
  { "id": 1, "name": "Ariya Anderson", "email": "ariya@example.test" }
]
```

## Tickets

### `POST /api/tickets`

Creates one Ticket for the selected Requester. Initial Ticket creation is JSON; Attachments are uploaded through the attachment endpoint after the Ticket exists.

Request:

```json
{
  "requesterId": 1,
  "categoryId": 2,
  "relatedSystemId": 3,
  "summary": "Laptop battery drains quickly",
  "description": "The battery drains while the laptop is idle.",
  "requestedPriority": "MEDIUM"
}
```

Validation requires an active Requester, active Category, active Related System, allowed priority, and trimmed Summary/Description lengths from `specification.md`.

Validation details:

- `summary`: trimmed string, 5-120 characters.
- `description`: trimmed string, 10-4000 characters.
- `requestedPriority`: `LOW`, `MEDIUM`, `HIGH`, or `URGENT`.
- requester and reference ids: positive integers whose rows exist and are active.
- Ticket Number, Ticket Date, Current Status, and IT Priority are server-controlled and cannot be supplied.

Response `201`:

```json
{
  "ticket": {
    "id": 1,
    "ticketNumber": "TKT-2026-000001",
    "ticketDate": "2026-08-19T10:00:00.000Z",
    "requesterId": 1,
    "categoryId": 2,
    "relatedSystemId": 3,
    "summary": "Laptop battery drains quickly",
    "description": "The battery drains while the laptop is idle.",
    "requestedPriority": "MEDIUM",
    "itPriority": null,
    "currentStatus": "NEW",
    "createdAt": "2026-08-19T10:00:00.000Z",
    "updatedAt": "2026-08-19T10:00:00.000Z"
  }
}
```

The backend creates the Ticket in a transaction and generates the final Ticket Number from the persisted id. The client cannot set Ticket Number, Ticket Date, Current Status, or IT Priority. Invalid fields return `400` with `fieldErrors`; a safe unexpected failure returns `500` and creates no visible Ticket.

### `GET /api/tickets`

Returns only Tickets owned by the selected Requester.

Query parameters:

| Parameter | Required | Values/default |
| --- | --- | --- |
| `requesterId` | yes | Positive active Requester id |
| `page` | no | Positive integer, default `1` |
| `pageSize` | no | `10`, `20`, or `50`; default `10` |
| `search` | no | Case-insensitive Ticket Number, Summary, or Description search |
| `categoryId` | no | Positive active Category id |
| `relatedSystemId` | no | Positive active Related System id |
| `requestedPriority` | no | `LOW`, `MEDIUM`, `HIGH`, or `URGENT` |
| `currentStatus` | no | `NEW` in Lab 2 |
| `sortBy` | no | `ticketDate`, `updatedAt`, or `ticketNumber`; default `updatedAt` |
| `sortOrder` | no | `asc` or `desc`; default `desc` |

Response `200`:

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

Sorting always uses `id desc` as a secondary tie breaker. Invalid query values return `400`.

`search` is trimmed. A blank value is omitted and a non-blank value longer than 120 characters returns `400`. A page beyond the final page returns `200` with empty `items`, the requested page, and accurate totals. Each list item has this shape:

```json
{
  "id": 1,
  "ticketNumber": "TKT-2026-000001",
  "ticketDate": "2026-08-19T10:00:00.000Z",
  "summary": "Laptop battery drains quickly",
  "category": { "id": 2, "name": "Hardware" },
  "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
  "requestedPriority": "MEDIUM",
  "itPriority": null,
  "currentStatus": "NEW",
  "updatedAt": "2026-08-19T10:00:00.000Z"
}
```

Missing, inactive, or malformed requester context and invalid filter/sort/page values return `400`. Database failure returns `500` and no partial or cross-requester list is returned.

### `GET /api/tickets/:ticketId`

Requires `requesterId` query parameter. Returns one owned Ticket and its attachment metadata. Removed Attachments remain as metadata with removal fields but are marked unavailable for download/preview.

Response `200`:

```json
{
  "ticket": {
    "id": 1,
    "ticketNumber": "TKT-2026-000001",
    "ticketDate": "2026-08-19T10:00:00.000Z",
    "requester": { "id": 1, "name": "Ariya Anderson", "email": "ariya@example.test" },
    "category": { "id": 2, "name": "Hardware" },
    "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
    "summary": "Laptop battery drains quickly",
    "description": "The battery drains while the laptop is idle.",
    "requestedPriority": "MEDIUM",
    "itPriority": null,
    "currentStatus": "NEW",
    "createdAt": "2026-08-19T10:00:00.000Z",
    "updatedAt": "2026-08-19T10:00:00.000Z"
  },
  "attachments": [
    {
      "id": 1,
      "originalName": "evidence.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 12000,
      "uploadedAt": "2026-08-19T10:00:00.000Z",
      "removedAt": null,
      "removalReason": null,
      "downloadAvailable": true
    }
  ]
}
```

Malformed input returns `400`. A missing Ticket and a Ticket owned by another Requester both return `404` with `{ "error": "Ticket not found." }`. Unexpected failure returns `500`.

## Attachments

### `POST /api/tickets/:ticketId/attachments`

Multipart form fields:

- `requesterId`: positive integer.
- `file`: one JPG/JPEG, PNG, WEBP, or PDF file, maximum 5 MB.

The current Requester must own the Ticket. Exactly one multipart field named `file` is accepted. The API validates both MIME type and extension, generates a UUID-based safe storage key, writes the file to API-controlled storage, and creates metadata. If metadata creation fails, the file is removed as compensation.

Response `201`:

```json
{
  "attachment": {
    "id": 1,
    "originalName": "evidence.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 12000,
    "uploadedAt": "2026-08-19T10:00:00.000Z",
    "removedAt": null,
    "removalReason": null,
    "downloadAvailable": true
  }
}
```

If the Ticket already has five active Attachments, the response is `400`. A missing or foreign Ticket returns `404`; invalid type/extension returns `415`; oversized file returns `413`; a safe unexpected storage/database failure returns `500`. The client uploads initial files sequentially after Ticket creation, so a failed file does not roll back the Ticket or previously successful files.

### `GET /api/attachments/:attachmentId`

Requires `requesterId` query parameter. Returns metadata for an owned Attachment. It never returns the physical storage key.

Response `200`:

```json
{
  "attachment": {
    "id": 1,
    "ticketId": 1,
    "originalName": "evidence.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 12000,
    "uploadedAt": "2026-08-19T10:00:00.000Z",
    "removedAt": null,
    "removalReason": null,
    "downloadAvailable": true
  }
}
```

A removed owned Attachment remains retrievable as metadata with `downloadAvailable: false`. Missing or foreign metadata returns `404`; malformed input returns `400`; unexpected failure returns `500`.

### `GET /api/attachments/:attachmentId/download`

Requires `requesterId` and accepts optional `disposition=attachment|inline`, defaulting to `attachment`. Returns bytes only when the Attachment is active and owned. The response sets the stored MIME type, a sanitized quoted filename in `Content-Disposition`, `Content-Length`, `X-Content-Type-Options: nosniff`, and `Cache-Control: private, no-store`. A removed, missing, foreign, or missing-on-disk Attachment returns the same safe `404`. Invalid disposition returns `400`; unexpected failure returns `500`.

### `DELETE /api/attachments/:attachmentId`

Request:

```json
{
  "requesterId": 1,
  "removalReason": "Uploaded the wrong document"
}
```

The reason is trimmed and must contain 5 to 500 characters. The API sets `removedAt` and `removalReason` without deleting the database row or physical file immediately. The removed file is never downloadable or previewable. Removing an already removed Attachment returns `409`; malformed input returns `400`; missing or foreign content returns `404`; unexpected failure returns `500`.

Response `200` returns the updated metadata with `downloadAvailable: false`.

## Validation and error matrix

| Capability | `400` | `404` | `409` | `413` | `415` | `500` |
| --- | --- | --- | --- | --- | --- | --- |
| Reference data | - | - | - | - | - | Database failure |
| Create Ticket | Field/id validation | - | Generated-number conflict after retry | - | - | Transaction failure |
| List Tickets | Requester/query validation | - | - | - | - | Query failure |
| Ticket Detail | Id/requester syntax | Missing or foreign Ticket | - | - | - | Query failure |
| Upload Attachment | Id/requester/count validation | Missing or foreign Ticket | - | Too large | MIME/extension rejected | Storage/metadata failure |
| Attachment metadata/content | Id/requester/disposition validation | Missing, foreign, removed content, or missing bytes | - | - | - | Query/stream failure |
| Remove Attachment | Id/requester/reason validation | Missing or foreign Attachment | Already removed | - | - | Update failure |

## Security and failure behavior

- Ownership is checked on every Ticket and Attachment operation in the backend.
- No request is treated as authenticated merely because it contains a requester id.
- Errors do not expose stack traces, SQL, filesystem paths, or internal identifiers.
- Failed attachment operations preserve the Ticket and report the failed file safely.
