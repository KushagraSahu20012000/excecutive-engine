import dotenv from 'dotenv';
import { createApp } from '../server/src/app.js';
import { connectDb } from '../server/src/utils/db.js';

dotenv.config();

const app = createApp();
let dbConnectPromise;
let hasStartedDbConnect = false;

function normalizeApiUrl(urlValue) {
  if (typeof urlValue !== 'string' || urlValue.length === 0) return '/api';

  // Handle both absolute URLs and relative request paths.
  let pathnameAndQuery = urlValue;
  if (/^https?:\/\//i.test(urlValue)) {
    try {
      const parsed = new URL(urlValue);
      pathnameAndQuery = `${parsed.pathname || '/'}${parsed.search || ''}`;
    } catch (_error) {
      pathnameAndQuery = '/api';
    }
  }

  const normalized = pathnameAndQuery.startsWith('/') ? pathnameAndQuery : `/${pathnameAndQuery}`;
  return normalized.startsWith('/api') ? normalized : `/api${normalized}`;
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
    request.url = normalizeApiUrl(request.url);

    // Do not block requests on initial DB connect in serverless.
    // API routes will return 503 until the connection is ready.
    if (!hasStartedDbConnect) {
      hasStartedDbConnect = true;
      void ensureDbConnected();
    }

    return app(request, response);
  } catch (error) {
    console.error('Database connection failed for Vercel request', error);
    response.status(503).json({ message: 'Database unavailable' });
  }
}