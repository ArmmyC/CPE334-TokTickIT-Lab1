import cors from 'cors';
import express from 'express';
import { prisma } from './lib/prisma.js';

export type CategoryRecord = {
  id: number;
  name: string;
};

export type CategoryApiDatabase = {
  category: {
    findMany(args: {
      select: { id: true; name: true };
      orderBy: { id: 'asc' };
    }): Promise<CategoryRecord[]>;
  };
};

export type DevelopmentRequesterRecord = {
  id: number;
  name: string;
  email: string;
};

export type DevelopmentRequesterApiDatabase = {
  developmentRequester: {
    findMany(args: {
      where: { isActive: true };
      select: { id: true; name: true; email: true };
      orderBy: { name: 'asc' };
    }): Promise<DevelopmentRequesterRecord[]>;
  };
};

export type ApplicationApiDatabase = CategoryApiDatabase &
  Partial<DevelopmentRequesterApiDatabase>;

export function createApp(database: ApplicationApiDatabase = prisma) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_request, response) => {
    response.status(200).json({
      status: 'ok',
      service: 'TokTickIT API',
    });
  });

  app.get('/api/categories', async (_request, response) => {
    try {
      const categories = await database.category.findMany({
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          id: 'asc',
        },
      });

      response.status(200).json(categories);
    } catch (error) {
      console.error('TokTickIT categories API error:', error);
      response.status(500).json({
        error: 'Unable to load categories.',
      });
    }
  });

  app.get('/api/development-requesters', async (_request, response) => {
    try {
      if (!database.developmentRequester) {
        throw new Error('Development Requester database access is unavailable.');
      }

      const requesters = await database.developmentRequester.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
        orderBy: {
          name: 'asc',
        },
      });

      response.status(200).json(requesters);
    } catch (error) {
      console.error('TokTickIT Development Requesters API error:', error);
      response.status(500).json({
        error: 'Unable to load Development Requesters.',
      });
    }
  });

  return app;
}

export const app = createApp();
