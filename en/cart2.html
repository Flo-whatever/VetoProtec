export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { customerName, customerEmail, customerPhone, billingAddress, shippingAddress, vatNumber, items, country } = req.body;

    const PRODUCTS = {
      petholder: { name: 'PetHolder', price: 55.00 },
      petanesth: { name: 'PetAnesth', price: 119.00 },
    };

    const itemsSummary = items.map(({ productId, quantity }) => {
      const p = PRODUCTS[productId] || { name: productId, price: 0 };
      return `${p.name} x${quantity} (${(p.price * quantity).toFixed(2)} €)`;
    }).join(', ');

    const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

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
        subject: `📦 Custom shipping request — ${itemsSummary}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <h2 style="color:#c084c8;margin:0 0 8px">Custom shipping request 📦</h2>
            <p style="color:#6b7280;margin:0 0 20px;font-size:14px">This customer is located outside standard shipping zones — a custom quote is needed.</p>
            <table style="width:100%;border-collapse:collapse">
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;font-weight:600;width:160px;color:#8a6a7a">Customer</td>
                <td style="padding:10px 0;border-bottom:1px solid #f0e0ee">${customerName}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;font-weight:600;color:#8a6a7a">Email</td>
                <td style="padding:10px 0;border-bottom:1px solid #f0e0ee"><a href="mailto:${customerEmail}">${customerEmail}</a></td>
              </tr>
              ${customerPhone ? `<tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;font-weight:600;color:#8a6a7a">Phone</td>
                <td style="padding:10px 0;border-bottom:1px solid #f0e0ee">${customerPhone}</td>
              </tr>` : ''}
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;font-weight:600;color:#8a6a7a">Order</td>
                <td style="padding:10px 0;border-bottom:1px solid #f0e0ee">${itemsSummary}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;font-weight:600;color:#8a6a7a">Billing address</td>
                <td style="padding:10px 0;border-bottom:1px solid #f0e0ee">${billingAddress}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;font-weight:600;color:#8a6a7a">Shipping address</td>
                <td style="padding:10px 0;border-bottom:1px solid #f0e0ee">${shippingAddress}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;font-weight:600;color:#8a6a7a">Destination country</td>
                <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;font-weight:700;color:#c084c8">${country}</td>
              </tr>
              ${vatNumber ? `<tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;font-weight:600;color:#8a6a7a">VAT number</td>
                <td style="padding:10px 0;border-bottom:1px solid #f0e0ee">${vatNumber}</td>
              </tr>` : ''}
              <tr>
                <td style="padding:10px 0;font-weight:600;color:#8a6a7a">Date</td>
                <td style="padding:10px 0">${date}</td>
              </tr>
            </table>
            <p style="margin:24px 0 0;font-size:12px;color:#b0a0b0">Répondre à cet email contacte directement le client.</p>
          </div>
        `,
      }),
    });

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
        subject: 'Your order request — VetoProtec',
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <h2 style="color:#c084c8;margin:0 0 8px">Request received ✅</h2>
            <p style="color:#6b7280;margin:0 0 24px">Thank you, ${customerName}! We have received your order request and will get back to you shortly with a custom shipping quote for your region.</p>
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="background:#fdf4ff">
                  <th style="padding:10px;text-align:left;color:#8a6a7a;font-weight:600">Product</th>
                  <th style="padding:10px;text-align:right;color:#8a6a7a;font-weight:600">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(({ productId, quantity }) => {
                  const p = PRODUCTS[productId] || { name: productId, price: 0 };
                  return `<tr>
                    <td style="padding:10px 0;border-bottom:1px solid #f0e0ee">${p.name} x${quantity}</td>
                    <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;text-align:right">${(p.price * quantity).toFixed(2)} €</td>
                  </tr>`;
                }).join('')}
              </tbody>
              <tfoot>
                <tr>
                  <td style="padding:12px 0;font-weight:700;font-size:16px">Products total</td>
                  <td style="padding:12px 0;font-weight:700;font-size:16px;text-align:right">${items.reduce((t, { productId, quantity }) => t + (PRODUCTS[productId]?.price || 0) * quantity, 0).toFixed(2)} €</td>
                </tr>
              </tfoot>
            </table>
            <p style="margin:20px 0 8px;padding:12px 16px;background:#fdf4ff;border-radius:10px;font-size:14px;color:#6b7280">
              + Shipping costs will be confirmed separately based on your location.
            </p>
            <p style="margin:24px 0 8px;color:#6b7280;font-size:14px">Questions? Reply to this email or contact us at <a href="mailto:contact@vetoprotec.fr">contact@vetoprotec.fr</a></p>
            <p style="margin:0;font-size:12px;color:#b0a0b0">VetoProtec — vetoprotec.fr</p>
          </div>
        `,
      }),
    });

    res.status(200).json({ success: true });

  } catch (err) {
    console.error('Contact order error:', err);
    res.status(500).json({ error: err.message });
  }
}
