import dotenv from 'dotenv';
import { createApp } from '../server/src/app.js';
import { connectDb } from '../server/src/utils/db.js';

dotenv.config();

const app = createApp();
let dbConnectPromise;
let hasStartedDbConnect = false;

function getPathname(urlValue) {
  if (typeof urlValue !== 'string' || urlValue.length === 0) return '/';

  try {
    if (/^https?:\/\//i.test(urlValue)) {
      return new URL(urlValue).pathname || '/';
    }
    return new URL(urlValue, 'http://localhost').pathname || '/';
  } catch (_error) {
    return '/';
  }
}

async function ensureDbConnected() {
  if (!dbConnectPromise) {
    dbConnectPromise = connectDb().catch((error) => {
      dbConnectPromise = undefined;
      throw error;
    });
  }

  return dbConnectPromise;
}

export default async function handler(request, response) {
  try {
    const pathname = getPathname(request.url);

    if (!hasStartedDbConnect) {
      hasStartedDbConnect = true;
      void ensureDbConnected();
    }

    if (pathname !== '/api/health') {
      try {
        await ensureDbConnected();
      } catch (_error) {
        // Let Express middleware return consistent database status payload.
      }
    }

    return app(request, response);
  } catch (error) {
    console.error('Database connection failed for Vercel request', error);
    response.status(503).json({ message: 'Database unavailable' });
  }
}