import bcrypt from 'bcryptjs';
import express from 'express';
import { authCookieOptions, requireAuth, setAuthCookie, signAuthToken } from '../middleware/auth.js';
import { Setting } from '../models/Setting.js';
import { User } from '../models/User.js';

const router = express.Router();

function parseAuthPayload(request) {
  if (typeof request.body === 'string') {
    try {
      return JSON.parse(request.body);
    } catch {
      return {};
    }
  }
  return request.body || {};
}

function presentUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl
  };
}

router.post('/register', async (request, response) => {
  const body = parseAuthPayload(request);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const displayName = String(body.displayName || '').trim();

  if (!email || !password || !displayName) {
    return response.status(400).json({ message: 'displayName, email, and password are required' });
  }

  if (password.length < 6) {
    return response.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  const existing = await User.findOne({ email });
  if (existing) {
    return response.status(409).json({ message: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ email, displayName, passwordHash, authProvider: 'local' });

  await Setting.findOneAndUpdate(
    { userId: user._id },
    { $setOnInsert: { userId: user._id } },
    { upsert: true, new: true }
  );

  const token = signAuthToken(user);
  setAuthCookie(response, token);
  response.status(201).json({ user: presentUser(user) });
});

router.post('/login', async (request, response) => {
  const body = parseAuthPayload(request);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!email || !password) {
    return response.status(400).json({ message: 'email and password are required' });
  }

  const user = await User.findOne({ email });
  if (!user || !user.passwordHash) {
    return response.status(401).json({ message: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return response.status(401).json({ message: 'Invalid email or password' });
  }

  const token = signAuthToken(user);
  setAuthCookie(response, token);
  response.json({ user: presentUser(user) });
});

router.get('/me', requireAuth, (request, response) => {
  response.json({ user: presentUser(request.user) });
});

router.post('/logout', (_request, response) => {
  response.clearCookie('ee_token', authCookieOptions());
  response.json({ ok: true });
});

export default router;