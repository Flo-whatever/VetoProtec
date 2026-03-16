import pkg from '@mollie/api-client';
const { createMollieClient } = pkg;

const mollie = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY });

const PRODUCTS = {
  petholder: { name: 'PetHolder', price: '55.00' },
  petanesth: { name: 'PetAnesth', price: '115.00' },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { items, customerEmail, customerName } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' });
    }

    let total = 0;
    const description = items.map(({ productId, quantity }) => {
      const product = PRODUCTS[productId];
      if (!product) throw new Error(`Unknown product: ${productId}`);
      total += parseFloat(product.price) * quantity;
      return `${product.name} x${quantity}`;
    }).join(', ');

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.vetoprotec.fr';

    const payment = await mollie.payments.create({
      amount: { currency: 'EUR', value: total.toFixed(2) },
      description: `VetoProtec — ${description}`,
      redirectUrl: `${baseUrl}/en/confirmation.html`,
      cancelUrl:   `${baseUrl}/en/confirmation.html?status=cancelled`,
      webhookUrl:  `${baseUrl}/api/webhook-mollie`,
      metadata: {
        customerEmail,
        customerName,
        items: JSON.stringify(items),
      },
    });

    res.status(200).json({
      checkoutUrl: payment.getCheckoutUrl(),
      paymentId: payment.id,
    });

  } catch (err) {
    console.error('Mollie error:', err);
    res.status(500).json({ error: err.message || 'Payment creation failed' });
  }
}
