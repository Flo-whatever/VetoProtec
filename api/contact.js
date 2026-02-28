export default async function handler(req, res) {
  // On n'accepte que les requêtes POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const { nom, email, message } = req.body;

  // Validation basique
  if (!nom || !email || !message) {
    return res.status(400).json({ error: "Tous les champs sont obligatoires." });
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "VetoProtec Contact <contact@vetoprotec.fr>", // ← ton domaine vérifié dans Resend
        to: ["drderrien@vetoprotec.fr"],                          // ← l'adresse où tu veux recevoir
        reply_to: email,                                    // ← le visiteur reçoit ta réponse directement
        subject: `Nouveau message de ${nom}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <h2 style="color:#c084c8;margin:0 0 20px">Nouveau message — VetoProtec</h2>
            <table style="width:100%;border-collapse:collapse">
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;font-weight:600;width:140px;color:#8a6a7a">Nom / Structure</td>
                <td style="padding:10px 0;border-bottom:1px solid #f0e0ee">${nom}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #f0e0ee;font-weight:600;color:#8a6a7a">Email</td>
                <td style="padding:10px 0;border-bottom:1px solid #f0e0ee"><a href="mailto:${email}">${email}</a></td>
              </tr>
              <tr>
                <td style="padding:10px 14px 10px 0;font-weight:600;vertical-align:top;color:#8a6a7a">Message</td>
                <td style="padding:10px 0;white-space:pre-line">${message}</td>
              </tr>
            </table>
            <p style="margin:24px 0 0;font-size:12px;color:#b0a0b0">
              Envoyé depuis le formulaire vetoprotec.fr • Répondre directement à cet email contacte ${nom}.
            </p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Resend error:", error);
      return res.status(500).json({ error: "Erreur lors de l'envoi. Réessaie plus tard." });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: "Erreur serveur." });
  }
}

