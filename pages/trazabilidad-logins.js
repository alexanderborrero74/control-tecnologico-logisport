// pages/trazabilidad-logins.js
import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/firebase/firebaseConfig";
import { getAuth, onAuthStateChanged } from "firebase/auth";

import { getUserRoleByUid } from "@/utils/getUserRole";
import { useRouter } from "next/router";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import PageHeader from "@/components/PageHeader";

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
        setRol(r || "usuario");
      } catch (e) {
        console.error("Error leyendo rol:", e);
        setRol("usuario");
      } finally {
        setCargandoRol(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const cargarLogins = async () => {
    const q = query(collection(db, "logins"), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);
    const lista = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setRegistros(lista);
  };

  // Cargar registros cuando ya terminó la carga del rol/autenticación
  useEffect(() => {
    if (!cargandoRol) {
      cargarLogins().catch((e) => console.error("Error cargando logins:", e));
    }
  }, [cargandoRol]);

  return (
    <LayoutWithSidebar>
      <PageHeader titulo="Trazabilidad Logins" />
  <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 28, fontWeight: "bold", marginBottom: 24 }}>
        Trazabilidad de Conexiones
      </h1>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={estiloCelda}>Email</th>
            <th style={estiloCelda}>UID</th>
            <th style={estiloCelda}>Rol</th>
            <th style={estiloCelda}>Fecha y Hora</th>
          </tr>
        </thead>
        <tbody>
          {registros.map((registro) => (
            <tr key={registro.id}>
              <td style={estiloCelda}>{registro.email}</td>
              <td style={estiloCelda}>{registro.uid}</td>
              <td style={estiloCelda}>{registro.role || "usuario"}</td>
              <td style={estiloCelda}>
                {registro.timestamp?.toDate
                  ? registro.timestamp.toDate().toLocaleString()
                  : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>


    </div>
  </LayoutWithSidebar>
  );
}

const estiloCelda = {
  border: "1px solid #ccc",
  padding: "10px",
  textAlign: "left",
};
