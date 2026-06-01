// pages/api/test-caducidad-correo.js — Solo para pruebas
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
});

export default async function handler(req, res) {
  const { email, tipo = "vencida" } = req.query;
  if (!email) return res.status(400).json({ error: "Falta ?email=" });

  const asunto = tipo === "aviso"
    ? "⏰ Tu contraseña vence en 7 días — LOGISPORT"
    : "🔐 Cambio de contraseña obligatorio — LOGISPORT";

  const cuerpo = tipo === "aviso"
    ? ["Hola,", "", "[PRUEBA] Tu contraseña vencerá en 7 días.", "", "Cámbiala en: https://ti-logisport.vercel.app", "", "LOGISPORT — Área de Sistemas"].join("\n")
    : ["Hola,", "", "[PRUEBA] Tu contraseña ha vencido.", "", "Debes cambiarla en: https://ti-logisport.vercel.app", "", "LOGISPORT — Área de Sistemas"].join("\n");

  try {
    await transporter.sendMail({ from: `"LOGISPORT Sistemas" <${process.env.GMAIL_USER}>`, to: email, subject: asunto, text: cuerpo });
    return res.status(200).json({ ok: true, mensaje: `Correo de prueba enviado a ${email}`, tipo });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
