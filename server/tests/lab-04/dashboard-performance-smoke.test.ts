import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { afterAll, describe, expect, it } from 'vitest';
import {
  dashboardTestDatabase,
  loginDashboardUser,
  withDashboardTestTransaction,
  type DashboardPriority,
  type DashboardStatus,
} from './dashboard-api-test-support.js';

const ticketCount = 1_000;
const requestsPerEndpoint = 25;
const p95TargetMs = 1_000;
const statuses: DashboardStatus[] = [
  'NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER',
  'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED',
];
const priorities: Exclude<DashboardPriority, null>[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const hourMs = 60 * 60 * 1_000;
const dayMs = 24 * hourMs;

async function measureP95(
  agent: Awaited<ReturnType<typeof loginDashboardUser>>['agent'],
  endpoint: string,
): Promise<number> {
  const warmup = await agent.get(endpoint);
  expect(warmup.status).toBe(200);

  const samples: number[] = [];
  for (let attempt = 0; attempt < requestsPerEndpoint; attempt += 1) {
    const startedAt = performance.now();
    const response = await agent.get(endpoint);
    samples.push(performance.now() - startedAt);
    expect(response.status).toBe(200);
  }

  samples.sort((left, right) => left - right);
  return samples[Math.ceil(samples.length * 0.95) - 1];
}

describe('Lab 4 dashboard performance smoke', () => {
  afterAll(async () => dashboardTestDatabase.$disconnect());

  it('keeps dashboard p95 below one second with 1,000 seeded Tickets', async () => {
    await withDashboardTestTransaction(async (context) => {
      const marker = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
      const asOf = new Date();
      const tickets = Array.from({ length: ticketCount }, (_, index) => {
        const createdAt = new Date(asOf.getTime() - (45 + (index % 30)) * dayMs);
        const staffActivityAt = new Date(asOf.getTime() - (index % 24) * hourMs);
        const requesterActivityAt = new Date(asOf.getTime() - (index % 30) * dayMs);
        return {
          ticketNumber: `L4-PERF-${marker}-${String(index).padStart(4, '0')}`,
          ticketDate: createdAt,
          requesterId: index % 2 === 0
            ? context.users.requester.id
            : context.users.otherRequester.id,
          ownerId: index % 3 === 0
            ? null
            : index % 2 === 0
              ? context.users.staff.id
              : context.users.otherStaff.id,
          categoryId: context.categoryId,
          relatedSystemId: context.relatedSystemId,
          summary: `Dashboard performance fixture ${index}`,
          description: 'Seeded for the Lab 4 dashboard performance smoke test.',
          requestedPriority: 'MEDIUM' as const,
          itPriority: priorities[index % priorities.length],
          currentStatus: statuses[index % statuses.length],
          version: 0,
          lastStaffActivityAt: staffActivityAt,
          lastRequesterVisibleActivityAt: requesterActivityAt,
          createdAt,
          updatedAt: staffActivityAt,
        };
      });

      await context.database.ticket.createMany({ data: tickets });

      const storedTickets = await context.database.ticket.findMany({
        where: { ticketNumber: { startsWith: `L4-PERF-${marker}-` } },
        orderBy: { ticketNumber: 'asc' },
        select: { id: true },
      });
      expect(storedTickets).toHaveLength(ticketCount);

      const actions = storedTickets.flatMap(({ id: ticketId }, index) => {
        const actionRows = [];
        const actionAt = new Date(asOf.getTime() - (index % 24) * hourMs);
        const base = {
          ticketId,
          actionAt,
          description: 'Dashboard performance fixture action.',
          result: 'Measured by the performance smoke test.',
          followUpRequired: false,
          followUpCompleted: false,
          followUpNote: null,
          attachmentNotes: null,
          version: 1,
          createdAt: actionAt,
          updatedAt: actionAt,
          idempotencyPayloadHash: 'a'.repeat(64),
        };

        if (index % 4 === 0) {
          actionRows.push({
            ...base,
            performedById: context.users.staff.id,
            updatedById: context.users.staff.id,
            idempotencyKey: randomUUID(),
          });
        }
        if (index % 10 === 0) {
          actionRows.push({
            ...base,
            performedById: context.users.otherStaff.id,
            updatedById: context.users.otherStaff.id,
            idempotencyKey: randomUUID(),
          });
        }
        return actionRows;
      });
      await context.database.actionTaken.createMany({ data: actions });

      const requester = await loginDashboardUser(context, context.users.requester);
      const staff = await loginDashboardUser(context, context.users.staff);
      const requesterP95Ms = await measureP95(requester.agent, '/api/requester/dashboard');
      const staffP95Ms = await measureP95(staff.agent, '/api/staff/dashboard');

      console.info(
        `Dashboard performance smoke: 1,000 Tickets, ${requestsPerEndpoint} warm requests each, `
        + `Requester p95=${requesterP95Ms.toFixed(1)}ms, Staff p95=${staffP95Ms.toFixed(1)}ms.`,
      );

      expect(requesterP95Ms).toBeLessThan(p95TargetMs);
      expect(staffP95Ms).toBeLessThan(p95TargetMs);
    });
  }, 90_000);
});
