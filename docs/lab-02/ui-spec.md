# Lab 2 Zen Green UI Specification

## 1. Design tokens

| Token | Value/use |
| --- | --- |
| Primary green | `#006B3C` for app header, primary actions, and strong emphasis |
| Secondary green | `#0B7A46` for active navigation, focus accents, links, and hover |
| Pale green | `#EAF6EF` for selected and success sections |
| Page background | `#F5F7F6` or a quiet near-white equivalent |
| Surface | White with a subtle border and restrained shadow |
| Text | Dark charcoal-green, not pure black |
| Editable field | White background with a clear neutral border |
| Read-only field | Soft gray-green or warm ivory shading with readable text |
| Error | Dark red text and border, with a message below the field |
| Warning | Amber callout or badge only for warnings |
| Success | Green confirmation with text and a non-color indicator |

## 2. Typography and spacing

- Use a readable system sans-serif stack with consistent heading and body hierarchy.
- Page content is centered with a sensible maximum width.
- Labels appear above controls with consistent weight and spacing.
- Controls use one consistent height; Description is taller and may resize only without breaking layout.
- Use consistent spacing tokens for page sections, field groups, cards, and action groups.
- Text must remain readable at all required viewports and must not be clipped.

## 3. Application shell

- Header includes TokTickIT identity, My Tickets, Create Ticket, selected Requester display, and Change Requester.
- The active page is visually indicated and also communicated to assistive technology.
- Mobile navigation collapses into a touch-friendly menu without horizontal overflow.
- The Development Requester notice states that the selector is for Lab 2 testing and is not a login/authentication system.
- Routes are `/select-requester`, `/tickets`, `/tickets/new`, and `/tickets/:ticketId`. Ticket routes redirect to the selector when `toktickit.developmentRequesterId` is absent or invalid.
- The desktop header places product identity first, primary navigation next, and Requester identity/actions at the end. Below 768 px, a labelled menu button reveals the same links and actions in document order.

## 4. Shared control rules

- Required fields show a red asterisk and a separate validation message.
- Buttons have visible text; icons support text but do not replace it.
- Icon-only buttons require an accessible label and tooltip.
- Disabled controls are visually distinct and cannot be activated.
- Focus indicators remain visible for keyboard users.
- Submit shows a busy state and is disabled while processing.
- Error messages appear beside the related field or control, not only in a generic page alert.
- Success messages include a clear next action and the generated Ticket Number.
- Badges use both text and visual styling, never color alone.
- Primary buttons use solid primary green; secondary buttons use a white surface with green border; tertiary actions appear as accessible text links; destructive actions use dark red; disabled buttons reduce emphasis without failing contrast; busy buttons retain their width and replace or prefix their label with a status indicator.

## 5. Requester Selection screen

Required content:

- TokTickIT title.
- Short testing-only explanation.
- Active Development Requester dropdown.
- Continue button.
- Loading, empty, API failure, and invalid-selection feedback.
- Keyboard-accessible labels and focus behavior.
- Responsive Zen Green styling.

Continue is disabled until a valid active Requester is selected. A successful selection is stored in session storage and opens the application shell.

The screen uses one centered card no wider than 640 px. The explanation appears before the labelled select. Loading replaces the select with a status message; empty and failure states retain a retry action. Continue is the primary action and Cancel is not shown because no authenticated application context exists yet.

## 6. Create Ticket screen

Group system-generated/read-only values separately from editable fields. The screen includes Requester, Category, Related System, Summary, Requested Priority, Description, Attachments, and the primary submit action.

Desktop uses a two-column card: Requester and the post-success Ticket Number/Date occupy the top read-only row; Category/Related System and Requested Priority occupy the classification grid; Summary and Description span the full width; Attachments form the final full-width section. Tablet keeps two columns only for compact selects. Mobile stacks every field and action. Submit Ticket is primary; Clear Form is secondary and requires confirmation only when entered data would be lost.

Required states:

- Initial and reference-data loading.
- Field-level validation failure.
- Invalid attachment type, size, or count.
- Submitting/busy.
- Success with official Ticket Number and saved values.
- API failure with form values preserved.

The Requester is shown as read-only context. Ticket Number and Ticket Date are read-only system values after creation. Description has enough width and height for meaningful input.

Each selected attachment row shows filename, type, human-readable size, validation state, and a Remove selection action. Selection never uploads before the Ticket succeeds. The success panel contains the official Ticket Number plus View Ticket and Go to My Tickets actions. Partial attachment failure keeps the success panel and lists each failed filename separately.

## 7. My Tickets screen

