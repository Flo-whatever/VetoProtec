import { redis } from './_kv.js';

export function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

export async function getPromo(code) {
  const normalized = normalizeCode(code);
  if (!normalized) return null;

  const data = await redis.hgetall('promo:' + normalized);
  // createdAt est toujours présent (percent comme bogo) — sert de test
  // d'existence indépendant du type, contrairement à discountPercent qui
  // n'existe que pour les codes de type "percent".
  if (!data || data.createdAt === undefined) return null;

  // Les codes créés avant l'ajout du type "bogo" n'ont pas de champ kind —
  // ils sont tous des réductions en %.
  const kind = data.kind === 'bogo' ? 'bogo' : 'percent';

  const promo = {
    code: normalized,
    kind,
    stock: Number(data.stock),
    stockTotal: Number(data.stockTotal),
    active: data.active === true || data.active === 'true',
    createdAt: data.createdAt || '',
  };

  if (kind === 'percent') {
    promo.discountPercent = Number(data.discountPercent);
  } else {
    promo.bogoProduct = data.bogoProduct || 'all';
    promo.bogoBuyQty = Number(data.bogoBuyQty);
    promo.bogoGetQty = Number(data.bogoGetQty);
  }

  return promo;
}

export async function validatePromo(code) {
  const promo = await getPromo(code);
  if (!promo) return { valid: false, error: 'Code promo invalide.' };
  if (!promo.active) return { valid: false, error: "Cette promotion n'est plus active." };
  if (!(promo.stock > 0)) return { valid: false, error: 'Cette promotion est épuisée.' };

  if (promo.kind === 'bogo') {
    return {
      valid: true,
      code: promo.code,
      kind: 'bogo',
      bogoProduct: promo.bogoProduct,
      bogoBuyQty: promo.bogoBuyQty,
      bogoGetQty: promo.bogoGetQty,
    };
  }
  return { valid: true, code: promo.code, kind: 'percent', discountPercent: promo.discountPercent };
}

// Calcule la réduction "X achetés, Y offerts" pour un panier donné.
// Pour chaque groupe complet de (buyQty + getQty) unités d'un produit
// concerné, seules buyQty sont payées — le reste (getQty, ou le reliquat
// partiel au-delà de buyQty) est offert.
//   items: [{ productId, quantity }]
//   products: { [productId]: { price } }
//   promo: { bogoProduct: 'all'|productId, bogoBuyQty, bogoGetQty }
export function computeBogoDiscount(items, products, promo) {
  const groupSize = promo.bogoBuyQty + promo.bogoGetQty;
  if (!(groupSize > 0)) return 0;

  let discount = 0;
  for (const { productId, quantity } of items || []) {
    if (promo.bogoProduct !== 'all' && promo.bogoProduct !== productId) continue;
    const product = products[productId];
    if (!product) continue;

    const qty = Number(quantity) || 0;
    const fullGroups = Math.floor(qty / groupSize);
    const remainder = qty % groupSize;
    const payableQty = fullGroups * promo.bogoBuyQty + Math.min(remainder, promo.bogoBuyQty);
    const freeQty = qty - payableQty;
    discount += freeQty * product.price;
  }
  return discount;
}
