# Lab 4 UI Specification

**Status:** Approved by the student on 2026-10-30, including the Administrator read-only Staff Queue drill-down clarification. Implement through the approved Issue sequence and reviewed PRs to `lab4-staging`.
**Visual baseline:** Reuse the Lab 2–3 Zen Green system and shared AuthenticatedShell.

## 1. Design Tokens and Shared Rules

| Token | Value | Use |
| --- | --- | --- |
| `--zen-primary` | `#006B3C` | Header, primary actions, headings, positive status |
| `--zen-secondary` | `#0B7A46` | Links, hover, secondary emphasis |
| `--zen-pale` | `#EAF6EF` | Selected cards, panels, success feedback |
| `--zen-background` | `#F5F7F6` | Page background |
| `--zen-text` | `#17352A` | Body text |
| `--zen-error` | `#9A2F2F` | Validation and safe failures |
| `--zen-warning` | `#8A5A00` | Pending follow-up and warning states |
| Focus outline | `3px solid #F0B429`, 2px offset | Keyboard focus |

- Use the system font stack, white surfaces, pale green borders, rounded cards, dark text on light surfaces, and white text on the green header.
- Keep page content within the existing 1200px shell and preserve the existing 1rem mobile gutters.
- Reuse existing labels, required markers, inline errors, help text, action rows, badges, loading status, empty state, and alert conventions.
- Page titles receive focus after route changes without unexpected scrolling.
- Never use color as the sole indication of status, priority, follow-up, success, or error.

## 2. Routes and Role Behavior

| Screen | Route | Permitted role | Behavior |
| --- | --- | --- | --- |
| Requester Dashboard | `/requester/dashboard` | Requester | Shows metrics and recent information for the authenticated Requester's Tickets only |
| IT Staff Dashboard | `/staff/dashboard` | IT Staff, Administrator | Shows approved Staff metrics, recent activity, and links to Ticket Queue/Detail |
| Staff Ticket Queue | `/staff/tickets` | IT Staff, Administrator | IT Staff retain existing queue behavior; Administrators may read/filter the queue for dashboard drill-downs, with no queue mutation controls |
| Requester Ticket Detail | Existing `/tickets/:ticketId` | Owner Requester | Shows read-only Actions Taken and permitted status history for an owned Ticket |
| Staff/Admin Ticket Detail | IT Staff: existing `/staff/tickets/:ticketId`; Administrator: existing `/admin/tickets/:ticketId` | IT Staff, Administrator | Shows Actions Taken create/edit controls for permitted roles and status controls only for IT Staff |

The authenticated navigation includes Dashboard for the active role. Direct route entry follows the same role and ownership guards as the navigation. Hiding a control never replaces backend authorization. Administrator status mutation remains unavailable under the Lab 3 permission contract.

## 3. Requester Dashboard

1. Page title and short explanation that the metrics summarize only the signed-in Requester's Tickets.
2. Four metric cards:
   - **Open Tickets**, the active status group from the specification.
   - **Waiting for You**, Tickets in `WAITING_FOR_REQUESTER`.
   - **Recently Updated**, Tickets with Requester-visible activity in the rolling seven-day window.
   - **Recently Resolved**, Tickets currently `RESOLVED` or `CLOSED` with a recent resolution event.
3. Recent update list, up to five rows, with Ticket number, Summary, status, IT Priority when present, and local-time activity timestamp.
4. Recent resolved list, up to five rows, with Ticket number, Summary, current status, and local-time resolution timestamp.
5. Every row opens the Requester Ticket Detail. Metric cards open My Tickets with the corresponding status/time filter. Empty metrics display zero. Empty lists explain that there are no matching Tickets.

Do not display Owner-only activity, Internal Note content, or any other Requester's Ticket. The Requester dashboard is a summary and does not reproduce the full My Tickets table.

## 4. IT Staff and Administrator Dashboard

1. Page title and an as-of timestamp rendered in the viewer's local timezone.
2. Metric cards for **Unassigned Active Tickets**, **Active Tickets Owned by Me**, **Actions Taken by Me**, and **Recently Updated Tickets**.
3. A compact count-by-status section for active statuses and count-by-IT-Priority section, including Unassigned priority. Every configured value appears even when the count is zero. Every count links to the Staff Queue filtered to that status, or to that priority within active Tickets. Zero counts remain links so users can inspect the matching empty result.
4. Recent activity list, up to five rows, showing Ticket number, Summary, Requester, Owner, status, IT Priority, last activity timestamp, and activity type when available.
5. Recent Actions Taken list, up to five rows, showing the current user's action date/time, Ticket, Result, and follow-up flag.
6. Metric cards link to the Staff Queue with the matching server-side filter. Status counts link with `status=<status>`; priority counts link with `statusGroup=ACTIVE&itPriority=<priority>`. Recent Ticket and Action rows open Ticket Detail. IT Staff links use `/staff/tickets/:ticketId`; Administrator links use `/admin/tickets/:ticketId`.
7. Administrator may use this shared dashboard and read/filter the Staff Queue for drill-downs. Queue access is read-only. It does not grant Ticket Owner assignment, formal status changes, Public Comment creation, or Internal Note creation. Actions Taken create/edit controls remain governed by the approved Lab 4 role rules.

