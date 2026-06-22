import cookieParser from 'cookie-parser';
import express from 'express';
import fs from 'fs';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDbStatus, isDbConnected } from './utils/db.js';
import authRoutes from './routes/auth.js';
import deadlineRoutes from './routes/deadlines.js';
import goalRoutes from './routes/goals.js';
import pushRoutes from './routes/push.js';
import settingsRoutes from './routes/settings.js';
import statsRoutes from './routes/stats.js';
import taskRoutes from './routes/tasks.js';

export function createApp() {
  const app = express();
  const normalizeOrigin = (origin) => String(origin || '').trim().replace(/\/$/, '');
  const clientOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((value) => normalizeOrigin(value))
    .filter(Boolean);
  const vercelOrigins = [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL]
    .filter(Boolean)
    .map((value) => normalizeOrigin(`https://${value}`));
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  function resolveAllowedOrigin(requestOrigin, request) {
    if (!requestOrigin) {
      return true;
    }

    const normalizedRequestOrigin = normalizeOrigin(requestOrigin);

    if (clientOrigins.includes('*')) {
      return normalizedRequestOrigin;
    }

    if (clientOrigins.includes(normalizedRequestOrigin) || vercelOrigins.includes(normalizedRequestOrigin)) {
      return normalizedRequestOrigin;
    }

    const forwardedProtoHeader = request.headers['x-forwarded-proto'];
    const forwardedHostHeader = request.headers['x-forwarded-host'];
    const forwardedProto = Array.isArray(forwardedProtoHeader)
      ? forwardedProtoHeader[0]
      : (forwardedProtoHeader || 'http').split(',')[0].trim();
    const forwardedHost = Array.isArray(forwardedHostHeader)
      ? forwardedHostHeader[0]
      : (forwardedHostHeader || request.headers.host || '').split(',')[0].trim();
    const sameHostOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : '';

    if (sameHostOrigin && normalizedRequestOrigin === normalizeOrigin(sameHostOrigin)) {
      return normalizedRequestOrigin;
    }

    return false;
  }

  app.use((request, response, next) => {
    const requestOrigin = request.headers.origin;
    const allowedOrigin = resolveAllowedOrigin(requestOrigin, request);
    response.setHeader('X-EE-CORS-Version', '2');

    if (allowedOrigin === false) {
      response.status(403).json({ message: 'CORS origin not allowed' });
      return;
    }

    if (requestOrigin) {
      response.setHeader('Access-Control-Allow-Origin', String(allowedOrigin));
      response.setHeader('Access-Control-Allow-Credentials', 'true');
      response.setHeader('Vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers');
    }

    if (request.method === 'OPTIONS') {
      const requestedMethod = request.headers['access-control-request-method'];
      const requestedHeaders = request.headers['access-control-request-headers'];
      response.setHeader('Access-Control-Allow-Methods', requestedMethod || 'GET,HEAD,POST,PUT,PATCH,DELETE');
      response.setHeader('Access-Control-Allow-Headers', requestedHeaders || 'Content-Type, Authorization');
      response.setHeader('Access-Control-Max-Age', '600');
      response.status(204).end();
      return;
    }

    next();
  });
  app.use(express.json());
  app.use(cookieParser());
  app.use(morgan('dev'));

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true, database: getDbStatus() });
  });

  app.get('/', (_request, response) => {
    response.status(200).json({ service: 'Executive Engine API', ok: true });
  });

  app.use('/api', (_request, response, next) => {
    if (!isDbConnected()) {
      response.status(503).json({ message: 'Database unavailable', database: getDbStatus() });
      return;
    }

    next();
  });

  app.use('/api/session', authRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/goals', goalRoutes);
  app.use('/api/deadlines', deadlineRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/push', pushRoutes);

  app.use('/api', (_request, response) => {
    response.status(404).json({ message: 'API route not found' });
  });

  if (process.env.NODE_ENV === 'production') {
    const clientDistPath = path.resolve(__dirname, '../../client/dist');
    const shouldServeClient = process.env.SERVE_CLIENT !== 'false' && fs.existsSync(clientDistPath);

    if (shouldServeClient) {
      app.use(express.static(clientDistPath));
      app.get('*', (_request, response) => {
        response.sendFile(path.join(clientDistPath, 'index.html'));
      });
    }
  }

  app.use((error, _request, response, _next) => {
    console.error(error);
    response.status(error.status || 500).json({ message: error.message || 'Server error' });
  });

  return app;
}