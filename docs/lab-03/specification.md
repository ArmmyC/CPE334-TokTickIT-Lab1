# Lab 3 Sprint Engineering Specification

## 1. Sprint Goal

Deliver a secure, role-aware TokTickIT increment in which real users authenticate with email and password, Requesters continue to manage their own Tickets, IT Staff can operate a professional Ticket queue and workflow, and Administrators can manage user accounts without breaking Lab 2 Ticket or Attachment data.

## 2. Stakeholder Request

Replace the temporary Development Requester selector with real login and role-based access. A user with an initial password must change it before entering the application. Requesters keep their existing Ticket capabilities under their authenticated identity. IT Staff receive a queue and Ticket Detail workflow for ownership, priority, status, comments, and private notes. Administrators receive a deliberately small User Management screen for account creation and maintenance. Every screen and API must enforce authorization on the server and continue using the Lab 2 Zen Green design language.

## 3. Scope

### Included

- Email and password login, logout, current-user retrieval, session expiration, safe failures, and mandatory first-login password change.
- Three single-valued roles: Requester, IT Staff, and Administrator.
- Migration from Lab 2 `DevelopmentRequester` records to authenticated `User` records while preserving Ticket ownership.
- Authenticated Requester create, list, detail, attachment, Public Comment, and Problem Appears Resolved behavior.
- Backend ownership protection for all Requester Ticket and Attachment operations.
- IT Staff Ticket Queue with search, documented filters, sorting, pagination, ownership information, status, and priority badges.
- IT Staff Ticket Detail with claim or reassignment, IT Priority, permitted status transitions, Public Comments, Internal Notes, existing Attachments, and Requester resolution indication.
- Minimalist Administrator User Management with list, search, optional role filter, create, basic edit, activation, deactivation, and new initial password.
- PostgreSQL and Prisma schema changes, migration, safe repeatable seed data, and local development credentials.
- React screens, route guards, role navigation, responsive behavior, accessibility, feedback states, and Zen Green reuse.
- Unit, API or integration, UI component, UI style, responsive, security or authorization, migration or regression, and E2E tests.
- Traceable reviewer, AI-use, test, specification, screenshot, and final-main evidence.

### Explicitly excluded

- Email invitations, password-reset email, multi-factor authentication, social login, and single sign-on.
- Self-registration and Requester-created accounts.
- Actions Taken by IT Staff.
- Formal SLA calculation, escalation rules, notification services, dashboards, and KPI analytics beyond simple queue counts.
- Multi-tenant organizations, departments, customer administration, and production cloud infrastructure changes.
- Multiple roles per User.
- User deletion, bulk operations, user import or export, and account-history screens.
- Department, organization, profile-photo, and extended profile management.
- Email delivery of initial passwords or reset links, account unlocking, Administrator approval workflows, and advanced identity management.
- Mandatory User-list pagination, multi-column sorting, and multiple simultaneous User-list filters.

## 4. Functional Requirements

### Authentication and identity

- **FR-01:** The system shall authenticate users with an email address and password through a backend endpoint.
- **FR-02:** Only an active User with valid credentials shall receive authenticated access.
- **FR-03:** The backend shall establish an expiring authenticated session and expose only the current User's non-sensitive identity and role.
- **FR-04:** Logout shall invalidate the current session and remove browser authentication cookies.
- **FR-05:** A User marked for an initial password change shall be restricted to current-user retrieval and password change until a valid new password is saved.
- **FR-06:** The password-change flow shall validate password rules, confirmation, busy state, safe errors, and successful continuation into the permitted application.

### Authorization and migration

- **FR-07:** The backend shall enforce role authorization for every protected endpoint and shall not rely on hidden or disabled frontend controls.
- **FR-08:** Lab 2 Development Requester rows shall migrate to User rows without losing Ticket ownership or Attachment relationships.
- **FR-09:** Authenticated Requester operations shall derive ownership from the session User id and shall ignore or reject a client-supplied requester identity.
- **FR-10:** The application shell shall display the authenticated User's name and role and shall show only permitted navigation destinations.

### Requester behavior

- **FR-11:** A Requester shall create Tickets using the authenticated identity, active reference data, requested priority, and optional permitted Attachments.
- **FR-12:** A Requester shall list, search, filter, sort, paginate, and open only owned Tickets.
- **FR-13:** A Requester shall view and manage only permitted Attachments on owned Tickets, preserving Lab 2 safe not-found behavior.
- **FR-14:** A Requester shall post Public Comments on an owned Ticket and append a Problem Appears Resolved indication without changing the formal Ticket status.

