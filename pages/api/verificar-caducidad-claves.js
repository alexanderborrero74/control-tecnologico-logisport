// pages/api/verificar-caducidad-claves.js
import { getFirestore } from "@/lib/admin";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
});

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  try {
    const db = getFirestore();
    const snap = await db.collection("usuariosCatalogo").get();
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const resultados = [];

    for (const docSnap of snap.docs) {
      const u = docSnap.data();
      if (!u.email || !u.fechaCaducidadClave || u.activo === false) continue;

      const fechaVence = new Date(u.fechaCaducidadClave); fechaVence.setHours(0, 0, 0, 0);
      const diffDias = Math.round((fechaVence - hoy) / (1000 * 60 * 60 * 24));
      if (diffDias !== 7 && diffDias !== 3 && diffDias > 0) continue;

      const asunto = diffDias <= 0
        ? "🔐 Cambio de contraseña obligatorio — LOGISPORT"
        : `⏰ Tu contraseña vence en ${diffDias} días — LOGISPORT`;

      const cuerpo = diffDias <= 0
        ? [`Hola ${u.nombre || u.email},`, ``, `Tu contraseña ha vencido. Debes cambiarla para continuar usando la aplicación.`, ``, `Ingresa en: https://ti-logisport.vercel.app`, ``, `LOGISPORT — Área de Sistemas`].join("\n")
        : [`Hola ${u.nombre || u.email},`, ``, `Tu contraseña vencerá en ${diffDias} día${diffDias === 1 ? "" : "s"} (${fechaVence.toLocaleDateString("es-CO")}).`, ``, `Te recomendamos cambiarla en: https://ti-logisport.vercel.app`, ``, `LOGISPORT — Área de Sistemas`].join("\n");

      try {
        await transporter.sendMail({ from: `"LOGISPORT Sistemas" <${process.env.GMAIL_USER}>`, to: u.email, subject: asunto, text: cuerpo });
        resultados.push({ email: u.email, dias: diffDias, enviado: true });
      } catch (err) {
        resultados.push({ email: u.email, dias: diffDias, enviado: false, error: err.message });
      }
    }

    return res.status(200).json({ ok: true, procesados: resultados.length, resultados });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
