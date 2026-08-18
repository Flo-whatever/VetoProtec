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
    // bogoBuyProduct/bogoGetProduct sont les noms actuels. On retombe sur
    // l'ancien champ bogoProduct pour les tout premiers codes bogo créés
    // avant l'ajout du "produit offert différent".
    promo.bogoBuyProduct = data.bogoBuyProduct || data.bogoProduct || 'all';
    promo.bogoGetProduct = data.bogoGetProduct || 'same';
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
      bogoBuyProduct: promo.bogoBuyProduct,
      bogoGetProduct: promo.bogoGetProduct,
      bogoBuyQty: promo.bogoBuyQty,
      bogoGetQty: promo.bogoGetQty,
    };
  }
  return { valid: true, code: promo.code, kind: 'percent', discountPercent: promo.discountPercent };
}

// Calcule la réduction "X achetés, Y offerts" pour un panier donné.
//   items: [{ productId, quantity }]
//   products: { [productId]: { price } }
//   promo: { bogoBuyProduct: 'all'|productId, bogoGetProduct: 'same'|productId, bogoBuyQty, bogoGetQty }
//
// Deux modes :
//   - "même produit" (bogoGetProduct === 'same') : pour chaque groupe complet
//     de (buyQty + getQty) unités d'un produit concerné, seules buyQty sont
//     payées. Calcul indépendant par ligne du panier (et par produit si
//     bogoBuyProduct === 'all').
//   - "produit croisé" (bogoGetProduct === autre produit) : chaque groupe de
//     buyQty unités du produit acheté offre getQty unités du produit offert,
//     plafonné par la quantité de ce dernier réellement présente au panier
//     (impossible d'offrir plus d'unités que le client n'en a mises).
export function computeBogoDiscount(items, products, promo) {
  const groupSize = promo.bogoBuyQty + promo.bogoGetQty;
  if (!(groupSize > 0)) return 0;

  if (promo.bogoGetProduct && promo.bogoGetProduct !== 'same') {
    const buyLine = (items || []).find(i => i.productId === promo.bogoBuyProduct);
    const getLine = (items || []).find(i => i.productId === promo.bogoGetProduct);
    const getProductInfo = products[promo.bogoGetProduct];
    if (!buyLine || !getLine || !getProductInfo) return 0;

    const buyQtyInCart = Number(buyLine.quantity) || 0;
    const getQtyInCart = Number(getLine.quantity) || 0;
    if (buyQtyInCart <= 0 || getQtyInCart <= 0) return 0;

    const groups = Math.floor(buyQtyInCart / promo.bogoBuyQty);
    const freeEligible = groups * promo.bogoGetQty;
    const freeActual = Math.min(freeEligible, getQtyInCart);
    return freeActual * getProductInfo.price;
  }

  let discount = 0;
  for (const { productId, quantity } of items || []) {
    if (promo.bogoBuyProduct !== 'all' && promo.bogoBuyProduct !== productId) continue;
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
