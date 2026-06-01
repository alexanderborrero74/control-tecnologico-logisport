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
    // 1. Buscar en coleccion "usuarios" por UID (documento con ID = uid)
    const ref = doc(db, "usuarios", uid);
    const snap = await getDoc(ref);

    let raw = null;

    if (snap.exists()) {
      raw = snap.data().rol;
    } else {
      const { collection, query, where, getDocs, setDoc } = await import("firebase/firestore");

      // 2. Buscar en usuariosCatalogo por uid
      let snapCat = null;
      let datosCat = null;

      const q1 = query(collection(db, "usuariosCatalogo"), where("uid", "==", uid));
      const res1 = await getDocs(q1);
      if (!res1.empty) {
        snapCat = res1.docs[0];
        datosCat = res1.docs[0].data();
      }

      // 3. Fallback: buscar en "tecnicos" por uid
      if (!datosCat) {
        const q2 = query(collection(db, "tecnicos"), where("uid", "==", uid));
        const res2 = await getDocs(q2);
        if (!res2.empty) {
          // Es un técnico registrado en la colección tecnicos
          datosCat = { ...res2.docs[0].data(), rol: "tecnico" };
        }
      }

      if (datosCat) {
        raw = datosCat.rol || (datosCat.empresa !== undefined ? "tecnico" : null);
        // Sincronizar a usuarios para próximas consultas
        if (raw && raw !== "usuario") {
          try {
            await setDoc(ref, {
              rol:            raw,
              nombre:         datosCat.nombre || "",
              email:          datosCat.email  || "",
              uid:            uid,
              sincronizadoEn: new Date().toISOString(),
            });
          } catch { /* silencioso */ }
        }
      }
    }
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

  // Técnico: acceso ampliado
  if (rol === "tecnico") {
    const rutasTecnico = [
      "/servicios-tecnicos",
      "/seguimiento-codigos-asociados",
      "/monitoreo",
      "/hoja-vida",
      "/control-de-contrasenas",
      "/registro-fotografico",
      "/admin-usuarios",
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
