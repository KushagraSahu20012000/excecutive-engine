import dotenv from 'dotenv';
import http from 'http';
import { connectDb } from './utils/db.js';
import { createApp } from './app.js';
import { initRealtime } from './utils/realtime.js';
import { startAlarmScheduler } from './utils/scheduler.js';

dotenv.config();

const app = createApp();
const server = http.createServer(app);
const port = process.env.PORT || 4000;
const dbRetryDelayMs = 10000;

initRealtime(server);
startAlarmScheduler();

async function connectDbWithRetry() {
  try {
    await connectDb();
  } catch (error) {
    console.error('MongoDB connection failed. Retrying soon.', error);
    setTimeout(connectDbWithRetry, dbRetryDelayMs);
  }
}

server.listen(port, () => {
  console.log(`Executive Engine API running on ${port}`);
  connectDbWithRetry();
});