### IT Staff behavior

- **FR-15:** IT Staff shall retrieve a Ticket Queue with search, suitable filters, sorting, pagination, ownership, status, priority, loading, empty, no-results, forbidden, and failure behavior.
- **FR-16:** IT Staff shall open a Ticket Detail containing Ticket information, Requester data, Attachments, ownership, IT Priority, current status, Public Comments, Internal Notes, and Requester resolution indication.
- **FR-17:** IT Staff shall claim, assign, or reassign a Ticket to an active IT Staff or Administrator, or clear the owner to unassigned.
- **FR-18:** IT Staff or Administrator shall update IT Priority. IT Staff shall perform only permitted formal Ticket status transitions.
- **FR-19:** IT Staff shall create and retrieve Public Comments and Internal Notes. Both resources shall be append-only.

### Administrator behavior

- **FR-20:** An Administrator shall view a User list containing Name, Email, Role, Status, and Edit action.
- **FR-21:** The User list shall support search by name or email and an optional single role filter.
- **FR-22:** An Administrator shall create a User with name, email, one permitted role, activation state, and an initial password.
- **FR-23:** An Administrator shall edit a User's name, email, role, and activation state.
- **FR-24:** An Administrator shall set a new initial password that requires password change at the User's next login.
- **FR-25:** The system shall reject duplicate emails and invalid role values, prevent self-deactivation, and prevent removal or deactivation of the last active Administrator.

### UI, API, and evidence

- **FR-26:** Every meaningful create, view, and edit mode shall show appropriate processing, validation, success, empty or no-results, forbidden, not-found, conflict, and safe API-failure feedback.
- **FR-27:** New screens shall reuse the Lab 2 Zen Green tokens, field conventions, cards, badges, buttons, responsive rules, and accessibility expectations.
- **FR-28:** The repository shall contain the required Lab 3 contract files, test files, E2E files, screenshot directories, reviewer record, AI-use reflection, and updated setup documentation.

## 5. Business Rules

### Authentication and account rules

- **BR-01:** Only an active User with valid credentials may authenticate.
- **BR-02:** Invalid credentials and inactive accounts return the same safe authentication failure without revealing which condition occurred.
- **BR-03:** Email comparison is case-insensitive for authentication and uniqueness, while the stored canonical email is normalized and trimmed.
- **BR-04:** Passwords are never stored or returned in plaintext. Every password hash uses Node's built-in `scrypt` password derivation function with `N = 32768`, `r = 8`, `p = 1`, a cryptographically random 16-byte salt, a 32-byte derived key, and a 64 MiB maximum-memory limit. The stored value is versioned with its parameters, and verification uses constant-time comparison.
- **BR-05:** A password must be 12 to 128 characters, contain at least one uppercase letter, one lowercase letter, one digit, and one non-alphanumeric character, and must match its confirmation.
- **BR-06:** A User with `mustChangePassword = true` cannot access normal application APIs or screens until the password change succeeds.
- **BR-07:** A successful password change clears `mustChangePassword` and revokes other active sessions for that User.
- **BR-08:** Sessions expire after eight hours since the last valid authenticated request or 24 hours since session creation, whichever comes first. The inactivity deadline may slide when a valid protected request updates `lastUsedAt`, but the absolute deadline never changes. Logout revokes the current session immediately.
- **BR-09:** State-changing browser requests require the session CSRF check. Authentication cookies are HttpOnly, SameSite=Lax, and Secure outside local HTTP development.
- **BR-10:** Safe API errors never expose password hashes, session tokens, database details, stack traces, or local file paths.

### Roles and authorization

- **BR-11:** Every User has exactly one role, `REQUESTER`, `IT_STAFF`, or `ADMINISTRATOR`.
- **BR-12:** The backend checks the authenticated session and required role on every protected endpoint.
- **BR-13:** A Requester can access only their own Ticket and Attachment resources, can create Tickets, can post Public Comments, and can indicate that a problem appears resolved.
- **BR-14:** IT Staff can view the Staff Queue and Staff Ticket Detail, manage ownership, IT Priority, permitted status, Public Comments, and Internal Notes.
- **BR-15:** Administrators can manage User accounts, read the protected Ticket information needed to view Public Comments and Internal Notes, and change IT Priority as the one explicitly permitted Ticket mutation. They do not receive ownership, status, Public Comment, Internal Note, or other IT Staff mutation controls.
- **BR-16:** A forbidden request does not reveal protected content. A foreign or non-existent Requester Ticket and its Attachments use the same safe not-found response.

