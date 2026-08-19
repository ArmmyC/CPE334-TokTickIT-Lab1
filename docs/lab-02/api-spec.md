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

## Reference data

### `GET /api/categories`

Returns active Categories ordered by ascending id.

Response `200`:

```json
[
  { "id": 1, "name": "Account and Access" }
]
```

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
    "currentStatus": "NEW",
    "createdAt": "2026-08-19T10:00:00.000Z",
    "updatedAt": "2026-08-19T10:00:00.000Z"
  }
}
```

The backend creates the Ticket in a transaction and generates the final Ticket Number from the persisted id. The client cannot set Ticket Number, Ticket Date, or Current Status.

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

### `GET /api/tickets/:ticketId`

Requires `requesterId` query parameter. Returns one owned Ticket and its attachment metadata. Removed Attachments remain as metadata with removal fields but are marked unavailable for download/preview.

Response `200`:

```json
{
  "ticket": {},
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

## Attachments

### `POST /api/tickets/:ticketId/attachments`

Multipart form fields:

- `requesterId`: positive integer.
- `file`: one JPG/JPEG, PNG, WEBP, or PDF file, maximum 5 MB.

The current Requester must own the Ticket. The API validates both MIME type and extension, generates a safe storage key, writes the file to API-controlled storage, and creates metadata. If metadata creation fails, the file is removed as compensation.

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

If the Ticket already has five active Attachments, the response is `400`. Invalid type is `415`; oversized file is `413`.

### `GET /api/attachments/:attachmentId`

Requires `requesterId` query parameter. Returns metadata for an owned Attachment. It never returns the physical storage key.

### `GET /api/attachments/:attachmentId/download`

Requires `requesterId` query parameter. Returns the file only when the Attachment is active and owned. A removed or inaccessible Attachment returns `404`.

### `DELETE /api/attachments/:attachmentId`

Request:

```json
{
  "requesterId": 1,
  "removalReason": "Uploaded the wrong document"
}
```

The reason is trimmed and must contain 5 to 500 characters. The API sets `removedAt` and `removalReason` without deleting the database row or physical file immediately. The removed file is never downloadable or previewable.

Response `200` returns the updated metadata with `downloadAvailable: false`.

## Security and failure behavior

- Ownership is checked on every Ticket and Attachment operation in the backend.
- No request is treated as authenticated merely because it contains a requester id.
- Errors do not expose stack traces, SQL, filesystem paths, or internal identifiers.
- Failed attachment operations preserve the Ticket and report the failed file safely.
