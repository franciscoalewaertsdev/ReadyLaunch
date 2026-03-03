import { db } from '@/app/lib/firebase-admin';

export async function POST(req: Request) {
  const body = await req.json();
  if (body.type === 'payment.succeeded') {
    const sessionId = body.data.checkout_configuration_id || body.data.checkoutConfigurationId;
    if (!sessionId) return new Response('Missing sessionId', { status: 400 });
    // Busca la orden por sessionId y actualiza
    const orders = await db.collection('orders').where('whopSessionId', '==', sessionId).get();
    if (orders.empty) return new Response('Order not found', { status: 404 });
    for (const doc of orders.docs) {
      await doc.ref.update({
        status: 'paid',
        paymentId: body.data.id,
        paidAt: new Date().toISOString(),
        paymentData: body.data,
      });
    }
  }
  return new Response('OK');
}
