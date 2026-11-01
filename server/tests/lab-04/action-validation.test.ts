import { describe, expect, it } from 'vitest';
import {
  ActionTakenValidationError,
  parseCreateActionTakenPayload,
  parseUpdateActionTakenPayload,
} from '../../src/tickets/actions-taken.js';

const fixedNow = new Date('2026-10-29T03:00:00.000Z');

describe('Lab 4 Action Taken validation', () => {
  it('trims content and converts offset-aware Action Date/Time values to UTC', () => {
    expect(parseCreateActionTakenPayload({
      actionAt: '2026-10-29T10:00:00+07:00',
      description: '  Replaced the power adapter.  ',
      result: '  The workstation starts normally.  ',
      followUpRequired: false,
      followUpNote: 'ignored when follow-up is not required',
      attachmentNotes: '  See the existing test report.  ',
    }, fixedNow)).toEqual({
      actionAt: new Date('2026-10-29T03:00:00.000Z'),
      description: 'Replaced the power adapter.',
      result: 'The workstation starts normally.',
      followUpRequired: false,
      followUpCompleted: false,
      followUpNote: null,
      attachmentNotes: 'See the existing test report.',
    });
  });

  it('requires an offset and rejects invalid or future Action Date/Time values', () => {
    for (const actionAt of [
      '2026-10-29T04:00:00',
      'not-a-date',
      '2026-10-29T03:00:00.001Z',
    ]) {
      expect(() => parseCreateActionTakenPayload({
        actionAt,
        description: 'Replaced the power adapter.',
        result: 'The workstation starts normally.',
        followUpRequired: false,
      }, fixedNow)).toThrow(ActionTakenValidationError);
    }
  });

  it('rejects impossible calendar dates instead of normalizing them', () => {
    expect(() => parseCreateActionTakenPayload({
      actionAt: '2026-02-30T12:00:00Z',
      description: 'Replaced the power adapter.',
      result: 'The workstation starts normally.',
      followUpRequired: false,
    }, fixedNow)).toThrow(ActionTakenValidationError);
  });

  it('requires a non-blank Follow-up Note when follow-up is required', () => {
    let error: unknown;
    try {
      parseCreateActionTakenPayload({
        actionAt: fixedNow.toISOString(),
        description: 'Replaced the power adapter.',
        result: 'The workstation starts normally.',
        followUpRequired: true,
        followUpNote: '   ',
      }, fixedNow);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ActionTakenValidationError);
    expect((error as ActionTakenValidationError).fieldErrors.followUpNote).toBeTruthy();
  });

  it('rejects unknown create fields, including client supplied performer, owner, and completion', () => {
    expect(() => parseCreateActionTakenPayload({
      actionAt: fixedNow.toISOString(),
      description: 'Replaced the power adapter.',
      result: 'The workstation starts normally.',
      followUpRequired: false,
      followUpCompleted: true,
      performedById: 4,
      ownerId: 5,
    }, fixedNow)).toThrow(ActionTakenValidationError);
  });

  it('rejects blank values and content beyond the sheet limits', () => {
    try {
      parseCreateActionTakenPayload({
        actionAt: fixedNow.toISOString(),
        description: '   ',
        result: 'x'.repeat(4001),
        followUpRequired: true,
        followUpNote: 'x'.repeat(2001),
        attachmentNotes: 'x'.repeat(2001),
      }, fixedNow);
      throw new Error('expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ActionTakenValidationError);
      expect((error as ActionTakenValidationError).fieldErrors).toEqual(expect.objectContaining({
        description: expect.any(String),
        result: expect.any(String),
        followUpNote: expect.any(String),
        attachmentNotes: expect.any(String),
      }));
    }
  });

  it('allows follow-up completion only on an existing required follow-up', () => {
    expect(parseUpdateActionTakenPayload({
      expectedVersion: 1,
      actionAt: fixedNow.toISOString(),
      description: 'Replaced the power adapter.',
      result: 'The workstation starts normally.',
      followUpRequired: true,
      followUpCompleted: true,
      followUpNote: 'Check battery health next week.',
      attachmentNotes: null,
    }, fixedNow)).toMatchObject({
      expectedVersion: 1,
      followUpRequired: true,
      followUpCompleted: true,
      followUpNote: 'Check battery health next week.',
    });

    expect(() => parseUpdateActionTakenPayload({
      expectedVersion: 1,
      actionAt: fixedNow.toISOString(),
      description: 'Replaced the power adapter.',
      result: 'The workstation starts normally.',
      followUpRequired: false,
      followUpCompleted: true,
      followUpNote: null,
      attachmentNotes: null,
    }, fixedNow)).toThrow(ActionTakenValidationError);
  });

  it('requires a positive expected version for updates', () => {
    expect(() => parseUpdateActionTakenPayload({
      expectedVersion: 0,
      actionAt: fixedNow.toISOString(),
      description: 'Replaced the power adapter.',
      result: 'The workstation starts normally.',
      followUpRequired: false,
      followUpCompleted: false,
      followUpNote: null,
      attachmentNotes: null,
    }, fixedNow)).toThrow(ActionTakenValidationError);
  });
});
