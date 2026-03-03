import { db } from '../app/lib/firebase-admin';

async function simulateWebhook(sessionId: string) {
  // Busca la orden por sessionId
  const orders = await db.collection('orders').where('whopSessionId', '==', sessionId).get();
  if (orders.empty) {
    console.error('No order found for sessionId:', sessionId);
    return;
  }
  for (const doc of orders.docs) {
    await doc.ref.update({
      status: 'paid',
      paymentId: 'simulated_payment_id',
      paidAt: new Date().toISOString(),
      paymentData: { simulated: true },
    });
    console.log('Order', doc.id, 'updated to paid!');
  }
}

// USO: node scripts/simulate-whop-webhook.js SESSION_ID
const sessionId = process.argv[2];
if (!sessionId) {
  console.error('Usage: node scripts/simulate-whop-webhook.js <sessionId>');
  process.exit(1);
}
simulateWebhook(sessionId).then(() => process.exit(0));