### Migration and ownership

- **BR-17:** Every existing DevelopmentRequester becomes a User with the same id, name, email, and active state, with role Requester and an initial-password requirement.
- **BR-18:** Every existing Ticket retains its requester relationship after migration, and no Attachment row is deleted by the migration.
- **BR-19:** The client cannot select or switch the Requester identity after login. The authenticated session is the sole ownership source.
- **BR-20:** The temporary Development Requester selector, Change Requester action, requester session-storage key, and selector-only API are removed from the Lab 3 product flow.

### Ticket ownership, priority, and status

- **BR-21:** A Ticket has one Requester User and may have zero or one primary Ticket Owner.
- **BR-22:** A Ticket Owner must be an active IT Staff or Administrator User. A Ticket may be unassigned.
- **BR-23:** Requested Priority remains the value submitted by the Requester. IT Priority initially copies Requested Priority during creation and may later be changed only by IT Staff or Administrator.
- **BR-24:** Formal Ticket statuses are `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, and `CANCELLED`.
- **BR-25:** Only transitions in the approved transition matrix are accepted. The backend rejects invalid transitions even when a client bypasses the UI.
- **BR-26:** A Requester resolution indication records a timestamp and author but never changes formal status.
- **BR-27:** Actions Taken are not part of Lab 3 and cannot block a status transition.

### Comments, notes, and Attachments

- **BR-28:** Public Comments are visible to the owning Requester, IT Staff, and Administrator. Internal Notes are visible only to IT Staff and Administrator.
- **BR-29:** Public Comments and Internal Notes are append-only. Editing and deletion are excluded.
- **BR-30:** Each comment or note records its backend author and creation timestamp.
- **BR-31:** Comment and note content must be non-blank after trimming and must be 1 to 4000 characters. The UI renders content as text, never as unsanitized HTML.
- **BR-32:** Existing Lab 2 Attachment type, size, active-count, storage-key, soft-removal, and safe-download rules remain in force.
- **BR-33:** Requester Attachment operations use authenticated ownership. IT Staff and permitted Administrators may read existing Attachment metadata and content without gaining Requester mutation controls.

### Administrator safety

- **BR-34:** User email is unique after case-insensitive normalization.
- **BR-35:** A User can have only one permitted role.
- **BR-36:** Deactivation is used instead of deletion. Deactivated Users cannot log in, and their existing Ticket history remains.
- **BR-37:** An Administrator cannot deactivate their own account.
- **BR-38:** The system must always retain at least one active Administrator.
- **BR-39:** Setting a new initial password marks the User for a password change and revokes their existing sessions.
- **BR-40:** Seeded credentials are for local development only and must not be real personal passwords or secrets.

### Seed and query rules

- **BR-41:** Re-running the seed is safe and does not duplicate Users, Tickets, Categories, Related Systems, Comments, or Notes.
- **BR-42:** The seed contains at least four active Requesters, one inactive Requester, three active IT Staff, one inactive IT Staff, and one active Administrator.
- **BR-43:** The Staff Queue supports documented searchable, filterable, sortable fields, allowed page sizes, deterministic ordering, and safe invalid-query responses.
- **BR-44:** The test database guard must reject any `DATABASE_URL` whose database pathname is not exactly `/toktickit_test` before reset, migration, or seed.
- **BR-45:** Login failures are throttled by a server-side limiter keyed by normalized email and source IP. After five failed attempts within 15 minutes, further attempts are throttled for 15 minutes. A successful login clears the limiter. Throttled requests return a generic `429` response, no account is permanently locked, and no response reveals whether an email exists.

## 6. UI Specification Summary

The complete screen and component contract is in `ui-spec.md`. The application reuses the Lab 2 Zen Green tokens and adds shared AuthenticatedShell, UserBadge, RoleBadge, StatusBadge, PriorityBadge, FeedbackPanel, Pagination, CommentList, InternalNoteList, and form-control conventions.

- Login has email, password, validation, busy state, generic failure, inactive-account-safe response, and keyboard-accessible focus.
- Change Password has current or initial password, new password, confirmation, visible rules, validation, busy state, success continuation, and safe failure.
- AuthenticatedShell shows TokTickIT, the current User and role, only permitted navigation, and Logout. It never shows the Development Requester selector.
- Requester screens preserve Lab 2 Create Ticket, My Tickets, Ticket Detail, and Attachment states under authenticated identity. Ticket Detail adds Public Comments and Problem Appears Resolved.
- Staff Queue provides the documented filters, search, sorting, pagination, ownership, status, and priority badges with desktop table and smaller-screen cards.
- Staff Ticket Detail separates Ticket data, operational controls, Public Comments, Internal Notes, Attachments, and Requester resolution indication.
- Administrator protected Ticket Detail provides read-only Ticket communication and Attachments plus the explicitly permitted IT Priority edit, without Staff Queue or other Staff mutation controls.
- Administrator User Management stays intentionally simple, with one list and one create or edit mode, the required search and optional role filter, and safety feedback.
- All screens provide meaningful loading, saving, success, validation, empty, no-results, forbidden, not-found, conflict, and safe-failure states where applicable.

## 7. Data Changes

### Models and relationships

The final schema contains `Category`, `RelatedSystem`, `User`, `Session`, `Ticket`, `Attachment`, `PublicComment`, and `InternalNote`.

- `User`: `id`, `name`, normalized unique `email`, `passwordHash`, `role`, `isActive`, `mustChangePassword`, `createdAt`, and `updatedAt`.
- `Session`: `id`, `tokenHash`, `csrfTokenHash`, `userId`, sliding `expiresAt`, fixed `absoluteExpiresAt`, `createdAt`, `lastUsedAt`, and `revokedAt`, with a unique token hash and indexes for User, expiry, absolute expiry, and revocation lookup.
- `Ticket`: existing Lab 2 fields, `requesterId` referencing User, nullable `ownerId` referencing User, full `TicketStatus`, nullable `requesterResolvedAt`, nullable `requesterResolvedById` referencing User, and indexes for requester, owner, status, priorities, and updated order.
- `Attachment`: existing Lab 2 fields and ownership checked through its Ticket.
- `PublicComment`: `id`, `ticketId`, `authorId`, `content`, and `createdAt`, with indexes for Ticket and creation order.
- `InternalNote`: `id`, `ticketId`, `authorId`, `content`, and `createdAt`, with indexes for Ticket and creation order.
- `UserRole`: `REQUESTER`, `IT_STAFF`, `ADMINISTRATOR`.
- `TicketStatus`: `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`.

User foreign keys use Restrict behavior where account history must remain. Ticket requester and owner relationships use Restrict for deletion safety, although no deletion endpoint exists. Attachment uses Cascade only for the existing metadata relationship. Comment and Note rows use Restrict for authors and Cascade for Ticket removal if a future removal operation is ever introduced.

### Migration strategy

1. Create the new User role enum, User table, Session table, comment and note tables, and any new Ticket enum values or columns.
2. Insert one User for every DevelopmentRequester with the original id, name, email, active state, role Requester, a deterministic local initial password hash, and `mustChangePassword = true`. For the local lab database, the initial password convention is `TokTickIT-Lab3!User-<legacyUserId>-Aa9`, where `<legacyUserId>` is the decimal migrated User id. The migration uses this value only to derive the hash. It is not stored or returned, and the local credential table in `README.md` documents how each migrated Requester receives it. Email delivery is excluded. In a non-local deployment, an Administrator must set a new initial password before the migrated account is used.
3. Add the new Ticket requester foreign key and owner fields, validate that every existing Ticket maps to a User with the same id, then remove the old requester foreign key.
4. Rename the new relationship to `requester`, remove the legacy DevelopmentRequester foreign key and table, and reset the User sequence above the maximum migrated id.
5. Add indexes and constraints, then run a migration verification query that confirms Ticket counts and requester ownership before and after the migration.

### Seed decisions

The idempotent seed preserves the four Lab 1 Categories and seven Lab 2 Related Systems. It upserts five Requesters with four active and one inactive, four IT Staff accounts with three active and one inactive, one active Administrator, realistic Tickets across all required statuses and priorities, assigned and unassigned owners, Public Comments, and Internal Notes. Seed credentials are deterministic local-development values documented in `README.md` and are never used as real credentials.

## 8. API Contract

The complete endpoint contract, request and response shapes, authentication behavior, errors, and authorization matrix are in `api-spec.md`. All timestamps are ISO 8601 JSON strings. Protected endpoints derive identity from the authenticated session.

- Public: `GET /api/health`.
- Authentication: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password`.
- Authenticated reference data: `GET /api/categories`, `GET /api/related-systems`.
- Requester Ticket APIs: `POST /api/tickets`, `GET /api/tickets`, `GET /api/tickets/:ticketId`, existing Attachment endpoints without requesterId, `GET/POST /api/tickets/:ticketId/comments`, and `POST /api/tickets/:ticketId/requester-resolution`.
- IT Staff and permitted Administrator Ticket APIs: `GET /api/staff/tickets`, `GET /api/staff/tickets/:ticketId`, `PATCH /api/staff/tickets/:ticketId/owner`, `PATCH /api/staff/tickets/:ticketId/priority`, `PATCH /api/staff/tickets/:ticketId/status`, `GET/POST /api/staff/tickets/:ticketId/comments`, and `GET/POST /api/staff/tickets/:ticketId/notes`. Administrator permission is limited to Ticket visibility and the IT Priority update described in `api-spec.md`.
- Administrator APIs: `GET /api/admin/users`, `POST /api/admin/users`, `PATCH /api/admin/users/:userId`, and `POST /api/admin/users/:userId/initial-password`.

