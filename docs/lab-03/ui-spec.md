# Lab 3 Zen Green UI Specification

## 1. Design tokens

Reuse the Lab 2 tokens and control rules. New screens must look like one TokTickIT application, not a second visual system.

| Token | Value | Use |
| --- | --- | --- |
| `--zen-primary` | `#006B3C` | Header, primary actions, headings, positive status |
| `--zen-secondary` | `#0B7A46` | Hover states, links, secondary emphasis |
| `--zen-pale` | `#EAF6EF` | Panels, success states, selected surfaces |
| `--zen-background` | `#F5F7F6` | Page background |
| `--zen-text` | `#17352A` | Body text |
| `--zen-error` | `#9A2F2F` | Validation and safe failures |
| `--zen-warning` | `#8A5A00` | Warning and pending states |
| Focus outline | `3px solid #F0B429` | Keyboard focus with `2px` offset |

Use white surfaces with the existing pale green border, rounded cards, readable contrast, and no decorative gradients. Keep black or dark text on light surfaces and white text on the green header.

## 2. Typography, spacing, and shared components

- Use the existing system font stack and the Lab 2 heading scale.
- Keep page content within the existing `1200px` shell width and use the existing `1rem` mobile gutters.
- Use the existing field labels, required marker, inline field error, help text, action row, card, loading status, empty state, and alert conventions.
- Extract reusable `AuthenticatedShell`, `RoleBadge`, `StatusBadge`, `PriorityBadge`, `FeedbackPanel`, `Pagination`, `CommentList`, `InternalNoteList`, `UserStatusBadge`, and `PasswordRules` components where more than one screen needs the pattern.
- Every interactive control has a visible label or accessible name, a keyboard focus state, a disabled or busy state, and an error association when validation fails.
- Page titles receive focus after route changes without causing unexpected scrolling.
- Render comment and note bodies as text with preserved line breaks. Never inject HTML from a User.

## 3. Authentication screens

### Login route `/login`

Create mode contains:

- TokTickIT heading and short explanation.
- Email input with normalized email validation.
- Password input with show or hide control if it remains accessible and does not expose the password in the DOM after submission.
- Primary Login button.
- A loading status and disabled button while the request is active.
- A safe generic authentication failure for invalid credentials and inactive accounts.
- Network or server failure feedback with a retry path through the form.

The form submits only after client validation and still relies on server validation. Focus returns to the first invalid field or the alert after failure.

### Change Password route `/change-password`

Create mode contains:

- Current or initial password input.
- New password and confirmation inputs.
- Visible password rules matching the API contract.
- Inline mismatch and boundary errors.
- Primary Save Password button with busy state.
- A message explaining that normal application screens remain blocked until success.

Success clears the password-change requirement and navigates to the permitted role landing route. Failure retains non-secret form state but clears password inputs.

## 4. Authenticated application shell

The shell contains:

- TokTickIT brand link.
- Responsive menu button on tablet or mobile widths.
- Current User name and a `RoleBadge` showing Requester, IT Staff, or Administrator.
- Only permitted links:
  - Requester: My Tickets and Create Ticket.
  - IT Staff: Ticket Queue.
  - Administrator: User Management.
- Logout action with busy state and safe failure handling.

The shell must not show `Select a Development Requester`, `Change Requester`, the old requester testing notice, or any destination the current role cannot use.

## 5. Requester screens

### My Tickets `/tickets`

Preserve Lab 2 behavior under the authenticated identity. Keep search, Category, Related System, Requested Priority, and Current Status filters, sort controls, Clear Filters, result summary, list or card representation, pagination, and Create Ticket action.

The screen must distinguish:

- Initial or loading state.
- Populated owned Ticket list.
- Empty owned list.
- No-results state after a filter or search.
- Safe API failure with retry.
- Forbidden or expired-session handling through the AuthProvider.

The response must never display a previous User's Ticket after logout, session expiry, or route switching.

### Create Ticket `/tickets/new`

Preserve Lab 2 fields and attachment states. The Requester is displayed as read-only authenticated context, not an editable selector. The form includes Category, Related System, Summary, Requested Priority, Description, optional Attachments, and Submit.

Retain field-level validation, invalid attachment feedback, submitting state, successful Ticket Number, safe API failure with values retained, and duplicate-submit prevention. Add Public Comment or resolution actions only to Ticket Detail, not Create Ticket.

### Requester Ticket Detail `/tickets/:ticketId`

Organize content into:

1. Ticket header with Ticket Number, status badge, Requested Priority badge, IT Priority badge, and Last Updated.
2. Read-only Ticket information, Requester, Category, Related System, Summary, Description, and dates.
3. Existing Attachment section with Lab 2 upload, preview, download, soft removal, removed metadata, and safe failures.
4. Public Comments section with chronological comments, author, creation time, empty state, text-area validation, submit busy state, and success or failure feedback.
5. Requester resolution action with a clear confirmation or status indicator. The action records an indication only and must not display as formal Resolved status.

## 6. IT Staff Ticket Queue `/staff/tickets`

### Desktop representation

Use a readable table with these columns:

- Ticket Number.
- Created Date.
- Summary.
- Requester.
- Category.
- Requested Priority.
- IT Priority.
- Current Status.
- Ticket Owner.
- Last Updated.
- View Detail action.

Do not add fields that make the table unreadable. Long summaries and names wrap safely. Status, Requested Priority, IT Priority, role, and ownership use consistent badges or text labels.

