// pages/api/crear-usuario-auth.js
import { getAdmin } from "@/lib/admin";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { email, password, displayName } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email y contraseña son obligatorios" });
  if (password.length < 6) return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });

  try {
    const admin = getAdmin();

    // Intentar crear el usuario
    try {
      const userRecord = await admin.auth().createUser({
        email: String(email).trim(),
        password: String(password),
        displayName: displayName ? String(displayName).trim() : "",
        emailVerified: false,
      });
      return res.status(200).json({ success: true, uid: userRecord.uid, nuevo: true });

    } catch (createError) {
      // Si ya existe en Auth, obtener su UID y actualizar la contraseña
      if (createError.code === "auth/email-already-exists") {
        try {
          const usuarioExistente = await admin.auth().getUserByEmail(String(email).trim());
          // Actualizar contraseña con la nueva
          await admin.auth().updateUser(usuarioExistente.uid, {
            password: String(password),
            displayName: displayName ? String(displayName).trim() : usuarioExistente.displayName || "",
          });
          return res.status(200).json({
            success: true,
            uid: usuarioExistente.uid,
            nuevo: false,
            aviso: "El usuario ya existía en Auth. Se actualizó su contraseña.",
          });
        } catch (getError) {
          return res.status(400).json({ error: "El correo ya existe y no se pudo obtener: " + getError.message });
        }
      }
      throw createError;
    }

  } catch (error) {
    let mensaje = error.message;
    if (error.code === "auth/invalid-email") mensaje = "El correo no es válido.";
    else if (error.code === "auth/weak-password") mensaje = "La contraseña es muy débil.";
    return res.status(400).json({ error: mensaje });
  }
}