Unauthenticated responses use 401, authenticated but forbidden responses use 403, invalid input uses 400, missing or protected resources use safe 404 behavior, duplicate or state conflicts use 409, oversized attachments use 413, unsupported attachment types use 415, temporary login throttling uses 429, and unexpected failures use 500.

## 9. Acceptance Criteria

- **AC-01:** Given a valid active User, when the User logs in, then the backend establishes an expiring session and returns the permitted identity and role without password data.
- **AC-02:** Given invalid credentials or an inactive account, when login is attempted, then the response is a safe generic authentication failure. Given five failed attempts for the same normalized email and source IP within 15 minutes, subsequent attempts are temporarily throttled with the documented generic `429` response, and a later successful login clears the limiter.
- **AC-03:** Given a User with `mustChangePassword`, when login succeeds, then normal application APIs and screens remain unavailable until a valid password change succeeds.
- **AC-04:** Given an authenticated User, when Logout is used, then the session is revoked and direct protected access is rejected.
- **AC-05:** Given the migrated Lab 2 database, when migration completes, then existing Ticket counts, Attachment counts, and Requester ownership remain unchanged under User relationships.
- **AC-06:** Given one active Administrator and seeded accounts, when the seed runs twice, then required role counts and reference data remain correct without duplicates.
- **AC-07:** Given a Requester, when a client supplies another requesterId or User id, then the backend uses the authenticated identity and never returns another User's Ticket data.
- **AC-08:** Given an authenticated Requester, when the Requester creates, lists, opens, or manages an Attachment on an owned Ticket, then the Lab 2 behavior continues with no selector or Change Requester control.
- **AC-09:** Given a Requester-owned Ticket, when a Public Comment or Problem Appears Resolved action is submitted, then it is saved under the authenticated author and formal status remains unchanged.
- **AC-10:** Given an IT Staff User, when the Staff Queue is queried with valid search, filters, sorting, and pagination, then results and metadata match the documented contract.
- **AC-11:** Given invalid Staff Queue query values, when the endpoint is called, then it returns safe field errors without silently changing the query.
- **AC-12:** Given a User without the specific permission, when the Staff Queue or an ownership, status, Public Comment, or Internal Note mutation endpoint is called, then access is denied without protected data leakage. Administrator access to Ticket visibility and IT Priority follows the explicit authorization matrix.
- **AC-13:** Given an IT Staff User and an eligible Ticket, when ownership is claimed or reassigned, then the active eligible owner is stored or the Ticket becomes unassigned.
- **AC-14:** Given an IT Staff or Administrator User, when IT Priority is changed, then the requested priority remains unchanged and the new IT Priority is returned.
- **AC-15:** Given an IT Staff User, when an allowed status transition is submitted, then the new status is saved. When a disallowed transition is submitted, then the Ticket remains unchanged and a safe conflict is returned.
- **AC-16:** Given a Ticket with public and internal communication, when each permitted role retrieves it, then Public Comments and Internal Notes follow the authorization matrix and content is safe text.
- **AC-17:** Given blank, oversized, or invalid comment or note content, when it is submitted, then validation fails without creating a row.
- **AC-18:** Given an Administrator, when User Management is opened, then the list shows Name, Email, Role, Status, and Edit action with search and optional role filter.
- **AC-19:** Given an Administrator, when a User is created or edited, then name, email, one role, active state, and initial password rules are enforced.
- **AC-20:** Given an Administrator, when duplicate email, invalid role, self-deactivation, or last-active-Administrator deactivation is attempted, then the operation is rejected safely.
- **AC-21:** Given an Administrator sets a new initial password, when that User logs in next, then the User must change the password before normal access.
- **AC-22:** Given desktop, tablet, and mobile viewports, when each major Lab 3 screen is used, then controls remain readable with no clipping, overlap, or horizontal overflow.
- **AC-23:** Given the complete Lab 3 flows, when the required E2E suites run against the dedicated test database, then authentication, Requester regression, Staff workflow, Administrator workflow, authorization, and responsive checks pass without skipped tests.