### Controls and modes

Place controls in this order:

1. Search by Ticket Number, Summary, Description, Requester name, or Requester email.
2. Status filter.
3. Requested Priority filter.
4. IT Priority filter.
5. Ticket Owner filter, including Unassigned.
6. Category and Related System filters when present in the API contract.
7. Sort field and direction.
8. Clear Filters.
9. Result summary and pagination.

Changing any query control resets the page to one. The default is Last Updated descending with a deterministic Ticket id tie breaker.

Provide populated, loading, empty queue, no-results, forbidden, expired-session, invalid-query, and safe API-failure states. Use an explicit Open Detail action and make the entire row non-essential to keyboard navigation.

### Smaller-screen representation

At widths below the table threshold, use stacked Ticket cards. Each card keeps Ticket Number, Summary, Requester, Status, both priorities, Owner, Last Updated, and View Detail. No required value is hidden solely because of viewport size. Filters stack into one column and pagination remains operable without horizontal page scrolling.

## 7. IT Staff Ticket Detail `/staff/tickets/:ticketId`

Organize the screen into separate cards:

1. Ticket header with Ticket Number, status, Requested Priority, IT Priority, owner, and Last Updated.
2. Read-only Requester and submitted Ticket information.
3. Operational controls for ownership, IT Priority, and status. Editable fields use a distinct pale-green editable surface. Read-only fields use the Lab 2 read-only surface.
4. Attachments with existing metadata and permitted read actions.
5. Public Comments with a green communication surface.
6. Internal Notes with a visually distinct amber or neutral private surface and a visible `Internal only` label.
7. Requester resolution indication, if present, with a timestamp and author.

Operational actions show current value, available values, validation, saving state, success feedback, conflict feedback, and safe API failure. Resolved, Closed, and Cancelled actions require a confirmation step. Invalid status transitions are never hidden as merely disabled controls. The API remains authoritative.

Public Comments and Internal Notes never share a submit control or ambiguous label. The form says exactly where the text will be visible before submission.

## 8. Administrator User Management `/admin/users`

Keep one intentionally simple screen.

### List mode

The list shows Name, Email, Role, Status, and an Edit action. Search accepts name or email. A single optional Role filter is allowed. User-list pagination, multi-column sorting, and multiple simultaneous filters are not required.

Provide loading, populated, empty, no-results, forbidden, conflict, and safe API-failure states. The screen is visible only to Administrators through both route guards and backend authorization.

### Create mode

Fields are Name, Email, Role, Active state, Initial Password, and Confirmation where needed. The form rejects duplicate email, invalid role, invalid password, and missing required values. Success returns to the list with a concise confirmation.

### Edit mode

Allow Name, Email, Role, and Active state edits. Provide a separate Set New Initial Password action. Show warnings when the current Administrator is attempting self-deactivation or when the change would remove the last active Administrator. The API must reject both conditions even if the UI is bypassed.

## 9. Feedback and accessibility rules

- Use `role="status"` for loading and successful progress messages, `role="alert"` for validation or failure messages, and `aria-busy` on loading regions.
- Keep messages near the affected field or action. Do not rely on color alone.
- Use visible labels, descriptive buttons, sufficient contrast, and focus restoration after dialogs or route changes.
- Disable only the active submit or destructive control while saving. Do not make the entire page unusable.
- For expired sessions, clear stale authenticated state and navigate to Login with a safe explanation.
- For 401, 403, 404, 409, and 500 responses, show the contract-specific safe message without raw server output.

## 10. Responsive rules

- Desktop reference viewport: `1440 x 900`.
- Tablet reference viewport: `834 x 1112`.
- Mobile reference viewport: `390 x 844`.
- The header navigation becomes a keyboard-accessible menu on smaller widths.
- Two-column form fields become one column on mobile.
- Queue tables become cards below the table threshold rather than creating page-level horizontal scrolling.
- Ticket Detail header metadata wraps and detail fields become one column on mobile.
- Attachment rows, comment forms, note forms, and Administrator actions wrap without clipping.
- Verify `document.documentElement.scrollWidth <= window.innerWidth` on every major screen.

## 11. Visual checklist and evidence paths

Before completion, inspect and record evidence for:

- [ ] Zen Green palette, contrast, typography, and spacing match Lab 2.
- [ ] Authenticated shell displays current User and role and only permitted navigation.
- [ ] Login and Change Password show correct validation, busy, focus, and safe failure states.
- [ ] Status, Requested Priority, IT Priority, role, and ownership badges are consistent.
- [ ] Editable operational fields and read-only submitted fields are visibly distinct.
- [ ] Public Comments and Internal Notes are clearly separated and labelled.
- [ ] Validation messages appear beside the affected controls.
- [ ] Desktop, tablet, and mobile layouts have no clipping, overlap, hidden required action, or horizontal overflow.
- [ ] Loading, empty, no-results, forbidden, conflict, and safe failure states are readable.
- [ ] Attachments remain usable and removed content cannot be previewed or downloaded.

Store real screenshots only under:

- `artifacts/lab-03/screenshots/authentication/`
- `artifacts/lab-03/screenshots/staff-queue/`
- `artifacts/lab-03/screenshots/staff-ticket-detail/`
- `artifacts/lab-03/screenshots/user-management/`

The final Answer Sheet references these screenshots and includes a short description of what each proves. The screenshots and Answer Sheet are external evidence artifacts and are not used as a substitute for automated tests or backend authorization.