The dashboard does not offer custom reports, exports, or additional analytics. The server response supplies all counts and recent rows.

## 5. Actions Taken on Ticket Detail

### Ticket Owner assignment, separate from Actions Taken

- Preserve the existing Ticket Owner assignment control for permitted IT Staff.
- The eligible choices are active IT Staff or Administrators, following the Lab 3 contract. Inactive or ineligible users cannot be selected.
- If a stale client submits an inactive or ineligible target, the backend returns `409 OWNER_NOT_ELIGIBLE`, the current Owner remains unchanged, and the UI shows safe feedback.
- Assignment changes the Ticket coordinator only. It never changes or selects Action Taken Performed by.

### List and read-only view

- Place an **Actions Taken** section in Staff and Requester Ticket Detail.
- Show one row/card per action with Action Date/Time, Action Description, Result, Follow-Up Required, Follow-Up Completed, Follow-up Note when required, Attachment Notes when present, Performed by, and latest edit metadata for staff.
- Staff sees actions in stable Action Date/Time ascending, then record ID order. The most recent entry remains easy to reach on mobile.
- The primary Ticket Owner appears in the Ticket summary, separate from the action performer.
- Requesters see the complete approved Action Taken information for their own Tickets, read-only.
- An empty state explains that no work has been recorded yet, without inventing an action.

### Create mode

IT Staff and Administrators see **Add Action Taken** only while the Ticket is active (statuses NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, or REOPENED). The form contains:

- Action Date/Time, with the current local date/time as the initial value.
- Action Description, required.
- Result, required.
- Performed by, display-only and populated from the signed-in actor.
- Follow-Up Required, required yes/no control.
- Follow-Up Completed, displayed as **Not completed** on creation and not editable until the Action Taken is saved.
- Follow-up Note, shown and required when follow-up is yes.
- Attachment Notes, optional plain text describing what file to look for.

The form does not expose Ticket Owner, performer ID, Ticket ID, status, or any user selector as editable fields. It does not upload a file. On submit, disable repeat submission, announce progress, retain entered values after a recoverable failure, and show the saved Action Taken after success.

### View/edit mode

- Existing actions begin in a read-only view.
- An authorized Staff/Admin editor can enter edit mode for that action and save in place.
- If Follow-Up Required is yes, edit mode allows the editor to mark Follow-Up Completed after the work is done. Completion does not clear the required flag or follow-up note. If Follow-Up Required is no, the completion state remains false.
- Performed by is immutable in edit mode. Show the original performer and the current editor separately.
- Edits use the current record version. On stale conflict, keep the user's unsaved values, show a safe conflict message, and provide a way to reload the current version before retrying.
- On RESOLVED, CLOSED, or CANCELLED Tickets, actions remain visible read-only. Hide Add/Edit controls and explain that IT Staff must reopen the Ticket before an action can be added or edited. If a Ticket becomes terminal while a form is open, preserve the values and show the server's ACTION_TAKEN_LOCKED response.
- After a successful create/edit, refresh Ticket Detail so its Ticket version and resolution-gate state are current.
- There is no delete button, revision timeline, or append-only Action Taken mode.

## 6. Ticket Workflow and Status History

- Show the current status and only the permitted next status options from the transition matrix.
- Require confirmation for Resolved, Closed, and Cancelled transitions.
- If the resolution gate fails, explain that at least one Action Taken is required and every required follow-up must be marked complete, then link to Actions Taken. Do not pretend that the Requester's advisory resolution indication changes status.
- Show status history in chronological order with previous status, next status, actor or “Legacy baseline,” and local-time timestamp.
- Status history is read-only. No edit/delete control appears for any role.
- On a stale Ticket version, preserve the selected form state, explain that another update occurred, and offer refresh/review of the current Ticket before another submit.

## 7. Feedback, Loading, and Failure States

- Dashboard and Ticket sections show a polite loading status and `aria-busy` while fetching.
- Zero metric cards display `0`; empty lists give a useful explanation and a link to the relevant detailed screen.
- Forbidden and not-found states do not expose whether a foreign Ticket or action exists.
- Validation errors appear beside the associated field and in a summary announced by assistive technology.
- Safe server failures identify the failed operation, never expose stack traces, SQL, tokens, file paths, or hidden data.
- Conflict feedback never silently overwrites data. Recoverable failures retain form values.
- Success and progress use `role="status"`; validation and failure use `role="alert"`. Disable repeated submission while a request is active.

## 8. Responsive Layout

Use the existing CSS breakpoints: tablet navigation/layout at 991px and mobile refinements at 767px.