Every criterion is mapped in `tests.md` to one or more planned automated tests and final evidence locations.

## 10. Definition of Done

- [ ] The four Spec DD and Test DD documents are approved, internally consistent, and committed before product implementation is complete.
- [ ] User migration preserves existing Ticket and Attachment data and has automated migration or regression evidence.
- [ ] Passwords are hashed, sessions expire and revoke correctly, logout works, and first-login password change is enforced.
- [ ] Backend authorization covers every protected endpoint, ownership check, role boundary, safe error, and CSRF decision.
- [ ] Requester selector and Change Requester behavior are removed from the Lab 3 product flow.
- [ ] Requester Ticket, Attachment, Public Comment, and resolution-indication behavior continues under authenticated identity.
- [ ] IT Staff Queue and Ticket Detail implement the approved search, filters, sorting, pagination, ownership, priority, status, comments, notes, and feedback states.
- [ ] Administrator User Management implements every required account function and safety rule without excluded identity-management features.
- [ ] Seed is idempotent and contains the required active and inactive role distribution and realistic workflow data.
- [ ] Unit, API or integration, UI, UI style, responsive, security or authorization, migration or regression, and E2E tests pass with no skipped or disabled tests.
- [ ] Desktop, tablet, and mobile screenshots are readable and complete for all major Lab 3 screens.
- [ ] README, reviewer.md, and ai-use.md contain real, verified evidence.
- [ ] Every implementation PR is linked to its Issue, reviewed by Bank848, and merged by Bank848 into `lab3-staging`.
- [ ] The final release PR from `lab3-staging` to `main` is approved and merged by Bank848.
- [ ] Final verification passes from `main`.
- [ ] The external submission contains exactly one concise PDF with `Answer Part 1` through `Answer Part 9`, and no Answer Sheet or PDF tooling is committed.

