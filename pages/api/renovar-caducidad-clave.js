// pages/api/renovar-caducidad-clave.js
import { getFirestore } from "@/lib/admin";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  const { email, uid } = req.body;
  if (!email && !uid) return res.status(400).json({ error: "Email o uid requerido" });

  try {
    const db = getFirestore();
    const emailLimpio = email?.trim().toLowerCase();

    // Intentar encontrar el usuario por uid primero (más confiable)
    let snap = null;

    if (uid) {
      snap = await db.collection("usuariosCatalogo").where("uid", "==", uid).get();
    }

    // Si no encontró por uid, buscar por email
    if (!snap || snap.empty) {
      snap = await db.collection("usuariosCatalogo").where("email", "==", emailLimpio).get();
    }

    // Último intento: email tal como viene (sin lowercase)
    if (snap.empty && email) {
      snap = await db.collection("usuariosCatalogo").where("email", "==", email.trim()).get();
    }

    if (snap.empty) {
      // No está en catálogo — crear entrada básica para rastrear la caducidad
      console.warn("Usuario no en catálogo, creando entrada:", emailLimpio);
      const ahora = new Date();
      const nuevaFecha = new Date(ahora);
      nuevaFecha.setDate(nuevaFecha.getDate() + 60);

      await db.collection("usuariosCatalogo").add({
        email:               emailLimpio || email.trim(),
        uid:                 uid || "",
        nombre:              email || "",
        cargo:               "",
        activo:              true,
        diasCaducidad:       60,
        fechaCreadaClave:    ahora.toISOString(),
        fechaCaducidadClave: nuevaFecha.toISOString(),
        creadoEn:            ahora.toISOString(),
        modificadoEn:        ahora.toISOString(),
      });

      return res.status(200).json({ success: true, nuevaFecha: nuevaFecha.toISOString(), dias: 60, creado: true });
    }

    const userDoc = snap.docs[0];
    const datos = userDoc.data();
    const dias = Number(datos.diasCaducidad) || 60;
    const ahora = new Date();
    const nuevaFecha = new Date(ahora);
    nuevaFecha.setDate(nuevaFecha.getDate() + dias);

    await userDoc.ref.update({
      fechaCreadaClave:    ahora.toISOString(),
      fechaCaducidadClave: nuevaFecha.toISOString(),
      modificadoEn:        ahora.toISOString(),
      // Actualizar uid si no lo tenía
      ...(uid && !datos.uid ? { uid } : {}),
    });

    // Historial
    await db.collection("historialClaves").add({
      usuarioId:      userDoc.id,
      nombre:         datos.nombre || "",
      email:          datos.email  || emailLimpio || "",
      cargo:          datos.cargo  || "",
      evento:         "cambio_usuario",
      diasCaducidad:  dias,
      fechaCreacion:  ahora.toISOString(),
      fechaCaducidad: nuevaFecha.toISOString(),
      creadoEn:       ahora.toISOString(),
    });

    return res.status(200).json({ success: true, nuevaFecha: nuevaFecha.toISOString(), dias });
  } catch (err) {
    console.error("Error en renovar-caducidad-clave:", err);
    return res.status(500).json({ error: err.message });
  }
}
