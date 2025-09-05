// /pages/api/enviarCorreoElectronico.js
// Reemplazo completo, compatible con tu frontend actual.
// Mantiene la lógica: recibe { to, subject, text } (y opcional html, replyTo, fromName)
// Usa Nodemailer con Gmail/Workspace (App Password) y hace fallback 465→587.

import nodemailer from "nodemailer";

/** Quita espacios y comillas accidentales en la clave */
function sanitizePass(raw) {
  return String(raw || "").replace(/\s+/g, "").replace(/^['"]|['"]$/g, "");
}

/** Devuelve una pista legible según errores típicos */
function buildHintFromError(err) {
  const msg = (err?.message || "").toLowerCase();
  if (
    msg.includes("username and password not accepted") ||
    msg.includes("invalid login") ||
    msg.includes("ea u t h") ||
    msg.includes("auth")
  ) {
    return "Auth inválida. En Gmail/Workspace usa App Password (2FA) y define GMAIL_USER/GMAIL_PASS en el hosting.";
  }
  if (
    msg.includes("getaddrinfo enotfound") ||
    msg.includes("econnrefused") ||
    msg.includes("timed out") ||
    msg.includes("connect etimedout")
  ) {
    return "No se pudo conectar al SMTP (red/puerto 465/587 bloqueado). Prueba red distinta o 587 TLS.";
  }
  return "Revisa variables de entorno y conectividad SMTP.";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  }

  try {
    const {
      to,
      para, // alias opcional
      subject = "",
      asunto = "", // alias opcional
      text = "",
      html = "",
      replyTo = "",
      fromName = "",
      debug = false,
    } = req.body || {};

    const user = String(process.env.GMAIL_USER || "").trim();
    const pass = sanitizePass(process.env.GMAIL_PASS);

    if (!user || !pass) {
      return res.status(500).json({
        ok: false,
        error: "Faltan credenciales (GMAIL_USER/GMAIL_PASS)",
        hint: "Define GMAIL_USER y GMAIL_PASS en Vercel/hosting (App Password con 2FA si es Gmail/Workspace).",
      });
    }

    // Normaliza destinatarios (acepta string o array, y también 'para')
    const toRaw = to ?? para ?? [];
    const toList = Array.isArray(toRaw) ? toRaw : [toRaw];
    const toClean = toList.map((s) => String(s || "").trim()).filter(Boolean);
    if (toClean.length === 0) {
      return res.status(400).json({ ok: false, error: "Falta destinatario (to/para)" });
    }

    const subjectFinal = subject || asunto || "";

    const from = fromName ? `${fromName} <${user}>` : user;
    const mailOptions = {
      from,
      to: toClean,
      subject: subjectFinal,
      ...(html ? { html } : { text }),
      ...(replyTo ? { replyTo } : {}),
    };

    // Intento 1: SSL 465
    const smtp465 = {
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    };

    // Intento 2: TLS 587
    const smtp587 = {
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user, pass },
    };

    let lastError = null;
    try {
      const transporter = nodemailer.createTransport(smtp465);
      await transporter.verify();
      const info = await transporter.sendMail(mailOptions);
      return res.status(200).json({ ok: true, method: "smtp465", messageId: info?.messageId });
    } catch (err1) {
      lastError = err1;
    }

    try {
      const transporter2 = nodemailer.createTransport(smtp587);
      await transporter2.verify();
      const info2 = await transporter2.sendMail(mailOptions);
      return res.status(200).json({ ok: true, method: "smtp587", messageId: info2?.messageId });
    } catch (err2) {
      const hint = buildHintFromError(err2 || lastError);
      return res.status(500).json({
        ok: false,
        error: String(err2?.message || lastError?.message || "Fallo desconocido"),
        hint,
        ...(debug ? { user_present: !!user, pass_len: pass.length } : undefined),
      });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || "Error") });
  }
}