- **Desktop, 1440×900:** Four metric cards in a row where space permits. Action history uses a semantic table only when all fields remain readable. Staff detail keeps Ticket summary and workflow controls grouped.
- **Tablet, 834×1112:** Metric cards use a two-column grid. Tables may switch to labeled cards. Detail forms keep clear grouping and spacing.
- **Mobile, 390×844:** Metric cards stack or use a narrow two-column layout only when labels remain readable. Action rows become labeled cards. Forms become one column. Buttons remain reachable and do not clip.
- All screen sizes must avoid page-level horizontal overflow, overlapping content, clipped required fields, or hidden controls.

## 9. Accessibility

- [ ] Use semantic landmarks, one page-level heading, ordered subsection headings, and real table headers when a table is used.
- [ ] Every control has an associated visible label or accessible name. Required state and validation text are programmatically associated.
- [ ] Keyboard focus remains visible with the specified outline. All create/edit/status flows work without a pointer.
- [ ] Status and follow-up are conveyed by text as well as color.
- [ ] Loading and save progress are announced. Dialogs, if used for confirmations, trap focus appropriately, close with Escape where safe, and restore focus to their trigger.
- [ ] Preserve focus on a validation failure and move it to the error summary only when necessary.
- [ ] Text content from Actions Taken and Ticket history is rendered as text, never injected HTML.
- [ ] Follow-Up Required and Follow-Up Completed have separate visible labels so completion never looks like the original requirement was removed.
- [ ] Record the manual audit date, tested role and viewport, and any findings in the Lab 4 Issue or PR evidence. This checklist is not an automated test result.

Issue #68 browser checkpoint, 2026-10-31: the Requester and IT Staff dashboard flows were exercised at desktop 1440×900, tablet 834×1112, and mobile 390×844. Direct navigation focuses the page heading. Keyboard Tab reaches metric cards in document order, and Staff status counts are keyboard-reachable with a visible gold focus outline; Enter opens their filtered views. Staff status and priority counts, including zero values, open their matching filtered Staff Queue views. These checks are automated in `e2e/lab-04/dashboards.spec.ts`; they do not complete the manual checklist above. A full manual accessibility audit remains open for final hardening.

## 10. Screenshot Evidence and Visual Checklist

Capture genuine application screens only after implementation. Store them at these exact paths:

- `artifacts/lab-04/screenshots/staff-dashboard/`
- `artifacts/lab-04/screenshots/requester-dashboard/`
- `artifacts/lab-04/screenshots/actions-taken/`

Evidence status, with each image tied to a role, viewport, and observable state:

| Directory | Status | Required or captured views |
| --- | --- | --- |
| `staff-dashboard/` | Captured for Issue #68, 3 genuine images | `desktop-summary.png`, `tablet-summary.png`, and `mobile-summary.png` show Staff identity, current-user Actions Taken, recent Tickets, active status and priority counts with actionable zero-valued rows, and responsive card layout. API/component/E2E tests verify query agreement, safe loading/failure, and filtered drill-down behavior. |
| `requester-dashboard/` | Captured for Issue #68, 3 genuine images | `desktop-summary.png`, `tablet-summary.png`, and `mobile-summary.png` show Requester identity, owned Ticket metrics, recent Tickets, and the empty recently resolved state. API/component/E2E tests verify ownership isolation and filtered drill-down behavior. |
| `actions-taken/` | Captured for Issue #67, 12 genuine images | Four states at desktop, tablet, and mobile: Staff follow-up validation, Staff create/edit with multiple actions, Staff safe forbidden response, and Requester read-only view |

The Actions Taken images use these viewport sizes: desktop 1440×900, tablet 834×1112, and mobile 390×844. Each filename begins with its viewport (`desktop-`, `tablet-`, or `mobile-`) and ends with the state below:

| Filename suffix | Role and what the image proves |
| --- | --- |
| `staff-follow-up-validation.png` | Staff sees the required Follow-up Note error while the entered Action Taken values remain available for correction. |
| `staff-create-edit-multiple-actions.png` | Staff can distinguish Ticket Owner from each action's performer, view multiple actions on one Ticket, and see follow-up completion separately from the original requirement. |
| `staff-forbidden-safe-error.png` | Staff receives a safe forbidden response and the recoverable form retains its entered values. |
| `requester-read-only.png` | The owning Requester can read Actions Taken without staff create/edit controls or editor-only metadata. |

For example, `desktop-staff-follow-up-validation.png`, `tablet-staff-follow-up-validation.png`, and `mobile-staff-follow-up-validation.png` prove the same validation state at the three required viewport sizes. The equivalent three-file groups exist for the other suffixes.

- [ ] All screenshots come from the running application, not mockups.
- [ ] Images show the matching authenticated role and meaningful data.
- [ ] No image contains secrets, tokens, or unrelated personal data.
- [ ] Desktop/tablet/mobile layouts are readable without extreme zoom.
- [ ] Screenshots are committed through the reviewed Issue PR flow and included in the external Answer Sheet only with concise captions.
