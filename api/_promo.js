import { redis } from './_kv.js';

export function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

export async function getPromo(code) {
  const normalized = normalizeCode(code);
  if (!normalized) return null;

  const data = await redis.hgetall('promo:' + normalized);
  if (!data || data.discountPercent === undefined) return null;

  return {
    code: normalized,
    discountPercent: Number(data.discountPercent),
    stock: Number(data.stock),
    stockTotal: Number(data.stockTotal),
    active: data.active === true || data.active === 'true',
    createdAt: data.createdAt || '',
  };
}

export async function validatePromo(code) {
  const promo = await getPromo(code);
  if (!promo) return { valid: false, error: 'Code promo invalide.' };
  if (!promo.active) return { valid: false, error: "Cette promotion n'est plus active." };
  if (!(promo.stock > 0)) return { valid: false, error: 'Cette promotion est épuisée.' };
  return { valid: true, code: promo.code, discountPercent: promo.discountPercent };
}
