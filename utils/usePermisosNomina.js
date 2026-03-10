// utils/usePermisosNomina.js
// Hook para obtener los permisos por módulo de un usuario de nómina.
// El admin los configura en /nomina/control-roles → guardados en nomina_permisos_usuario/{uid}

import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";

/**
 * Retorna los permisos de módulo del usuario actual.
 *
 * Uso:
 *   const { permisos, loadingPermisos } = usePermisosNomina(uid);
 *   const puedeEditar = ["admin","admin_nomina"].includes(rol) || permisos.trabajadores;
 *
 * @param {string|null} uid  UID de Firebase Auth del usuario logueado
 * @returns {{ permisos: Object<string,boolean>, loadingPermisos: boolean }}
 */
export function usePermisosNomina(uid) {
  const [permisos,        setPermisos]        = useState({});
  const [loadingPermisos, setLoadingPermisos] = useState(true);

  useEffect(() => {
    if (!uid) {
      setPermisos({});
      setLoadingPermisos(false);
      return;
    }

    // Escucha en tiempo real para que los cambios del admin se reflejen sin recargar
    const unsub = onSnapshot(
      doc(db, "nomina_permisos_usuario", uid),
      (snap) => {
        setPermisos(snap.exists() ? (snap.data().permisos || {}) : {});
        setLoadingPermisos(false);
      },
      () => {
        setPermisos({});
        setLoadingPermisos(false);
      }
    );

    return () => unsub();
  }, [uid]);

  return { permisos, loadingPermisos };
}
