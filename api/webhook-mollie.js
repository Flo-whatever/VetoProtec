import createMollieClient from '@mollie/api-client';

const mollie = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { id } = req.body;
    if (!id) return res.status(400).end();

    const payment = await mollie.payments.get(id);

    console.log(`Payment ${id} status: ${payment.status}`);

    // Handle payment status
    switch (payment.status) {
      case 'paid':
        // TODO: send confirmation email, update your records
        console.log('Payment paid:', payment.metadata);
        break;
      case 'failed':
      case 'canceled':
      case 'expired':
        console.log(`Payment ${payment.status}:`, id);
        break;
    }

    res.status(200).end();
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).end();
  }
}
