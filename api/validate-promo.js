import { validatePromo } from './_promo.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ valid: false, error: 'Method not allowed' });
  }

  const { code } = req.body || {};
  if (!code) {
    return res.status(400).json({ valid: false, error: 'Code manquant' });
  }

  try {
    const result = await validatePromo(code);
    return res.status(200).json(result);
  } catch (err) {
    console.error('Validate promo error:', err);
    return res.status(500).json({ valid: false, error: 'Erreur serveur' });
  }
}
