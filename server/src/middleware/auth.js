import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

export function signAuthToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '14d' });
}

export function setAuthCookie(response, token) {
  response.cookie('ee_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 14 * 24 * 60 * 60 * 1000
  });
}

export async function requireAuth(request, response, next) {
  try {
    const token = request.cookies.ee_token;

    if (!token) {
      return response.status(401).json({ message: 'Authentication required' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);

    if (!user) {
      return response.status(401).json({ message: 'Authentication required' });
    }

    request.user = user;
    next();
  } catch (error) {
    response.status(401).json({ message: 'Authentication required' });
  }
}