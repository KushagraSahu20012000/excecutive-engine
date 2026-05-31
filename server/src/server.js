import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import morgan from 'morgan';
import { connectDb } from './utils/db.js';
import { initRealtime } from './utils/realtime.js';
import authRoutes from './routes/auth.js';
import deadlineRoutes from './routes/deadlines.js';
import goalRoutes from './routes/goals.js';
import settingsRoutes from './routes/settings.js';
import statsRoutes from './routes/stats.js';
import taskRoutes from './routes/tasks.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 4000;
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/deadlines', deadlineRoutes);
app.use('/api/stats', statsRoutes);

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(error.status || 500).json({ message: error.message || 'Server error' });
});

initRealtime(server);

connectDb().then(() => {
  server.listen(port, () => {
    console.log(`Executive Engine API running on ${port}`);
  });
});