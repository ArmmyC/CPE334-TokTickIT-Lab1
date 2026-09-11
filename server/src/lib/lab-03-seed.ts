import { hashPassword } from '../auth/password.js';
import {
  LEGACY_MIGRATION_PLACEHOLDER_HASH,
  legacyInitialPassword,
} from './lab-03-credentials.js';
import { CATEGORY_NAMES } from './category-seed.js';
import { RELATED_SYSTEM_NAMES } from './lab-02-seed.js';

export const LAB3_USERS = [
  {
    name: 'Ariya Anderson',
    email: 'ariya@example.test',
    role: 'REQUESTER',
    isActive: true,
    password: 'TokTickIT-Lab3!User-1-Aa',
  },
  {
    name: 'Narin Chai',
    email: 'narin@example.test',
    role: 'REQUESTER',
    isActive: true,
    password: 'TokTickIT-Lab3!User-2-Aa',
  },
  {
    name: 'Pimchanok Dee',
    email: 'pimchanok@example.test',
    role: 'REQUESTER',
    isActive: true,
    password: 'TokTickIT-Lab3!User-3-Aa',
  },
  {
    name: 'Kittipong Saelim',
    email: 'kittipong@example.test',
    role: 'REQUESTER',
    isActive: true,
    password: 'TokTickIT-Lab3!User-4-Aa',
  },
  {
    name: 'Mali Boonmee',
    email: 'mali@example.test',
    role: 'REQUESTER',
    isActive: false,
    password: 'TokTickIT-Lab3!User-5-Aa',
  },
  {
    name: 'Somchai Rattanakul',
    email: 'somchai@example.test',
    role: 'IT_STAFF',
    isActive: true,
    password: 'TokTickIT-Lab3!Staff-Sr',
  },
  {
    name: 'Nalinee Wong',
    email: 'nalinee@example.test',
    role: 'IT_STAFF',
    isActive: true,
    password: 'TokTickIT-Lab3!Staff-Nw',
  },
  {
    name: 'Chaiwat Kittisak',
    email: 'chaiwat@example.test',
    role: 'IT_STAFF',
    isActive: true,
    password: 'TokTickIT-Lab3!Staff-Ck',
  },
  {
    name: 'Ploy Suksan',
    email: 'ploy@example.test',
    role: 'IT_STAFF',
    isActive: false,
    password: 'TokTickIT-Lab3!Staff-Ps',
  },
  {
    name: 'Anong Prasert',
    email: 'anong@example.test',
    role: 'ADMINISTRATOR',
    isActive: true,
    password: 'TokTickIT-Lab3!Admin-Ap',
  },
] as const;

