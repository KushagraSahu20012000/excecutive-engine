import jwt from 'jsonwebtoken';
import { WebSocketServer } from 'ws';

const clientsByUser = new Map();

function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const [key, ...rest] = part.split('=');
      acc[key] = decodeURIComponent(rest.join('='));
      return acc;
    }, {});
}

function attachClient(userId, socket) {
  const key = String(userId);
  const set = clientsByUser.get(key) || new Set();
  set.add(socket);
  clientsByUser.set(key, set);
}

function detachClient(userId, socket) {
  const key = String(userId);
  const set = clientsByUser.get(key);
  if (!set) return;
  set.delete(socket);
  if (set.size === 0) clientsByUser.delete(key);
}

export function initRealtime(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    if (!request.url?.startsWith('/ws')) {
      socket.destroy();
      return;
    }

    const token = parseCookies(request.headers.cookie).ee_token;
    if (!token) {
      socket.destroy();
      return;
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      request.userId = String(payload.sub);
    } catch (_error) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.userId = request.userId;
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (socket) => {
    attachClient(socket.userId, socket);
    socket.send(JSON.stringify({ type: 'connected' }));

    socket.on('close', () => {
      detachClient(socket.userId, socket);
    });
  });
}

export function broadcastStatsChanged(userId) {
  const listeners = clientsByUser.get(String(userId));
  if (!listeners || listeners.size === 0) return;

  const message = JSON.stringify({ type: 'stats:changed' });
  listeners.forEach((socket) => {
    if (socket.readyState === 1) {
      socket.send(message);
    }
  });
}