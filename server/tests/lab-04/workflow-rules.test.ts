import { describe, expect, it } from 'vitest';
import * as staffDetail from '../../src/tickets/staff-detail.js';
import {
  STAFF_TICKET_STATUS_TRANSITIONS,
  StaffTicketValidationError,
  parseStaffStatusPayload,
  type StaffTicketStatus,
} from '../../src/tickets/staff-detail.js';

const resolutionGate = (staffDetail as unknown as Record<string, unknown>)
  .isResolutionGateSatisfied as ((actions: Array<{
    followUpRequired: boolean;
    followUpCompleted: boolean;
  }>) => boolean) | undefined;

describe('Lab 4 Ticket workflow rules', () => {
  it('matches the complete approved transition matrix', () => {
    expect(STAFF_TICKET_STATUS_TRANSITIONS).toEqual({
      NEW: ['OPEN', 'CANCELLED'],
      OPEN: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'CANCELLED'],
      IN_PROGRESS: ['WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
      WAITING_FOR_REQUESTER: ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
      RESOLVED: ['CLOSED', 'REOPENED'],
      CLOSED: ['REOPENED'],
      REOPENED: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'CANCELLED'],
      CANCELLED: ['REOPENED'],
    });
  });

  it('parses the Lab 4 versioned status request without trusting a client current status', () => {
    let parsed: ReturnType<typeof parseStaffStatusPayload> | undefined;
    let thrown: unknown;
    try {
      parsed = parseStaffStatusPayload({ expectedVersion: 0, nextStatus: 'OPEN' });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeUndefined();
    if (parsed === undefined) return;
    expect(parsed).toEqual({ expectedVersion: 0, nextStatus: 'OPEN', confirmed: false });
  });

  it('requires confirmation only for Resolved, Closed, and Cancelled transitions', () => {
    const confirmationStatuses: StaffTicketStatus[] = ['RESOLVED', 'CLOSED', 'CANCELLED'];
    for (const nextStatus of confirmationStatuses) {
      expect(() => parseStaffStatusPayload({ expectedVersion: 1, nextStatus, confirmed: true })).not.toThrow();
      expect(() => parseStaffStatusPayload({ expectedVersion: 1, nextStatus, confirmed: false }))
        .toThrow(StaffTicketValidationError);
    }

    for (const nextStatus of ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'REOPENED'] as const) {
      expect(() => parseStaffStatusPayload({ expectedVersion: 1, nextStatus })).not.toThrow();
    }
  });

  it('requires at least one action and completion of every required follow-up', () => {
    expect(typeof resolutionGate).toBe('function');
    if (typeof resolutionGate !== 'function') return;

    expect(resolutionGate([])).toBe(false);
    expect(resolutionGate([{ followUpRequired: false, followUpCompleted: false }])).toBe(true);
    expect(resolutionGate([{ followUpRequired: true, followUpCompleted: false }])).toBe(false);
    expect(resolutionGate([{ followUpRequired: true, followUpCompleted: true }])).toBe(true);
    expect(resolutionGate([
      { followUpRequired: true, followUpCompleted: true },
      { followUpRequired: true, followUpCompleted: false },
    ])).toBe(false);
  });
});