const TICKET_SEEDS = [
  {
    ticketNumber: 'TKT-2026-000001',
    requesterEmail: 'ariya@example.test',
    ownerEmail: null,
    category: 'Network',
    relatedSystem: 'Campus Wi-Fi',
    summary: 'Wi-Fi disconnects in the engineering lab',
    description: 'The wireless connection drops every few minutes in the engineering lab.',
    requestedPriority: 'HIGH',
    itPriority: 'HIGH',
    currentStatus: 'NEW',
  },
  {
    ticketNumber: 'TKT-2026-000002',
    requesterEmail: 'narin@example.test',
    ownerEmail: 'somchai@example.test',
    category: 'Account and Access',
    relatedSystem: 'VPN',
    summary: 'VPN access fails after password rotation',
    description: 'The requester cannot connect to the campus VPN after changing their password.',
    requestedPriority: 'URGENT',
    itPriority: 'URGENT',
    currentStatus: 'OPEN',
  },
  {
    ticketNumber: 'TKT-2026-000003',
    requesterEmail: 'pimchanok@example.test',
    ownerEmail: 'nalinee@example.test',
    category: 'Software',
    relatedSystem: 'LEB2 App',
    summary: 'Course submission page shows a blank panel',
    description: 'The course submission page renders a blank panel when a draft is opened.',
    requestedPriority: 'MEDIUM',
    itPriority: 'MEDIUM',
    currentStatus: 'IN_PROGRESS',
  },
  {
    ticketNumber: 'TKT-2026-000004',
    requesterEmail: 'kittipong@example.test',
    ownerEmail: 'chaiwat@example.test',
    category: 'Hardware',
    relatedSystem: 'Printer',
    summary: 'Shared printer is waiting for a job',
    description: 'Jobs submitted to the shared printer remain queued and never start printing.',
    requestedPriority: 'HIGH',
    itPriority: 'MEDIUM',
    currentStatus: 'WAITING_FOR_REQUESTER',
  },
  {
    ticketNumber: 'TKT-2026-000005',
    requesterEmail: 'ariya@example.test',
    ownerEmail: 'somchai@example.test',
    category: 'Software',
    relatedSystem: 'Grade Submission App',
    summary: 'Grade submission confirmation is delayed',
    description: 'The confirmation message takes several minutes to appear after a grade is submitted.',
    requestedPriority: 'LOW',
    itPriority: 'LOW',
    currentStatus: 'RESOLVED',
  },
  {
    ticketNumber: 'TKT-2026-000006',
    requesterEmail: 'narin@example.test',
    ownerEmail: 'nalinee@example.test',
    category: 'Network',
    relatedSystem: 'Email',
    summary: 'Email messages arrive late',
    description: 'Messages sent from the campus network arrive in the mailbox after a long delay.',
    requestedPriority: 'MEDIUM',
    itPriority: 'MEDIUM',
    currentStatus: 'CLOSED',
  },
  {
    ticketNumber: 'TKT-2026-000007',
    requesterEmail: 'pimchanok@example.test',
    ownerEmail: 'chaiwat@example.test',
    category: 'Hardware',
    relatedSystem: 'Corporate Laptop',
    summary: 'Laptop camera stopped working',
    description: 'The built-in camera is no longer detected by the meeting application.',
    requestedPriority: 'HIGH',
    itPriority: 'HIGH',
    currentStatus: 'REOPENED',
  },
  {
    ticketNumber: 'TKT-2026-000008',
    requesterEmail: 'kittipong@example.test',
    ownerEmail: null,
    category: 'Account and Access',
    relatedSystem: 'Grade Submission App',
    summary: 'Duplicate access request is no longer needed',
    description: 'This duplicate access request can be cancelled because the original request was completed.',
    requestedPriority: 'LOW',
    itPriority: 'LOW',
    currentStatus: 'CANCELLED',
  },
] as const;

const COMMENT_SEEDS = [
  {
    ticketNumber: 'TKT-2026-000002',
    authorEmail: 'narin@example.test',
    content: 'I can connect from home, but the campus VPN still rejects the new password.',
  },
  {
    ticketNumber: 'TKT-2026-000002',
    authorEmail: 'somchai@example.test',
    content: 'I am checking the account policy and will update the Ticket after the directory sync.',
  },
  {
    ticketNumber: 'TKT-2026-000005',
    authorEmail: 'ariya@example.test',
    content: 'The confirmation now appears correctly. Thank you for the fix.',
  },
] as const;

const NOTE_SEEDS = [
  {
    ticketNumber: 'TKT-2026-000002',
    authorEmail: 'somchai@example.test',
    content: 'The directory policy cache was refreshed on the VPN gateway.',
  },
  {
    ticketNumber: 'TKT-2026-000003',
    authorEmail: 'nalinee@example.test',
    content: 'Browser console output points to a stale course-widget bundle.',
  },
] as const;

type UserRole = 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type TicketStatus = 'NEW' | 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_REQUESTER' | 'RESOLVED' | 'CLOSED' | 'REOPENED' | 'CANCELLED';

type Lab3SeedClient = {
  category: {
    upsert(args: {
      where: { name: string };
      update: { name: string; isActive: boolean };
      create: { name: string; isActive: boolean };
    }): Promise<{ id: number }>;
  };
  relatedSystem: {
    upsert(args: {
      where: { name: string };
      update: { name: string; isActive: boolean };
      create: { name: string; isActive: boolean };
    }): Promise<{ id: number }>;
  };
  user: {
    upsert(args: {
      where: { email: string };
      update: { name: string; email: string; role: UserRole; isActive: boolean };
      create: {
        name: string;
        email: string;
        passwordHash: string;
        role: UserRole;
        isActive: boolean;
        mustChangePassword: boolean;
      };
    }): Promise<{ id: number }>;
    findUnique(args: { where: { email: string } }): Promise<{ id: number; passwordHash: string } | null>;
    update(args: {
      where: { id: number };
      data: { passwordHash: string; mustChangePassword: boolean };
    }): Promise<unknown>;
  };
  ticket: {
    upsert(args: {
      where: { ticketNumber: string };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }): Promise<{ id: number }>;
    findUnique(args: { where: { ticketNumber: string } }): Promise<{ id: number } | null>;
  };
  publicComment: {
    findFirst(args: { where: { ticketId: number; authorId: number; content: string } }): Promise<unknown>;
    create(args: { data: { ticketId: number; authorId: number; content: string } }): Promise<unknown>;
  };
  internalNote: {
    findFirst(args: { where: { ticketId: number; authorId: number; content: string } }): Promise<unknown>;
    create(args: { data: { ticketId: number; authorId: number; content: string } }): Promise<unknown>;
  };
};

