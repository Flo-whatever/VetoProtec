import pkg from '@mollie/api-client';
const { createMollieClient } = pkg;

const mollie = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY });

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing payment id' });

  try {
    const payment = await mollie.payments.get(id);
    res.status(200).json({ status: payment.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
