// utils/getUserRole.js
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";

/**
 * Obtiene el rol de un usuario desde Firestore
 * @param {string} uid - UID del usuario
 * @returns {Promise<string>} - Rol: "admin" | "tecnico" | "auditor" | "usuario"
 */
export async function getUserRoleByUid(uid) {
  if (!uid) return "usuario";
  
  try {
    const ref = doc(db, "usuarios", uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return "usuario";
    }

    const raw = snap.data().rol;
    if (!raw) {
      return "usuario";
    }

    const rolNormalizado = String(raw).toLowerCase().trim();

    // Admin
    if (["admin", "administracion", "administración", "administrator", "adm"].includes(rolNormalizado)) {
      return "admin";
    }

    // Técnico
    if (["tecnico", "técnico", "technician", "tech"].includes(rolNormalizado)) {
      return "tecnico";
    }

    // Auditor
    if (["auditor", "audit", "revisor"].includes(rolNormalizado)) {
      return "auditor";
    }

    // Nómina — personal del área de liquidación
    if (["nomina", "nómina", "nominas", "nóminas", "payroll"].includes(rolNormalizado)) {
      return "nomina";
    }

    // Usuario por defecto
    return "usuario";
  } catch (error) {
    console.error("Error obteniendo rol:", error);
    return "usuario";
  }
}

/**
 * Verifica si el usuario tiene acceso a una ruta específica
 * @param {string} rol - Rol del usuario
 * @param {string} path - Ruta a verificar
 * @returns {boolean} - true si tiene acceso
 */
export function tieneAcceso(rol, path) {
  // Admin tiene acceso a todo
  if (rol === "admin") return true;

  // Rutas públicas (accesibles para todos los roles autenticados)
  const rutasPublicas = [
    "/",
    "/login"
  ];
  if (rutasPublicas.includes(path)) return true;

  // Técnico: servicios técnicos y seguimiento
  if (rol === "tecnico") {
    const rutasTecnico = [
      "/servicios-tecnicos",
      "/solicitudserviciotecnico",
      "/seguimiento-codigos-asociados"
    ];
    return rutasTecnico.includes(path);
  }

  // Auditor: solo consulta y reportes
  if (rol === "auditor") {
    const rutasAuditor = [
      "/indicadores-gestion",
      "/estadisticas",
      "/documentacionti",
      "/capsulas-admin",
      "/licencias",
      "/procesoit"
    ];
    return rutasAuditor.includes(path);
  }

  // Usuario: SOLO solicitud de servicio (usuario final)
  if (rol === "usuario") {
    const rutasUsuario = [
      "/solicitudserviciotecnico",
      "/seguimiento-codigos-asociados"
    ];
    return rutasUsuario.includes(path);
  }

  return false;
}
