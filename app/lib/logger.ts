import { db } from './firebase-admin';

export async function logEvent(event: any) {
  try {
    await db.collection('events').add({
      ...event,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Logger] failed to write event to Firestore', err);
  }
}
