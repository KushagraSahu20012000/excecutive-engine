import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { PushSubscription } from '../models/PushSubscription.js';
import { getVapidPublicKey, isPushConfigured } from '../utils/webpush.js';

const router = express.Router();

// Public key is needed by the client before it can subscribe.
router.get('/public-key', (_request, response) => {
  response.json({ publicKey: getVapidPublicKey(), enabled: isPushConfigured() });
});

router.use(requireAuth);

router.post('/subscription', async (request, response) => {
  const { endpoint, keys, platform } = request.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return response.status(400).json({ message: 'Invalid subscription' });
  }

  const subscription = await PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      userId: request.user._id,
      endpoint,
      keys: { p256dh: keys.p256dh, auth: keys.auth },
      platform: platform || 'web'
    },
    { new: true, upsert: true }
  );

  response.status(201).json({ subscription: { _id: subscription._id, endpoint: subscription.endpoint } });
});

router.delete('/subscription', async (request, response) => {
  const { endpoint } = request.body || {};
  if (endpoint) {
    await PushSubscription.deleteOne({ endpoint, userId: request.user._id });
  }
  response.json({ ok: true });
});

export default router;
