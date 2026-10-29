import pkg from '@mollie/api-client';
import { validatePromo, computeBogoDiscount } from './_promo.js';
import { computeShippingFee } from './_shipping.js';
const { createMollieClient } = pkg;
const mollie = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY });

const PRODUCTS = {
  petholder: { name: 'PetHolder (Bleu)', price: 55.00 },
  'petholder-rose': { name: 'PetHolder (Rose)', price: 55.00 },
  'petholder-vert': { name: 'PetHolder (Vert)', price: 55.00 },
  petanesth: { name: 'PetAnesth', price: 119.00 },
  'petanesth-legacy': { name: 'PetAnesth (ancien modele)', price: 59.00 },
  'petties-rose': { name: 'PetTies (Rose)', price: 20.00 },
  'petties-bleu': { name: 'PetTies (Bleu)', price: 20.00 },
  'petties-vert': { name: 'PetTies (Vert)', price: 20.00 },
};

// TVA française — appliquée uniquement pour une facturation en France sur
// les pages FR. Les pages EN ciblent une clientèle hors France (jamais de TVA).
const VAT_RATE = 0.20;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      items,
      customerEmail,
      customerName,
      billingAddress,
      shippingAddress,
      deliveryCountry,
      vatNumber,
      locale,
      promoCode,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' });
    }

    let total = 0;
    const description = items.map(({ productId, quantity }) => {
      const product = PRODUCTS[productId];
      if (!product) throw new Error(`Unknown product: ${productId}`);
      const qty = Number(quantity);
      if (!Number.isInteger(qty) || qty <= 0) {
        throw new Error(`Invalid quantity for ${productId}`);
      }
      total += product.price * qty;
      return `${product.name} x${qty}`;
    }).join(', ');

    // Frais de port calculés côté serveur à partir du pays de livraison —
    // on ne fait jamais confiance au montant envoyé par le navigateur.
    const shipping = computeShippingFee(deliveryCountry, total);
    if (shipping === null) {
      return res.status(400).json({ error: `Online ordering is not available for this destination: ${deliveryCountry || 'unknown'}` });
    }

    let discountAmount = 0;
    let appliedPromoCode = '';
    if (promoCode) {
      const promoResult = await validatePromo(promoCode);
      if (!promoResult.valid) {
        return res.status(400).json({ error: promoResult.error || 'Code promo invalide' });
      }
      if (promoResult.kind === 'bogo') {
        discountAmount = computeBogoDiscount(items, PRODUCTS, promoResult);
      } else {
        discountAmount = total * (promoResult.discountPercent / 100);
      }
      appliedPromoCode = promoResult.code;
    }

    const vatApplicable = locale === 'fr' && deliveryCountry === 'France';
    const vatAmount = vatApplicable ? (total - discountAmount + shipping) * VAT_RATE : 0;
    const grandTotal = total - discountAmount + shipping + vatAmount;

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.vetoprotec.fr';
    const localePrefix = locale === 'fr' ? '' : '/en';

    const payment = await mollie.payments.create({
      amount: {
        currency: 'EUR',
        value: grandTotal.toFixed(2),
      },
      description: `VetoProtec — ${description}${shipping > 0 ? ' + shipping' : ' (shipping incl.)'}${vatApplicable ? ' + VAT 20%' : ''}${appliedPromoCode ? ` | promo ${appliedPromoCode}` : ''}${customerName ? ` | ${customerName}` : ''}`,
      redirectUrl: `${baseUrl}${localePrefix}/confirmation.html`,
      cancelUrl: `${baseUrl}${localePrefix}/confirmation.html?status=cancelled`,
      webhookUrl: `${baseUrl}/api/webhook-mollie`,
      metadata: {
        customerEmail: customerEmail || '',
        customerName: customerName || '',
        billingAddress: billingAddress || '',
        shippingAddress: shippingAddress || '',
        vatNumber: vatNumber || '',
        shippingFee: shipping > 0 ? `${shipping.toFixed(2)} €` : 'included',
        vat: vatApplicable ? `${vatAmount.toFixed(2)} €` : 'N/A',
        items: JSON.stringify(items),
        promoCode: appliedPromoCode,
      },
    });

    return res.status(200).json({
      checkoutUrl: payment.getCheckoutUrl(),
      paymentId: payment.id,
    });

  } catch (err) {
    console.error('Mollie error:', err);
    return res.status(500).json({
      error: err.message || 'Payment creation failed',
    });
  }
}
