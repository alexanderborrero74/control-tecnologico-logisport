// utils/useCargos.js
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
 * Hook para gestionar cargos desde Firestore
 */
export function useCargos() {
  const [cargos, setCargos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargarCargos = async () => {
    try {
      setLoading(true);
      setError(null);
      const q = query(collection(db, "cargosCatalogo"), orderBy("nombre", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCargos(data);
    } catch (err) {
      console.error("Error cargando cargos:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCargos();
  }, []);

  return {
    cargos,
    loading,
    error,
    recargar: cargarCargos,
  };
}

/**
 * Agregar un cargo
 */
export async function agregarCargo(nombre, activo = true) {
  try {
    if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
      return { success: false, error: "El nombre del cargo es obligatorio" };
    }

    const cargoData = {
      nombre: nombre.trim(),
      activo: activo !== false,
      creadoEn: new Date().toISOString().split('T')[0], // formato yyyy-MM-dd
    };

    await addDoc(collection(db, "cargosCatalogo"), cargoData);
    return { success: true };
  } catch (error) {
    console.error("Error agregando cargo:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Actualizar un cargo existente
 */
export async function actualizarCargo(id, datos) {
  try {
    if (!id) {
      return { success: false, error: "ID de cargo no proporcionado" };
    }

    const cargoRef = doc(db, "cargosCatalogo", id);
    const datosActualizados = {
      ...datos,
      actualizadoEn: new Date().toISOString().split('T')[0], // formato yyyy-MM-dd
    };

    await updateDoc(cargoRef, datosActualizados);
    return { success: true };
  } catch (error) {
    console.error("Error actualizando cargo:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Eliminar un cargo
 */
export async function eliminarCargo(id) {
  try {
    if (!id) {
      return { success: false, error: "ID de cargo no proporcionado" };
    }

    const cargoRef = doc(db, "cargosCatalogo", id);
    await deleteDoc(cargoRef);
    return { success: true };
  } catch (error) {
    console.error("Error eliminando cargo:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Migrar cargos base a Firestore
 */
export async function migrarCargosBase(cargosBase) {
  const resultados = [];

  for (const cargo of cargosBase) {
    try {
      await addDoc(collection(db, "cargosCatalogo"), {
        nombre: cargo.nombre,
        activo: cargo.activo !== false,
        creadoEn: new Date().toISOString(),
      });
      resultados.push({ cargo: cargo.nombre, success: true });
    } catch (error) {
      console.error(`Error migrando cargo ${cargo.nombre}:`, error);
      resultados.push({ cargo: cargo.nombre, success: false, error: error.message });
    }
  }

  return resultados;
}

/**
 * Eliminar todos los cargos
 */
export async function eliminarTodosLosCargos() {
  try {
    const snapshot = await getDocs(collection(db, "cargosCatalogo"));
    const batch = writeBatch(db);
    
    snapshot.docs.forEach((documento) => {
      batch.delete(documento.ref);
    });

    await batch.commit();
    return { success: true, eliminados: snapshot.docs.length };
  } catch (error) {
    console.error("Error eliminando todos los cargos:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Limpiar y reimportar cargos base
 */
export async function limpiarYReimportarCargos(cargosBase) {
  try {
    // 1. Eliminar todos los cargos existentes
    const resultadoEliminacion = await eliminarTodosLosCargos();
    if (!resultadoEliminacion.success) {
      return { 
        success: false, 
        error: `Error eliminando cargos: ${resultadoEliminacion.error}` 
      };
    }

    // 2. Importar cargos base
    const resultadosImportacion = await migrarCargosBase(cargosBase);
    const exitosos = resultadosImportacion.filter(r => r.success).length;

    return {
      success: true,
      eliminados: resultadoEliminacion.eliminados,
      importados: exitosos,
    };
  } catch (error) {
    console.error("Error en limpiarYReimportarCargos:", error);
    return { success: false, error: error.message };
  }
}
