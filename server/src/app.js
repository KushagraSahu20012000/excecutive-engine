import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDbStatus, isDbConnected } from './utils/db.js';
import authRoutes from './routes/auth.js';
import deadlineRoutes from './routes/deadlines.js';
import goalRoutes from './routes/goals.js';
import settingsRoutes from './routes/settings.js';
import statsRoutes from './routes/stats.js';
import taskRoutes from './routes/tasks.js';

export function createApp() {
  const app = express();
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  app.use(cors({ origin: clientOrigin, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(morgan('dev'));

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true, database: getDbStatus() });
  });

  app.use('/api', (_request, response, next) => {
    if (!isDbConnected()) {
      response.status(503).json({ message: 'Database unavailable', database: getDbStatus() });
      return;
    }

    next();
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/goals', goalRoutes);
  app.use('/api/deadlines', deadlineRoutes);
  app.use('/api/stats', statsRoutes);

  app.use('/api', (_request, response) => {
    response.status(404).json({ message: 'API route not found' });
  });

  if (process.env.NODE_ENV === 'production') {
    const clientDistPath = path.resolve(__dirname, '../../client/dist');
    app.use(express.static(clientDistPath));
    app.get('*', (_request, response) => {
      response.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  app.use((error, _request, response, _next) => {
    console.error(error);
    response.status(error.status || 500).json({ message: error.message || 'Server error' });
  });

  return app;
}