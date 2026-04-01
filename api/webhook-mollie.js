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
    console.error('Missing or invalid payment id in webhook body:', req.body);
    return res.status(400).end();
  }

  if (processedPayments.has(id)) {
    console.log(`Payment ${id} already processed — skipping`);
    return res.status(200).end();
  }

  try {
    const payment = await mollie.payments.get(id);

    if (!payment || payment.status !== 'paid') {
      console.log(`Payment ${id} status: ${payment?.status ?? 'unknown'} — no emails sent`);
      return res.status(200).end();
    }

    const refundedAmount = parseFloat(payment.amountRefunded?.value || '0');
    if (refundedAmount > 0) {
      console.log(`Payment ${id} already refunded/partially refunded (${refundedAmount}) — no emails sent`);
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

    const itemsHtml = items
      .map(({ productId, quantity }) => {
        const product = PRODUCTS[productId] || { name: productId, price: 0 };
        const qty = Number(quantity) || 0;
        const lineTotal = (product.price * qty).toFixed(2);

        return `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f0e0ee">${escapeHtml(product.name)}</td>
            <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;text-align:center">${escapeHtml(qty)}</td>
            <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;text-align:right">${lineTotal} €</td>
          </tr>`;
      })
      .join('');

    const itemsSummary = items
      .map(({ productId, quantity }) => {
        const product = PRODUCTS[productId] || { name: productId };
        const qty = Number(quantity) || 0;
        return `${product.name} x${qty}`;
      })
      .join(', ');

    if (customerEmail) {
      await sendEmail({
        from: 'VetoProtec <contact@vetoprotec.fr>',
        to: [customerEmail],
        reply_to: 'contact@vetoprotec.fr',
        subject: 'Order confirmed — VetoProtec',
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <h2 style="color:#c084c8;margin:0 0 8px">Order confirmed ✅</h2>
            <p style="color:#6b7280;margin:0 0 24px">
              Thank you for your order, ${escapeHtml(customerName)}.
              We will get back to you shortly with shipping details.
            </p>

            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="background:#fdf4ff">
                  <th style="padding:10px;text-align:left;color:#8a6a7a;font-weight:600">Product</th>
                  <th style="padding:10px;text-align:center;color:#8a6a7a;font-weight:600">Qty</th>
                  <th style="padding:10px;text-align:right;color:#8a6a7a;font-weight:600">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2" style="padding:12px 0;font-weight:700;font-size:16px">Total paid</td>
                  <td style="padding:12px 0;font-weight:700;font-size:16px;text-align:right">${escapeHtml(amount)}</td>
                </tr>
              </tfoot>
            </table>

            <p style="margin:24px 0 8px;color:#6b7280;font-size:14px">
              Questions? Reply to this email or contact us at
              <a href="mailto:contact@vetoprotec.fr">contact@vetoprotec.fr</a>
            </p>

            <p style="margin:0;font-size:12px;color:#b0a0b0">
              VetoProtec — vetoprotec.fr
            </p>
          </div>
        `,
      });
    } else {
      console.warn(`Payment ${id}: no customerEmail found, skipping customer email`);
    }

    await sendEmail({
      from: 'VetoProtec Orders <contact@vetoprotec.fr>',
      to: ['drderrien@vetoprotec.fr'],
      reply_to: customerEmail || 'contact@vetoprotec.fr',
      subject: `🛒 New order — ${itemsSummary || 'Order received'}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h2 style="color:#c084c8;margin:0 0 20px">New order received 🛒</h2>

          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;font-weight:600;width:140px;color:#8a6a7a">Customer</td>
              <td style="padding:10px 0;border-bottom:1px solid #f0e0ee">${escapeHtml(customerName)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;font-weight:600;color:#8a6a7a">Email</td>
              <td style="padding:10px 0;border-bottom:1px solid #f0e0ee">
                ${
                  customerEmail
                    ? `<a href="mailto:${escapeHtml(customerEmail)}">${escapeHtml(customerEmail)}</a>`
                    : 'Not provided'
                }
              </td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;font-weight:600;color:#8a6a7a">Order</td>
              <td style="padding:10px 0;border-bottom:1px solid #f0e0ee">${escapeHtml(itemsSummary || 'No items')}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;font-weight:600;color:#8a6a7a">Amount paid</td>
              <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;font-weight:700;color:#166534">${escapeHtml(amount)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;font-weight:600;color:#8a6a7a">Shipping</td>
              <td style="padding:10px 0;border-bottom:1px solid #f0e0ee">${escapeHtml(shippingFee)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;font-weight:600;color:#8a6a7a">Billing address</td>
              <td style="padding:10px 0;border-bottom:1px solid #f0e0ee">${escapeHtml(billingAddress)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;font-weight:600;color:#8a6a7a">Shipping address</td>
              <td style="padding:10px 0;border-bottom:1px solid #f0e0ee">${escapeHtml(shippingAddress)}</td>
            </tr>
            ${
              vatNumber
                ? `
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;font-weight:600;color:#8a6a7a">VAT number</td>
              <td style="padding:10px 0;border-bottom:1px solid #f0e0ee">${escapeHtml(vatNumber)}</td>
            </tr>`
                : ''
            }
            <tr>
              <td style="padding:10px 0;font-weight:600;color:#8a6a7a">Date</td>
              <td style="padding:10px 0">${escapeHtml(date)}</td>
            </tr>
          </table>

          <p style="margin:24px 0 0;font-size:12px;color:#b0a0b0">
            Répondre à cet email contacte directement le client.
          </p>
        </div>
      `,
    });

    processedPayments.add(id);

    console.log(`Payment ${id} paid — emails processed successfully`);
    return res.status(200).end();
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).end();
  }
}
