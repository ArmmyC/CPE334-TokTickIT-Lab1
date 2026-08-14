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

export function createApp(database: CategoryApiDatabase = prisma) {
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

  return app;
}

export const app = createApp();
