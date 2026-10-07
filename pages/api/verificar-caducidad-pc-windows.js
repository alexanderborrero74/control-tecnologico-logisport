// pages/api/verificar-caducidad-pc-windows.js
// Cron diario: revisa la colección credenciales_pc_windows y, a quienes les
// queden exactamente 2 días para el vencimiento de su clave (ciclo de 2 meses
// contado desde fechaCambio), les envía un correo automático al "correo" que
// registraron, recordándoles que deben cambiar la clave del equipo.
//
// Idempotencia: al enviar el recordatorio se guarda recordatorioEnviadoPara =
// fechaCambio. Si en el próximo run fechaCambio no ha cambiado, no se reenvía.
// Cuando el usuario actualiza su clave (fechaCambio cambia), el recordatorio
// vuelve a habilitarse automáticamente para el nuevo ciclo.

import { getFirestore } from "@/lib/admin";
import nodemailer from "nodemailer";

const DIAS_CADUCIDAD = 60; // ~2 meses, igual que en pages/control-de-contrasenas.js
const DIAS_AVISO = 2;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
});

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const db = getFirestore();
    const snap = await db.collection("credenciales_pc_windows").get();

    const hoy = new Date();
    const resultados = [];

    for (const docSnap of snap.docs) {
      const it = docSnap.data();
      if (!it.correo || !it.fechaCambio) continue;

      const fechaVence = new Date(new Date(it.fechaCambio).getTime() + DIAS_CADUCIDAD * 86400000);
      const diffDias = Math.ceil((fechaVence.getTime() - hoy.getTime()) / 86400000);

      if (diffDias !== DIAS_AVISO) continue;
      if (it.recordatorioEnviadoPara === it.fechaCambio) continue; // ya enviado en este ciclo

      const asunto = `⏰ Tu contraseña de PC vence en ${DIAS_AVISO} días — LOGISPORT`;
      const cuerpo = [
        `Hola ${it.usuario || ""},`,
        ``,
        `Tu contraseña del equipo (PC de Windows) vencerá en ${DIAS_AVISO} días (${fechaVence.toLocaleDateString("es-CO")}).`,
        `Recuerda cambiarla antes de esa fecha.`,
        ``,
        `LOGISPORT — Área de Sistemas`,
      ].join("\n");

      try {
        await transporter.sendMail({
          from: `"LOGISPORT Sistemas" <${process.env.GMAIL_USER}>`,
          to: it.correo,
          subject: asunto,
          text: cuerpo,
        });
        await docSnap.ref.update({ recordatorioEnviadoPara: it.fechaCambio });
        resultados.push({ id: docSnap.id, correo: it.correo, diasRestantes: diffDias, enviado: true });
      } catch (err) {
        resultados.push({ id: docSnap.id, correo: it.correo, diasRestantes: diffDias, enviado: false, error: err.message });
      }
    }

    return res.status(200).json({ ok: true, procesados: resultados.length, resultados });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
