// utils/usePermisosNomina.js
// Hook que provee los permisos de un usuario por módulo desde Firestore.
// Escucha en tiempo real — cambios del admin se reflejan sin recargar.
//
// Estructura en Firestore  nomina_permisos_usuario/{uid}:
// {
//   uid, email, nombre,
//   modulos: {
//     trabajadores: {
//       nivel:    "ninguno" | "lectura" | "limitado" | "total",
//       acciones: { crear_trabajador: true, editar_trabajador: false, ... }
//     },
//     // También acepta el formato antiguo (string) por compatibilidad:
//     asistencia: "lectura",
//   }
// }
//
// Uso en páginas:
//   const { puedeVer, puedeEditar, tieneControl, tieneAccion } = usePermisosNomina(uid, rol);
//   if (!puedeVer("trabajadores")) return <Redirect />;
//   const puedeEliminar = tieneAccion("administrar", "eliminar_novedad");

import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { normalizarPermiso } from "@/utils/permisosConfig";

// Roles que siempre tienen acceso total sin importar los permisos de Firestore
const ROLES_SUPER = ["admin", "admin_nomina"];

// Orden jerárquico de niveles (mayor índice = más permiso)
const NIVEL_ORDEN = { ninguno: 0, lectura: 1, limitado: 2, total: 3 };

/**
 * @param {string|null} uid   UID de Firebase Auth
 * @param {string|null} rol   Rol del usuario ("admin", "nomina", etc.)
 */
export function usePermisosNomina(uid, rol) {
  // modulosPermisos guarda el valor RAW de Firestore (puede ser string u objeto)
  const [modulosPermisos, setModulosPermisos] = useState({});
  const [loadingPermisos, setLoadingPermisos] = useState(true);

  const esSuper = ROLES_SUPER.includes(rol);

  useEffect(() => {
    if (esSuper) { setLoadingPermisos(false); return; }
    if (!uid)    { setModulosPermisos({}); setLoadingPermisos(false); return; }

    const unsub = onSnapshot(
      doc(db, "nomina_permisos_usuario", uid),
      (snap) => {
        setModulosPermisos(snap.exists() ? (snap.data().modulos || {}) : {});
        setLoadingPermisos(false);
      },
      () => { setModulosPermisos({}); setLoadingPermisos(false); }
    );
    return () => unsub();
  }, [uid, esSuper]);

  // ── Helpers internos ──────────────────────────────────────────────────────

  /** Devuelve el objeto normalizado { nivel, acciones } para un módulo */
  const _normalizado = (modulo) => {
    if (esSuper) return { nivel: "total", acciones: {} };
    return normalizarPermiso(modulo, modulosPermisos[modulo]);
  };

  // ── API pública ───────────────────────────────────────────────────────────

  /** Nivel efectivo del usuario para un módulo ("ninguno"|"lectura"|"limitado"|"total") */
  const nivel = (modulo) => {
    if (esSuper) return "total";
    return _normalizado(modulo).nivel;
  };

  /** ¿Puede ver la página? (nivel > ninguno) */
  const puedeVer = (modulo) => {
    if (esSuper) return true;
    return nivel(modulo) !== "ninguno";
  };

  /** ¿Puede crear / editar? (nivel: limitado o total) */
  const puedeEditar = (modulo) => {
    if (esSuper) return true;
    return NIVEL_ORDEN[nivel(modulo)] >= NIVEL_ORDEN["limitado"];
  };

  /** ¿Tiene control total? (crear + editar + eliminar + acciones destructivas) */
  const tieneControl = (modulo) => {
    if (esSuper) return true;
    return nivel(modulo) === "total";
  };

  /**
   * ¿Tiene permiso para una acción granular específica dentro de un módulo?
   * Ejemplo: tieneAccion("administrar", "crear_novedad")
   *
   * Lógica:
   * - super-admin → siempre true
   * - nivel "ninguno" → siempre false (no tiene acceso al módulo)
   * - nivel "total" sin acciones configuradas → true por defecto
   * - nivel "limitado" sin acciones configuradas → true por defecto
   * - nivel "lectura" sin acciones configuradas → false por defecto
   * - acciones configuradas explícitamente → respeta el valor guardado
   */
  const tieneAccion = (modulo, accion) => {
    if (esSuper) return true;
    const { nivel: niv, acciones } = _normalizado(modulo);
    if (niv === "ninguno") return false;
    // Si la acción tiene un valor explícito, usarlo
    if (accion in acciones) return acciones[accion] === true;
    // Default: activo si nivel >= limitado
    return NIVEL_ORDEN[niv] >= NIVEL_ORDEN["limitado"];
  };

  return {
    modulosPermisos,
    loadingPermisos,
    puedeVer,
    puedeEditar,
    tieneControl,
    tieneAccion,
    nivel,
  };
}
