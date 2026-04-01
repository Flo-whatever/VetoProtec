import pkg from '@mollie/api-client';
const { createMollieClient } = pkg;

const mollie = createMollieClient({
  apiKey: process.env.MOLLIE_API_KEY,
});

const processedPayments = new Set();

const PRODUCTS = {
  petholder: { name: 'PetHolder', price: 55.0 },
  petanesth: { name: 'PetAnesth', price: 119.0 },
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeParseItems(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Invalid metadata.items JSON:', raw);
    return [];
  }
}

async function sendEmail(payload) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend failed (${response.status}): ${text}`);
  }

  return response.json().catch(() => null);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const id = req.body?.id;
  if (!id || typeof id !== 'string') {
    console.error('Missing or invalid payment id:', req.body);
    return res.status(400).end();
  }

  // éviter double traitement
  if (processedPayments.has(id)) {
    console.log(`Payment ${id} already processed — skipping`);
    return res.status(200).end();
  }

  try {
    const payment = await mollie.payments.get(id);

    if (!payment || payment.status !== 'paid') {
      console.log(`Payment ${id} status: ${payment?.status}`);
      return res.status(200).end();
    }

    const refundedAmount = parseFloat(payment.amountRefunded?.value || '0');
    if (refundedAmount > 0) {
      console.log(`Payment ${id} refunded — skipping`);
      return res.status(200).end();
    }

    const meta = payment.metadata || {};

    const customerName = meta.customerName || 'Client';
    const customerEmail = meta.customerEmail || '';
    const billingAddress = meta.billingAddress || 'Not provided';
    const shippingAddress = meta.shippingAddress || billingAddress;
    const vatNumber = meta.vatNumber || '';
    const shippingFee = meta.shippingFee || 'included';

    const items = safeParseItems(meta.items);
    const amount = `${payment.amount.value} ${payment.amount.currency}`;

    const date = new Date().toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const itemsHtml = items.map(({ productId, quantity }) => {
      const product = PRODUCTS[productId] || { name: productId, price: 0 };
      const qty = Number(quantity) || 0;
      const lineTotal = (product.price * qty).toFixed(2);

      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f0e0ee">${escapeHtml(product.name)}</td>
          <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;text-align:center">${qty}</td>
          <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;text-align:right">${lineTotal} €</td>
        </tr>`;
    }).join('');

    const itemsSummary = items.map(({ productId, quantity }) => {
      const product = PRODUCTS[productId] || { name: productId };
      return `${product.name} x${quantity}`;
    }).join(', ');

    // ── Email client ──
    if (customerEmail) {
      await sendEmail({
        from: 'VetoProtec <contact@vetoprotec.fr>',
        to: [customerEmail],
        reply_to: 'contact@vetoprotec.fr',
        subject: 'Order confirmed — VetoProtec',
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <h2 style="color:#c084c8">Order confirmed ✅</h2>
            <p>Thank you ${escapeHtml(customerName)}, your order is confirmed.</p>

            <table style="width:100%;border-collapse:collapse">
              <tbody>${itemsHtml}</tbody>
              <tfoot>
                <tr>
                  <td colspan="2"><strong>Total</strong></td>
                  <td style="text-align:right">${escapeHtml(amount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        `,
      });
    }

    // ── Email admin ──
    await sendEmail({
      from: 'VetoProtec Orders <contact@vetoprotec.fr>',
      to: ['drderrien@vetoprotec.fr'],
      reply_to: customerEmail || 'contact@vetoprotec.fr',
      subject: `🛒 New order — ${itemsSummary}`,
      html: `
        <div style="font-family:sans-serif;padding:24px">
          <h2>New order 🛒</h2>
          <p><strong>Customer:</strong> ${escapeHtml(customerName)}</p>
          <p><strong>Email:</strong> ${escapeHtml(customerEmail)}</p>
          <p><strong>Order:</strong> ${escapeHtml(itemsSummary)}</p>
          <p><strong>Total:</strong> ${escapeHtml(amount)}</p>
          <p><strong>Shipping:</strong> ${escapeHtml(shippingFee)}</p>
          <p><strong>Billing:</strong> ${escapeHtml(billingAddress)}</p>
          <p><strong>Shipping address:</strong> ${escapeHtml(shippingAddress)}</p>
          ${vatNumber ? `<p><strong>VAT:</strong> ${escapeHtml(vatNumber)}</p>` : ''}
          <p><strong>Date:</strong> ${escapeHtml(date)}</p>
        </div>
      `,
    });

    // ✅ marquer comme traité seulement à la fin
    processedPayments.add(id);

    console.log(`Payment ${id} processed successfully`);
    return res.status(200).end();

  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).end();
  }
}
