BEGIN;

ALTER TABLE "Ticket"
    ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "lastStaffActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "lastRequesterVisibleActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Ticket" AS ticket
SET
    "lastStaffActivityAt" = GREATEST(
        ticket."createdAt",
        ticket."updatedAt",
        COALESCE((
            SELECT MAX(comment."createdAt")
            FROM "PublicComment" AS comment
            WHERE comment."ticketId" = ticket."id"
        ), ticket."createdAt"),
        COALESCE((
            SELECT MAX(note."createdAt")
            FROM "InternalNote" AS note
            WHERE note."ticketId" = ticket."id"
        ), ticket."createdAt"),
        COALESCE((
            SELECT MAX(GREATEST(attachment."uploadedAt", COALESCE(attachment."removedAt", attachment."uploadedAt")))
            FROM "Attachment" AS attachment
            WHERE attachment."ticketId" = ticket."id"
        ), ticket."createdAt"),
        COALESCE(ticket."requesterResolvedAt", ticket."createdAt")
    ),
    "lastRequesterVisibleActivityAt" = GREATEST(
        ticket."createdAt",
        ticket."updatedAt",
        COALESCE((
            SELECT MAX(comment."createdAt")
            FROM "PublicComment" AS comment
            WHERE comment."ticketId" = ticket."id"
        ), ticket."createdAt"),
        COALESCE((
            SELECT MAX(GREATEST(attachment."uploadedAt", COALESCE(attachment."removedAt", attachment."uploadedAt")))
            FROM "Attachment" AS attachment
            WHERE attachment."ticketId" = ticket."id"
        ), ticket."createdAt"),
        COALESCE(ticket."requesterResolvedAt", ticket."createdAt")
    );

CREATE TYPE "TicketStatusHistoryEventKind" AS ENUM ('INITIAL', 'TRANSITION', 'LEGACY_BASELINE');

CREATE TABLE "ActionTaken" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "actionAt" TIMESTAMP(3) NOT NULL,
    "description" VARCHAR(4000) NOT NULL,
    "result" VARCHAR(4000) NOT NULL,
    "performedById" INTEGER NOT NULL,
    "followUpRequired" BOOLEAN NOT NULL,
    "followUpCompleted" BOOLEAN NOT NULL DEFAULT false,
    "followUpNote" VARCHAR(2000),
    "attachmentNotes" VARCHAR(2000),
    "idempotencyKey" UUID NOT NULL,
    "idempotencyPayloadHash" VARCHAR(64) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" INTEGER NOT NULL,

    CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ActionTaken_followUpCompletion_check"
        CHECK (NOT "followUpCompleted" OR "followUpRequired"),
    CONSTRAINT "ActionTaken_followUpFields_check"
        CHECK (
            ("followUpRequired" AND "followUpNote" IS NOT NULL AND length(trim("followUpNote")) > 0)
            OR (NOT "followUpRequired" AND NOT "followUpCompleted" AND "followUpNote" IS NULL)
        ),
    CONSTRAINT "ActionTaken_version_check" CHECK ("version" >= 1)
);

CREATE TABLE "TicketStatusHistory" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "fromStatus" "TicketStatus",
    "toStatus" "TicketStatus" NOT NULL,
    "actorId" INTEGER,
    "eventKind" "TicketStatusHistoryEventKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketStatusHistory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TicketStatusHistory_eventShape_check" CHECK (
        ("eventKind" = 'LEGACY_BASELINE' AND "fromStatus" IS NULL AND "actorId" IS NULL)
        OR ("eventKind" = 'INITIAL' AND "fromStatus" IS NULL AND "toStatus" = 'NEW' AND "actorId" IS NOT NULL)
        OR ("eventKind" = 'TRANSITION' AND "fromStatus" IS NOT NULL AND "actorId" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "ActionTaken_performedById_idempotencyKey_key"
    ON "ActionTaken"("performedById", "idempotencyKey");
CREATE INDEX "ActionTaken_ticketId_actionAt_id_idx"
    ON "ActionTaken"("ticketId", "actionAt", "id");
CREATE INDEX "ActionTaken_performedById_actionAt_id_idx"
    ON "ActionTaken"("performedById", "actionAt", "id");
CREATE INDEX "TicketStatusHistory_ticketId_createdAt_id_idx"
    ON "TicketStatusHistory"("ticketId", "createdAt", "id");
CREATE INDEX "Ticket_requesterId_lastRequesterVisibleActivityAt_id_idx"
    ON "Ticket"("requesterId", "lastRequesterVisibleActivityAt", "id");
CREATE INDEX "Ticket_ownerId_lastStaffActivityAt_id_idx"
    ON "Ticket"("ownerId", "lastStaffActivityAt", "id");

ALTER TABLE "ActionTaken"
    ADD CONSTRAINT "ActionTaken_ticketId_fkey"
        FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "ActionTaken_performedById_fkey"
        FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "ActionTaken_updatedById_fkey"
        FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TicketStatusHistory"
    ADD CONSTRAINT "TicketStatusHistory_ticketId_fkey"
        FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "TicketStatusHistory_actorId_fkey"
        FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "TicketStatusHistory" ("ticketId", "fromStatus", "toStatus", "actorId", "eventKind", "createdAt")
SELECT "id", NULL, "currentStatus", NULL, 'LEGACY_BASELINE', CURRENT_TIMESTAMP
FROM "Ticket";

CREATE FUNCTION "reject_ticket_status_history_mutation"() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Ticket status history is append-only.' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "TicketStatusHistory_append_only"
    BEFORE UPDATE OR DELETE ON "TicketStatusHistory"
    FOR EACH ROW EXECUTE FUNCTION "reject_ticket_status_history_mutation"();

CREATE FUNCTION "protect_action_taken_identity"() RETURNS trigger AS $$
BEGIN
    IF NEW."ticketId" IS DISTINCT FROM OLD."ticketId"
        OR NEW."performedById" IS DISTINCT FROM OLD."performedById"
        OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
        OR NEW."idempotencyPayloadHash" IS DISTINCT FROM OLD."idempotencyPayloadHash" THEN
        RAISE EXCEPTION 'Action Taken identity and retry fingerprint are immutable.' USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ActionTaken_identity_immutable"
    BEFORE UPDATE ON "ActionTaken"
    FOR EACH ROW EXECUTE FUNCTION "protect_action_taken_identity"();

COMMIT;
