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

## 6. Create Ticket screen

Group system-generated/read-only values separately from editable fields. The screen includes Requester, Category, Related System, Summary, Requested Priority, Description, Attachments, and the primary submit action.

Required states:

- Initial and reference-data loading.
- Field-level validation failure.
- Invalid attachment type, size, or count.
- Submitting/busy.
- Success with official Ticket Number and saved values.
- API failure with form values preserved.

The Requester is shown as read-only context. Ticket Number and Ticket Date are read-only system values after creation. Description has enough width and height for meaningful input.

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

## 8. Ticket Detail screen

Ticket information is read-only. Attachment actions are visually separated from the Ticket information.

Required attachment states:

- Active metadata with download.
- Uploading/busy.
- Invalid file.
- Removed metadata.
- Unavailable/blocked download.
- Upload/removal failure.
- Removal confirmation with a required reason.

Do not display or implement comments, Internal Notes, Actions Taken, IT Staff controls, or later status workflow.

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
