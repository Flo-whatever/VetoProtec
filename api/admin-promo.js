import { redis } from './_kv.js';
import { normalizeCode } from './_promo.js';

function isAuthorized(req) {
  const password = req.headers['x-admin-password'];
  return Boolean(process.env.ADMIN_PASSWORD) && password === process.env.ADMIN_PASSWORD;
}

export default async function handler(req, res) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  try {
    if (req.method === 'GET') {
      const codes = await redis.smembers('promo:codes');
      const promos = await Promise.all(codes.map(async (code) => {
        const data = await redis.hgetall('promo:' + code);
        const kind = data.kind === 'bogo' ? 'bogo' : 'percent';
        const promo = {
          code,
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
      }));
      promos.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      return res.status(200).json({ promos });
    }

    if (req.method === 'POST') {
      const { code, kind, discountPercent, stock, bogoProduct, bogoBuyQty, bogoGetQty } = req.body || {};
      const normalized = normalizeCode(code);
      const promoKind = kind === 'bogo' ? 'bogo' : 'percent';

      if (!/^[A-Z0-9_-]{3,20}$/.test(normalized)) {
        return res.status(400).json({ error: 'Code invalide (3 à 20 caractères alphanumériques, - et _ autorisés)' });
      }
      const st = Number(stock);
      if (!Number.isInteger(st) || st <= 0) {
        return res.status(400).json({ error: 'Stock invalide (entier positif)' });
      }

      const record = {
        kind: promoKind,
        stock: st,
        stockTotal: st,
        active: true,
        createdAt: new Date().toISOString(),
      };

      if (promoKind === 'percent') {
        const pct = Number(discountPercent);
        if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
          return res.status(400).json({ error: 'Pourcentage de réduction invalide (1 à 100)' });
        }
        record.discountPercent = pct;
      } else {
        const validProducts = ['petholder', 'petanesth', 'all'];
        if (!validProducts.includes(bogoProduct)) {
          return res.status(400).json({ error: 'Produit invalide' });
        }
        const buyQty = Number(bogoBuyQty);
        const getQty = Number(bogoGetQty);
        if (!Number.isInteger(buyQty) || buyQty <= 0) {
          return res.status(400).json({ error: 'Quantité "achetés" invalide (entier positif)' });
        }
        if (!Number.isInteger(getQty) || getQty <= 0) {
          return res.status(400).json({ error: 'Quantité "offerts" invalide (entier positif)' });
        }
        record.bogoProduct = bogoProduct;
        record.bogoBuyQty = buyQty;
        record.bogoGetQty = getQty;
      }

      await redis.hset('promo:' + normalized, record);
      await redis.sadd('promo:codes', normalized);
      return res.status(200).json({ success: true });
    }

    if (req.method === 'PATCH') {
      const { code, active } = req.body || {};
      const normalized = normalizeCode(code);
      if (!normalized || typeof active !== 'boolean') {
        return res.status(400).json({ error: 'Champs manquants' });
      }
      const exists = await redis.sismember('promo:codes', normalized);
      if (!exists) return res.status(404).json({ error: 'Code introuvable' });

      await redis.hset('promo:' + normalized, { active });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    console.error('Admin promo error:', err);
    return res.status(500).json({ error: err.message });
  }
}
