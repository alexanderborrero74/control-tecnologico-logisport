// pages/api/test-correo.js — SOLO PARA DIAGNOSTICO, eliminar despues
export default async function handler(req, res) {
  try {
    const resultado = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/enviarCorreoElectronico`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: ["soportesistemas@soporteia.net", "rivascamiloelian@gmail.com"],
        subject: "✅ Prueba de correo LOGISPORT",
        text: "Este es un correo de prueba del sistema LOGISPORT.\n\nSi recibes esto, el envío funciona correctamente.",
      }),
    });
    const data = await resultado.json();
    return res.status(200).json({ status: resultado.status, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
