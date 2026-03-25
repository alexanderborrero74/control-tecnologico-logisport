// pages/debug-servicios.js
import { useEffect, useState } from "react";
import { db } from "@/firebase/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

export default function DebugServicios() {
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      try {
        const snapshot = await getDocs(collection(db, "serviciosTecnicos"));
        const datos = snapshot.docs.map((doc) => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        setServicios(datos);
        console.log("Servicios cargados:", datos);
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  const estaFinalizado = (servicio) => {
    const finalizado = String(servicio.finalizado || "").toLowerCase().trim();
    const servicioFinalizado = String(servicio.servicioFinalizado || "").toLowerCase().trim();
    return finalizado === "si" || finalizado === "sí" || 
           servicioFinalizado === "si" || servicioFinalizado === "sí";
  };

  const finalizados = servicios.filter(estaFinalizado);
  const pendientes = servicios.filter(s => !estaFinalizado(s));

  if (loading) return <div style={{ padding: 40 }}>Cargando...</div>;

  return (
    <div style={{ padding: 40, fontFamily: "monospace", fontSize: 12 }}>
      <h1>DEBUG - Servicios Técnicos</h1>
      
      <div style={{ marginBottom: 30, padding: 20, background: "#f0f0f0", borderRadius: 8 }}>
        <h2>Resumen:</h2>
        <p><strong>Total:</strong> {servicios.length}</p>
        <p><strong>Finalizados (según lógica):</strong> {finalizados.length}</p>
        <p><strong>Pendientes (según lógica):</strong> {pendientes.length}</p>
      </div>

      <h2>TODOS LOS SERVICIOS (Campos: finalizado y servicioFinalizado):</h2>
      
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ background: "#333", color: "white" }}>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>ID</th>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>Consecutivo</th>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>Técnico</th>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>finalizado (RAW)</th>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>servicioFinalizado (RAW)</th>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>¿Finalizado? (lógica)</th>
          </tr>
        </thead>
        <tbody>
          {servicios.map((s) => {
            const final = estaFinalizado(s);
            return (
              <tr 
                key={s.id}
                style={{ 
                  background: final ? "#d1fae5" : "#fee2e2"
                }}
              >
                <td style={{ border: "1px solid #ddd", padding: 8 }}>{s.id.slice(0, 8)}...</td>
                <td style={{ border: "1px solid #ddd", padding: 8 }}>{s.consecutivo || "—"}</td>
                <td style={{ border: "1px solid #ddd", padding: 8 }}>{s.tecnico || "—"}</td>
                <td style={{ border: "1px solid #ddd", padding: 8 }}>
                  <code>{JSON.stringify(s.finalizado)}</code>
                  <br/>
                  <small>Tipo: {typeof s.finalizado}</small>
                </td>
                <td style={{ border: "1px solid #ddd", padding: 8 }}>
                  <code>{JSON.stringify(s.servicioFinalizado)}</code>
                  <br/>
                  <small>Tipo: {typeof s.servicioFinalizado}</small>
                </td>
                <td style={{ 
                  border: "1px solid #ddd", 
                  padding: 8,
                  fontWeight: "bold",
                  color: final ? "green" : "red"
                }}>
                  {final ? "✅ SÍ" : "❌ NO"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ marginTop: 30, padding: 20, background: "#fff3cd", borderRadius: 8 }}>
        <h3>Análisis de valores únicos:</h3>
        <h4>Campo "finalizado":</h4>
        <pre>{JSON.stringify(
          Array.from(new Set(servicios.map(s => JSON.stringify(s.finalizado)))), 
          null, 
          2
        )}</pre>
        
        <h4>Campo "servicioFinalizado":</h4>
        <pre>{JSON.stringify(
          Array.from(new Set(servicios.map(s => JSON.stringify(s.servicioFinalizado)))), 
          null, 
          2
        )}</pre>
      </div>
    </div>
  );
}
