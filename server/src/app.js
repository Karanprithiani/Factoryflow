import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { authenticate } from './middleware/auth.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import itemRoutes from './routes/items.js';
import requestRoutes from './routes/purchaseRequests.js';
import lotRoutes from './routes/lots.js';
import batchRoutes from './routes/batches.js';
import dashboardRoutes from './routes/dashboard.js';
import adminRoutes from './routes/admin.js';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin.split(',') }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  // Public
  app.use('/api/auth', authRoutes);

  // Everything below needs a valid login
  app.use('/api', authenticate);
  app.use('/api/users', userRoutes);
  app.use('/api/items', itemRoutes);
  app.use('/api/purchase-requests', requestRoutes);
  app.use('/api/lots', lotRoutes);
  app.use('/api/batches', batchRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/admin', adminRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
