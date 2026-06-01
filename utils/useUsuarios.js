// utils/useUsuarios.js
import { useState, useEffect } from "react";
import { db } from "@/firebase/firebaseConfig";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  query,
  orderBy,
} from "firebase/firestore";

/**
 * Hook para gestionar usuarios desde Firestore
 */
export function useUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargarUsuarios = async () => {
    try {
      setLoading(true);
      setError(null);
      const q = query(collection(db, "usuariosCatalogo"), orderBy("nombre", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsuarios(data);
    } catch (err) {
      console.error("Error cargando usuarios:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  return {
    usuarios,
    loading,
    error,
    recargar: cargarUsuarios,
  };
}

/**
 * Agregar un usuario
 */
export async function agregarUsuario(usuarioData) {
  try {
    if (!usuarioData.nombre || !usuarioData.email) {
      return { success: false, error: "Nombre y email son obligatorios" };
    }

    const ahora = new Date();
    const dias = Math.min(60, Math.max(1, Number(usuarioData.diasCaducidad) || 60));
    const fechaCaducidad = new Date(ahora);
    fechaCaducidad.setDate(fechaCaducidad.getDate() + dias);

    const userData = {
      nombre: usuarioData.nombre.trim(),
      email: usuarioData.email.trim(),
      cargo: usuarioData.cargo || "",
      rol: usuarioData.rol || "usuario",
      activo: usuarioData.activo !== false,
      uid: usuarioData.uid || "",
      diasCaducidad: dias,
      fechaCreadaClave: ahora.toISOString(),
      fechaCaducidadClave: fechaCaducidad.toISOString(),
      creadoEn: ahora.toISOString(),
    };

    const docRef = await addDoc(collection(db, "usuariosCatalogo"), userData);

    // Historial de clave
    await addDoc(collection(db, "historialClaves"), {
      usuarioId:      docRef.id,
      nombre:         userData.nombre,
      email:          userData.email,
      cargo:          userData.cargo,
      evento:         "creacion",
      diasCaducidad:  dias,
      fechaCreacion:  ahora.toISOString(),
      fechaCaducidad: fechaCaducidad.toISOString(),
      creadoEn:       ahora.toISOString(),
    });

    return { success: true };
  } catch (error) {
    console.error("Error agregando usuario:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Actualizar un usuario existente
 */
export async function actualizarUsuario(id, datos) {
  try {
    if (!id) return { success: false, error: "ID de usuario no proporcionado" };

    const usuarioRef = doc(db, "usuariosCatalogo", id);
    const datosActualizados = { ...datos, actualizadoEn: new Date().toISOString() };

    // Si se actualizó diasCaducidad, recalcular fechaCaducidadClave desde hoy
    if (datos.diasCaducidad) {
      const ahora = new Date();
      const dias = Math.min(60, Math.max(1, Number(datos.diasCaducidad)));
      const nuevaFecha = new Date(ahora);
      nuevaFecha.setDate(nuevaFecha.getDate() + dias);
      datosActualizados.fechaCaducidadClave = nuevaFecha.toISOString();
      datosActualizados.fechaCreadaClave = ahora.toISOString();

      // Registrar en historial
      await addDoc(collection(db, "historialClaves"), {
        usuarioId:      id,
        nombre:         datos.nombre || "",
        email:          datos.email  || "",
        cargo:          datos.cargo  || "",
        evento:         "renovacion_admin",
        diasCaducidad:  dias,
        fechaCreacion:  ahora.toISOString(),
        fechaCaducidad: nuevaFecha.toISOString(),
        creadoEn:       ahora.toISOString(),
      });
    }

    await updateDoc(usuarioRef, datosActualizados);
    return { success: true };
  } catch (error) {
    console.error("Error actualizando usuario:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Eliminar un usuario
 */
export async function eliminarUsuario(id) {
  try {
    if (!id) {
      return { success: false, error: "ID de usuario no proporcionado" };
    }

    const usuarioRef = doc(db, "usuariosCatalogo", id);
    await deleteDoc(usuarioRef);
    return { success: true };
  } catch (error) {
    console.error("Error eliminando usuario:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Migrar usuarios base a Firestore
 */
export async function migrarUsuariosBase(usuariosBase) {
  const resultados = [];

  for (const usuario of usuariosBase) {
    try {
      await addDoc(collection(db, "usuariosCatalogo"), {
        nombre: usuario.nombre,
        email: usuario.email || "",
        cargo: usuario.cargo || "",
        rol: usuario.rol || "usuario",
        activo: usuario.activo !== false,
        creadoEn: new Date().toISOString(),
      });
      resultados.push({ usuario: usuario.nombre, success: true });
    } catch (error) {
      console.error(`Error migrando usuario ${usuario.nombre}:`, error);
      resultados.push({ usuario: usuario.nombre, success: false, error: error.message });
    }
  }

  return resultados;
}

/**
 * Eliminar todos los usuarios
 */
export async function eliminarTodosLosUsuarios() {
  try {
    const snapshot = await getDocs(collection(db, "usuariosCatalogo"));
    const batch = writeBatch(db);
    
    snapshot.docs.forEach((documento) => {
      batch.delete(documento.ref);
    });

    await batch.commit();
    return { success: true, eliminados: snapshot.docs.length };
  } catch (error) {
    console.error("Error eliminando todos los usuarios:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Limpiar y reimportar usuarios base
 */
export async function limpiarYReimportarUsuarios(usuariosBase) {
  try {
    // 1. Eliminar todos los usuarios existentes
    const resultadoEliminacion = await eliminarTodosLosUsuarios();
    if (!resultadoEliminacion.success) {
      return { 
        success: false, 
        error: `Error eliminando usuarios: ${resultadoEliminacion.error}` 
      };
    }

    // 2. Importar usuarios base
    const resultadosImportacion = await migrarUsuariosBase(usuariosBase);
    const exitosos = resultadosImportacion.filter(r => r.success).length;

    return {
      success: true,
      eliminados: resultadoEliminacion.eliminados,
      importados: exitosos,
    };
  } catch (error) {
    console.error("Error en limpiarYReimportarUsuarios:", error);
    return { success: false, error: error.message };
  }
}
