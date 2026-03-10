// utils/usePermisosNomina.js
// Hook que provee los permisos de un usuario por módulo desde Firestore.
// Escucha en tiempo real — cambios del admin se reflejan sin recargar.
//
// Estructura en Firestore  nomina_permisos_usuario/{uid}:
// {
//   uid, email, nombre,
//   modulos: {
//     trabajadores:      "ninguno" | "lectura" | "limitado" | "total",
//     asistencia:        "ninguno" | "lectura" | "limitado" | "total",
//     ...
//   }
// }
//
// Uso en páginas:
//   const { nivel, puedeVer, puedeEditar, tieneControl } = usePermisosNomina(uid, rol);
//   if (!puedeVer("trabajadores")) return <Redirect />;
//   const puedeEliminar = tieneControl("trabajadores");

import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";

// Roles que siempre tienen acceso total sin importar los permisos de Firestore
const ROLES_SUPER = ["admin", "admin_nomina"];

// Orden jerárquico de niveles (mayor índice = más permiso)
const NIVEL_ORDEN = { ninguno: 0, lectura: 1, limitado: 2, total: 3 };

/**
 * @param {string|null} uid   UID de Firebase Auth
 * @param {string|null} rol   Rol del usuario ("admin", "nomina", etc.)
 * @returns {{
 *   modulosPermisos: Object<string, string>,
 *   loadingPermisos: boolean,
 *   puedeVer:    (modulo: string) => boolean,
 *   puedeEditar: (modulo: string) => boolean,
 *   tieneControl:(modulo: string) => boolean,
 *   nivel:       (modulo: string) => string,
 * }}
 */
export function usePermisosNomina(uid, rol) {
  const [modulosPermisos, setModulosPermisos] = useState({});
  const [loadingPermisos, setLoadingPermisos] = useState(true);

  const esSuper = ROLES_SUPER.includes(rol);

  useEffect(() => {
    // Si es super-admin, no necesitamos leer Firestore
    if (esSuper) {
      setLoadingPermisos(false);
      return;
    }
    if (!uid) {
      setModulosPermisos({});
      setLoadingPermisos(false);
      return;
    }

    const unsub = onSnapshot(
      doc(db, "nomina_permisos_usuario", uid),
      (snap) => {
        setModulosPermisos(
          snap.exists() ? (snap.data().modulos || {}) : {}
        );
        setLoadingPermisos(false);
      },
      () => {
        setModulosPermisos({});
        setLoadingPermisos(false);
      }
    );

    return () => unsub();
  }, [uid, esSuper]);

  /**
   * Retorna el nivel efectivo del usuario para un módulo.
   * Super-admin siempre retorna "total".
   */
  const nivel = (modulo) => {
    if (esSuper) return "total";
    return modulosPermisos[modulo] || "lectura"; // default: solo lectura si no está configurado
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

  return { modulosPermisos, loadingPermisos, puedeVer, puedeEditar, tieneControl, nivel };
}
