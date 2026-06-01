// utils/useEquipos.js
import { useState, useEffect } from "react";
import { db } from "@/firebase/firebaseConfig";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch, query, orderBy } from "firebase/firestore";

export function useEquipos() {
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargarEquipos = async () => {
    try {
      setLoading(true); setError(null);
      const q = query(collection(db, "equiposCatalogo"), orderBy("nombre", "asc"));
      const snap = await getDocs(q);
      setEquipos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { cargarEquipos(); }, []);
  return { equipos, loading, error, recargar: cargarEquipos };
}

export async function agregarEquipo(nombre, activo = true) {
  if (!nombre?.trim()) return { success: false, error: "El nombre es obligatorio" };
  try {
    await addDoc(collection(db, "equiposCatalogo"), { nombre: nombre.trim(), activo, creadoEn: new Date().toISOString() });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

export async function actualizarEquipo(id, datos) {
  if (!id) return { success: false, error: "ID no proporcionado" };
  try {
    await updateDoc(doc(db, "equiposCatalogo", id), { ...datos, actualizadoEn: new Date().toISOString() });
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
}

export async function eliminarEquipo(id) {
  if (!id) return { success: false, error: "ID no proporcionado" };
  try { await deleteDoc(doc(db, "equiposCatalogo", id)); return { success: true }; }
  catch (e) { return { success: false, error: e.message }; }
}