The desktop representation may use a table; smaller screens may use cards or a responsive table. It must show enough information to identify and open a Ticket, including Ticket Number, Summary, Category, Requested Priority, Current Status, and Last Updated.

Required controls:

- Search.
- Relevant filters.
- Sort selection and direction.
- Clear filters.
- Pagination with current page and total metadata.
- Create Ticket action.

Required states:

- Loading.
- Empty list for a requester with no Tickets.
- No results when filters/search match nothing.
- Safe API failure.

Desktop controls appear in this order: search; Category, Related System, Requested Priority, and Current Status filters; sort field/direction; Clear Filters; result summary; table; pagination. Changing search/filter/sort resets to page 1. The mobile representation uses the same controls followed by cards; no data is hidden solely because of viewport size. Clicking a row/card or its explicit View Ticket action opens `/tickets/:ticketId`.

## 8. Ticket Detail screen

Ticket information is read-only. Attachment actions are visually separated from the Ticket information.

The detail header shows Ticket Number, Ticket Date, Current Status, Requested Priority, nullable IT Priority (`Not assigned`), and Back to My Tickets. The information card groups Requester, Category, Related System, Summary, and Description. Attachment metadata is a separate section below it. Desktop may use a two-column metadata grid; tablet/mobile use one column for long values.

Required attachment states:

- Active metadata with download.
- Uploading/busy.
- Invalid file.
- Removed metadata.
- Unavailable/blocked download.
- Upload/removal failure.
- Removal confirmation with a required reason.

Do not display or implement comments, Internal Notes, Actions Taken, IT Staff controls, or later status workflow.

Active image/PDF rows offer Preview and Download; other active permitted files offer Download. Removal opens a labelled dialog containing the filename, warning text, required reason field, Cancel, and destructive Remove Attachment action. Removed rows retain filename, type, size, removal date, and reason, use a text-labelled Removed badge, and expose no content action.

## 9. Responsive rules

| Viewport | Required behavior |
| --- | --- |
| Desktop, 992 px and above | Multi-column layout where specified; centered content with a sensible maximum width |
| Tablet, 768-991 px | Two columns where practical; Summary and Description retain enough width |
| Mobile, below 768 px | Fields stack vertically; buttons remain touch-friendly; no horizontal page scrolling |

All sizes must avoid clipped labels, overlapping messages, hidden buttons, unreadable filenames, and unintended horizontal overflow.

## 10. Accessibility

- Every control has an associated label.
- Error messages are associated with their controls and announced appropriately.
- Loading and asynchronous status regions use accessible status/live behavior.
- Keyboard focus is visible and the complete flow is keyboard usable.
- Color is never the only status indicator.
- Disabled and busy states are communicated to assistive technology.
- Touch targets remain usable on mobile.
- Page titles receive focus after route changes without causing unexpected scrolling.
- Dialog focus is trapped while open, Escape cancels, and focus returns to the invoking control.
- Table headers identify their columns; mobile cards use visible field labels rather than relying on column order.
- Validation summaries may supplement field errors but never replace `aria-describedby` links to the exact message.

## 11. Visual checklist and evidence paths

Before completion, inspect desktop, tablet, and mobile screenshots for:

- Correct Zen Green palette and contrast.
- Consistent editable/read-only field styling.
- Required markers and message placement.
- Button hierarchy, busy, disabled, and destructive states.
- No clipping, overlap, hidden controls, or horizontal overflow.
- Correct table/card behavior, badges, filters, pagination, empty states, and attachment states.

Screenshot paths:

- `artifacts/lab-02/screenshots/create-ticket/`
- `artifacts/lab-02/screenshots/my-tickets/`
- `artifacts/lab-02/screenshots/ticket-detail/`

Required reference viewports are desktop `1440 x 900`, tablet `834 x 1112`, and mobile `390 x 844`. Create Ticket evidence additionally captures initial, validation, submitting, success, safe API failure with retained values, and invalid attachment states. My Tickets evidence captures populated, empty, no-results, filtered/sorted/paginated, and switched-Requester states. Ticket Detail evidence captures owned detail, active upload/download/preview, soft removal with reason, retained removed metadata, and rejected foreign access.

Issue 19 visual verification on 2026-08-28 produced real Playwright evidence for all three viewports. Create Ticket screenshots use the `desktop-`, `tablet-`, and `mobile-` prefixes with `initial`, `validation`, `invalid-attachment`, `api-failure-retained`, `submitting`, and `success` states. My Tickets uses the `filtered` state, and Ticket Detail uses `initial`, `active-attachment`, `removed-attachment`, and `foreign-404`. The E2E assertions also checked `scrollWidth <= innerWidth` at each major screen.
