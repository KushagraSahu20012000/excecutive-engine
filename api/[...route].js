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
    await ensureDbConnected();
    return app(request, response);
  } catch (error) {
    console.error('Database connection failed for Vercel request', error);
    response.status(503).json({ message: 'Database unavailable' });
  }
}