import webpush from 'web-push';
import { PushSubscription } from '../models/PushSubscription.js';

let configured = false;

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || '';
}

export function isPushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function ensureConfigured() {
  if (configured) return true;
  if (!isPushConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:alarms@executive.engine',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  configured = true;
  return true;
}

/**
 * Sends a push payload to every subscription registered for a user.
 * Subscriptions that are gone (404/410) are pruned automatically.
 */
export async function sendPushToUser(userId, payload) {
  if (!ensureConfigured()) return { sent: 0, removed: 0 };

  const subscriptions = await PushSubscription.find({ userId });
  if (subscriptions.length === 0) return { sent: 0, removed: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  let removed = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: subscription.keys },
          body
        );
        sent += 1;
      } catch (error) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: subscription._id });
          removed += 1;
        } else {
          console.error('Push send failed', error?.statusCode || error?.message || error);
        }
      }
    })
  );

  return { sent, removed };
}