## 11. Assumptions and Decisions

- The existing TokTickIT repository, React client, Express server, Prisma schema, PostgreSQL services, test database guard, and Lab 2 Zen Green tokens remain the implementation base.
- The existing `TokTickIT Individual Sprints` Project and statuses `Backlog`, `Specified`, `Started`, `PR Review`, `Fixing`, and `Done` are reused.
- `lab3-staging` is the Lab 3 integration branch, created from the reviewed Lab 2 `main` baseline.
- Bank848 is the Lab 3 peer reviewer and performs each feature and release merge, following the confirmed Lab 2-style workflow.
- `scrypt` is selected over a custom or plaintext-compatible hash because it is memory-hard and available through the Node runtime used by the course stack. The contract fixes `N = 32768`, `r = 8`, `p = 1`, a 16-byte random salt, a 32-byte derived key, and a 64 MiB maximum-memory limit so implementations and tests use the same security decision.
- An opaque database-backed session is appropriate for this same-origin educational application because logout and revocation are explicit and no token is exposed to client JavaScript. Each session stores a sliding eight-hour inactivity deadline and a fixed 24-hour absolute deadline.
- Same-origin and double-submit CSRF checks are used because authentication is cookie-based and all state-changing requests originate from the application client.
- Failed login attempts use a server-side email-and-source-IP limiter with the BR-45 threshold and temporary throttle. It does not permanently lock accounts, which keeps the decision within the Lab 3 exclusions.
- Administrators have read-only access to protected Ticket communication needed to satisfy the visibility rules and may change IT Priority because the Lab 3 sheet explicitly permits that mutation. They do not receive ownership, status, Public Comment, Internal Note, or other IT Staff mutation controls.
- Owner assignment accepts active IT Staff and Administrator Users because the Lab 3 sheet permits either role as a primary Ticket Owner. The Administrator UI does not expose Staff Queue, ownership, status, Public Comment, or Internal Note actions. Its protected Ticket view exposes only the explicitly permitted IT Priority edit.
- Local seeded credentials are examples for development and test evidence only. They are not production secrets.
- The Answer Sheet and final PDF are individual external submission artifacts and remain outside Git.
