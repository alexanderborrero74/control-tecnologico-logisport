// utils/useTecnicos.js
import { useState, useEffect } from "react";
import { db } from "@/firebase/firebaseConfig";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";

export function useTecnicos() {
  const [tecnicos, setTecnicos] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, "tecnicos"));
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setTecnicos(data);
    } catch (error) {
      console.error("Error cargando técnicos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  return { tecnicos, loading, recargar: cargar };
}

export async function agregarTecnico(data) {
  try {
    await addDoc(collection(db, "tecnicos"), {
      ...data,
      createdAt: new Date().toISOString().split('T')[0], // formato yyyy-MM-dd
    });
    return { success: true };
  } catch (error) {
    console.error("Error agregando técnico:", error);
    return { success: false, error: error.message };
  }
}

export async function actualizarTecnico(id, data) {
  try {
    await updateDoc(doc(db, "tecnicos", id), data);
    return { success: true };
  } catch (error) {
    console.error("Error actualizando técnico:", error);
    return { success: false, error: error.message };
  }
}

export async function eliminarTecnico(id) {
  try {
    await deleteDoc(doc(db, "tecnicos", id));
    return { success: true };
  } catch (error) {
    console.error("Error eliminando técnico:", error);
    return { success: false, error: error.message };
  }
}