export async function seedLab3Data(database: Lab3SeedClient): Promise<void> {
  const categories = new Map<string, number>();
  for (const name of CATEGORY_NAMES) {
    const category = await database.category.upsert({
      where: { name },
      update: { name, isActive: true },
      create: { name, isActive: true },
    });
    categories.set(name, category.id);
  }

  const relatedSystems = new Map<string, number>();
  for (const name of RELATED_SYSTEM_NAMES) {
    const relatedSystem = await database.relatedSystem.upsert({
      where: { name },
      update: { name, isActive: true },
      create: { name, isActive: true },
    });
    relatedSystems.set(name, relatedSystem.id);
  }

  const users = new Map<string, number>();
  for (const user of LAB3_USERS) {
    const existingUser = await database.user.findUnique({
      where: { email: user.email },
    });
    const passwordHash = user.role === 'REQUESTER'
      ? LEGACY_MIGRATION_PLACEHOLDER_HASH
      : await hashPassword(user.password);
    const savedUser = await database.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
      create: {
        name: user.name,
        email: user.email,
        passwordHash,
        role: user.role,
        isActive: user.isActive,
        mustChangePassword: true,
      },
    });
    if (user.role === 'REQUESTER' &&
        (!existingUser || existingUser.passwordHash === LEGACY_MIGRATION_PLACEHOLDER_HASH)) {
      await database.user.update({
        where: { id: savedUser.id },
        data: {
          passwordHash: await hashPassword(legacyInitialPassword(savedUser.id)),
          mustChangePassword: true,
        },
      });
    }
    users.set(user.email, savedUser.id);
  }

  const tickets = new Map<string, number>();
  for (const ticket of TICKET_SEEDS) {
    const requesterId = users.get(ticket.requesterEmail);
    const categoryId = categories.get(ticket.category);
    const relatedSystemId = relatedSystems.get(ticket.relatedSystem);
    const ownerId = ticket.ownerEmail === null ? null : users.get(ticket.ownerEmail);
    if (!requesterId || !categoryId || !relatedSystemId || (ticket.ownerEmail !== null && !ownerId)) {
      throw new Error(`Seed references an unknown user or reference row for ${ticket.ticketNumber}.`);
    }

    const data = {
      requesterId,
      ownerId: ownerId ?? null,
      categoryId,
      relatedSystemId,
      summary: ticket.summary,
      description: ticket.description,
      requestedPriority: ticket.requestedPriority as TicketPriority,
      itPriority: ticket.itPriority as TicketPriority,
      currentStatus: ticket.currentStatus as TicketStatus,
    };
    const savedTicket = await database.ticket.upsert({
      where: { ticketNumber: ticket.ticketNumber },
      update: data,
      create: {
        ticketNumber: ticket.ticketNumber,
        ...data,
      },
    });
    tickets.set(ticket.ticketNumber, savedTicket.id);
  }

  for (const comment of COMMENT_SEEDS) {
    const ticketId = tickets.get(comment.ticketNumber);
    const authorId = users.get(comment.authorEmail);
    if (!ticketId || !authorId) {
      throw new Error(`Seed references an unknown comment target for ${comment.ticketNumber}.`);
    }
    const existing = await database.publicComment.findFirst({
      where: { ticketId, authorId, content: comment.content },
    });
    if (!existing) {
      await database.publicComment.create({
        data: { ticketId, authorId, content: comment.content },
      });
    }
  }

  for (const note of NOTE_SEEDS) {
    const ticketId = tickets.get(note.ticketNumber);
    const authorId = users.get(note.authorEmail);
    if (!ticketId || !authorId) {
      throw new Error(`Seed references an unknown note target for ${note.ticketNumber}.`);
    }
    const existing = await database.internalNote.findFirst({
      where: { ticketId, authorId, content: note.content },
    });
    if (!existing) {
      await database.internalNote.create({
        data: { ticketId, authorId, content: note.content },
      });
    }
  }
}

export type { Lab3SeedClient };
