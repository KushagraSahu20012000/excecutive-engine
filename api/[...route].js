import dotenv from 'dotenv';
import { createApp } from '../server/src/app.js';
import { connectDb } from '../server/src/utils/db.js';

dotenv.config();

const app = createApp();
let dbConnectPromise;

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
    // Some serverless adapters may pass the path without the /api prefix.
    // Normalize it so Express route mounting remains consistent.
    if (typeof request.url === 'string' && !request.url.startsWith('/api')) {
      const normalizedPath = request.url.startsWith('/') ? request.url : `/${request.url}`;
      request.url = `/api${normalizedPath}`;
    }

    await ensureDbConnected();
    return app(request, response);
  } catch (error) {
    console.error('Database connection failed for Vercel request', error);
    response.status(503).json({ message: 'Database unavailable' });
  }
}