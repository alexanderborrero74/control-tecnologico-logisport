// pages/api/notificar-nueva-clave.js
// Notifica a soportesistemas@soporteia.net cuando un usuario cambia su clave
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { emailUsuario, nuevaClave, nombreUsuario } = req.body;
  if (!emailUsuario || !nuevaClave) return res.status(400).json({ error: "Datos incompletos" });

  const asunto = `🔑 Cambio de contraseña — ${nombreUsuario || emailUsuario} — LOGISPORT`;
  const cuerpo = [
    `Se ha registrado un cambio de contraseña en el sistema LOGISPORT.`,
    ``,
    `- Usuario:        ${nombreUsuario || "—"}`,
    `- Correo:         ${emailUsuario}`,
    `- Nueva clave:    ${nuevaClave}`,
    `- Fecha y hora:   ${new Date().toLocaleString("es-CO")}`,
    ``,
    `Esta notificación fue enviada automáticamente desde la aplicación.`,
    ``,
    `LOGISPORT — Área de Sistemas / NexoTI`,
  ].join("\n");

  try {
    await transporter.sendMail({
      from: `"LOGISPORT Sistemas" <${process.env.GMAIL_USER}>`,
      to: "soportesistemas@soporteia.net",
      subject: asunto,
      text: cuerpo,
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error enviando notificación de clave:", err);
    return res.status(500).json({ error: err.message });
  }
}
