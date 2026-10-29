# Lab 4 Migration Recovery

This guide applies to the additive Lab 4 database migration in `server/prisma/migrations/20261029000000_lab_04_actions_taken/`. The migration preserves existing Tickets and their relationships while adding workflow history, Action Taken storage, version fields, and activity timestamps.

## Before applying the migration

1. Stop application writes and scheduled jobs that can change Tickets, comments, notes, attachments, or user relationships.
2. Take a database backup using the database platform's verified backup procedure. Confirm the backup can be read before applying the migration.
3. Record counts and representative identifiers for Users, Tickets, Attachments, Public Comments, and Internal Notes. Include Ticket statuses, owners, requesters, and existing resolution timestamps.
4. Confirm the deployment targets the intended database and that the current Prisma migration history is at the Lab 3 version.
5. Apply the migration through the reviewed release process. Do not edit production data manually to make the migration appear successful.

## Verify the result

1. Confirm the Lab 4 migration appears as applied in Prisma migration history.
2. Compare the recorded legacy counts, identifiers, Ticket relationships, statuses, and resolution timestamps. Existing Tickets must have `version = 0`, no backfilled Actions Taken, and one `LEGACY_BASELINE` history row that matches their migrated current status.
3. Confirm new Ticket activity timestamps are populated from the documented Lab 3 activity sources. They are approximate legacy activity markers and must not be treated as recent status transitions.
4. Run the required migration, seed, Lab 1–3 regression, and application checks against a disposable test database before accepting the release.

## If the migration fails before any application writes resume

The migration is transactional. Keep the application write freeze in place, inspect the database error and Prisma migration history, and confirm the legacy tables remain intact. If the database reports that the migration did not apply, restore the verified pre-migration backup when necessary, verify the restored Lab 3 counts and relationships, then retry the reviewed migration after the cause is fixed. Do not delete partially created data by hand.

## If an error is found after application writes resume

Stop further writes and preserve a fresh backup and incident snapshot first. Do not roll back the migration or drop the new tables, because Action Taken rows and status history may contain valid work created after release. Prefer a reviewed forward fix that preserves new rows and repairs the affected derived state. If a restore is necessary, coordinate a consistent restore of the database and application state from a known recovery point, reconcile any writes made after that point, and verify counts, relationships, history ordering, Action Taken performers, and idempotency keys before reopening writes.

## Recovery limits

- `TicketStatusHistory` is database-enforced append-only. A normal update/delete is rejected.
- Action Taken records preserve their performer and idempotency identity. Use the application edit flow for permitted corrections.
- Never reconstruct historical transitions from `Ticket.updatedAt`; the migration labels the known current state as `LEGACY_BASELINE` instead.
- Recovery of post-migration writes requires a consistent database backup or a forward repair. Reapplying the migration does not restore rows removed by an external destructive operation.
