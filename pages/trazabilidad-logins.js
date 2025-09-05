// pages/trazabilidad-logins.js
import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { getAuth, onAuthStateChanged } from "firebase/auth";

import { getUserRoleByUid } from "@/utils/getUserRole";
import { useRouter } from "next/router";

export default function TrazabilidadLogins() {
  const [registros, setRegistros] = useState([]);
  const [rol, setRol] = useState("");
  const [cargandoRol, setCargandoRol] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push("/login");
        return;
      }
      try {
        const r = await getUserRoleByUid(u.uid);
        setRol(r);
      } catch (e) {
        console.error("Error leyendo rol:", e);
        setRol("usuario");
      } finally {
        setCargandoRol(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const cargarLogins = async () => {
    const q = query(collection(db, "logins"), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);
    const lista = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setRegistros(lista);
  };

  // 🔹 Nuevo: cargar registros cuando ya terminó la carga del rol/autenticación
  useEffect(() => {
    if (!cargandoRol) {
      cargarLogins().catch((e) => console.error("Error cargando logins:", e));
    }
  }, [cargandoRol]);

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 28, fontWeight: "bold", marginBottom: 24 }}>
        Trazabilidad de Conexiones
      </h1>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={estiloCelda}>Email</th>
            <th style={estiloCelda}>UID</th>
            <th style={estiloCelda}>Fecha y Hora</th>
          </tr>
        </thead>
        <tbody>
          {registros.map((registro) => (
            <tr key={registro.id}>
              <td style={estiloCelda}>{registro.email}</td>
              <td style={estiloCelda}>{registro.uid}</td>
              <td style={estiloCelda}>
                {registro.timestamp?.toDate().toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Botón regresar fijo */}
      <button
        style={{
          position: "fixed",
          bottom: "20px",
          left: "20px",
          backgroundColor: "#2980b9",
          color: "white",
          padding: "10px 20px",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          zIndex: 1000,
          boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
        }}
        onClick={() => router.push("/")}
      >
        ⬅ Regresar
      </button>
    </div>
  );
}

const estiloCelda = {
  border: "1px solid #ccc",
  padding: "10px",
  textAlign: "left",
};
