import pkg from '@mollie/api-client';
const { createMollieClient } = pkg;

const mollie = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY });

const processedPayments = new Set();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { id } = req.body;
    if (!id) return res.status(400).end();

    // Répondre 200 immédiatement — stoppe les retries Mollie
    res.status(200).end();

    // Skip si déjà traité
    if (processedPayments.has(id)) {
      console.log(`Payment ${id} already processed — skipping`);
      return;
    }

    // Marquer immédiatement avant tout traitement
    processedPayments.add(id);

    const payment = await mollie.payments.get(id);

    if (payment.status === 'paid') {
      const meta = payment.metadata || {};
      const customerName    = meta.customerName    || 'Client';
      const customerEmail   = meta.customerEmail   || '';
      const shippingAddress = meta.shippingAddress || 'Not provided';
      const items           = JSON.parse(meta.items || '[]');
      const amount          = `${payment.amount.value} ${payment.amount.currency}`;
      const date            = new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });

      const PRODUCTS = {
        petholder: { name: 'PetHolder', price: 55.00 },
        petanesth: { name: 'PetAnesth', price: 115.00 },
      };

      const itemsHtml = items.map(({ productId, quantity }) => {
        const p = PRODUCTS[productId] || { name: productId, price: 0 };
        return `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f0e0ee">${p.name}</td>
            <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;text-align:center">${quantity}</td>
            <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;text-align:right">${(p.price * quantity).toFixed(2)} €</td>
          </tr>`;
      }).join('');

      const itemsSummary = items.map(({ productId, quantity }) => {
        const p = PRODUCTS[productId] || { name: productId, price: 0 };
        return `${p.name} x${quantity}`;
      }).join(', ');

      // ── Email au client ──
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'VetoProtec <contact@vetoprotec.fr>',
          to: [customerEmail],
          reply_to: 'contact@vetoprotec.fr',
          subject: 'Order confirmed — VetoProtec',
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
              <h2 style="color:#c084c8;margin:0 0 8px">Order confirmed ✅</h2>
              <p style="color:#6b7280;margin:0 0 24px">Thank you for your order, ${customerName}. We will get back to you shortly with shipping details.</p>
              <table style="width:100%;border-collapse:collapse">
                <thead>
                  <tr style="background:#fdf4ff">
                    <th style="padding:10px;text-align:left;color:#8a6a7a;font-weight:600">Product</th>
                    <th style="padding:10px;text-align:center;color:#8a6a7a;font-weight:600">Qty</th>
                    <th style="padding:10px;text-align:right;color:#8a6a7a;font-weight:600">Subtotal</th>
                  </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
                <tfoot>
                  <tr>
                    <td colspan="2" style="padding:12px 0;font-weight:700;font-size:16px">Total paid</td>
                    <td style="padding:12px 0;font-weight:700;font-size:16px;text-align:right">${amount}</td>
                  </tr>
                </tfoot>
              </table>
              <p style="margin:24px 0 8px;color:#6b7280;font-size:14px">Questions? Reply to this email or contact us at <a href="mailto:contact@vetoprotec.fr">contact@vetoprotec.fr</a></p>
              <p style="margin:0;font-size:12px;color:#b0a0b0">VetoProtec — vetoprotec.fr</p>
            </div>
          `,
        }),
      });

      // ── Email à VetoProtec ──
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'VetoProtec Orders <contact@vetoprotec.fr>',
          to: ['drderrien@vetoprotec.fr'],
          reply_to: customerEmail,
          subject: `🛒 New order — ${itemsSummary}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
              <h2 style="color:#c084c8;margin:0 0 20px">New order received 🛒</h2>
              <table style="width:100%;border-collapse:collapse">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;font-weight:600;width:140px;color:#8a6a7a">Customer</td>
                  <td style="padding:10px 0;border-bottom:1px solid #f0e0ee">${customerName}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;font-weight:600;color:#8a6a7a">Email</td>
                  <td style="padding:10px 0;border-bottom:1px solid #f0e0ee"><a href="mailto:${customerEmail}">${customerEmail}</a></td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;font-weight:600;color:#8a6a7a">Order</td>
                  <td style="padding:10px 0;border-bottom:1px solid #f0e0ee">${itemsSummary}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;font-weight:600;color:#8a6a7a">Amount paid</td>
                  <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;font-weight:700;color:#166534">${amount}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;font-weight:600;color:#8a6a7a">Shipping address</td>
                  <td style="padding:10px 0;border-bottom:1px solid #f0e0ee">${shippingAddress}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;font-weight:600;color:#8a6a7a">Date</td>
                  <td style="padding:10px 0">${date}</td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:12px;color:#b0a0b0">
                Répondre à cet email contacte directement le client.
              </p>
            </div>
          `,
        }),
      });

      console.log(`Payment ${id} paid — emails sent to ${customerEmail} and drderrien@vetoprotec.fr`);
    } else {
      console.log(`Payment ${id} status: ${payment.status} — no emails sent`);
    }

  } catch (err) {
    console.error('Webhook error:', err);
  }
}
