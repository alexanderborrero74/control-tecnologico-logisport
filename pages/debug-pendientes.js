// pages/debug-pendientes.js
import { useEffect, useState } from "react";
import { db } from "@/firebase/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";

export default function DebugPendientes() {
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
    const estado = String(servicio.estado || "").toLowerCase().trim();
    
    const valoresFinalizados = ["si", "sí", "yes", "finalizado", "completado", "terminado", "true", "1"];
    
    return valoresFinalizados.includes(finalizado) ||
           valoresFinalizados.includes(servicioFinalizado) ||
           valoresFinalizados.includes(estado) ||
           servicio.finalizado === true ||
           servicio.servicioFinalizado === true ||
           servicio.estado === true;
  };

  const pendientes = servicios.filter(s => !estaFinalizado(s));
  const finalizados = servicios.filter(estaFinalizado);

  if (loading) return <div style={{ padding: 40 }}>Cargando...</div>;

  return (
    <div style={{ padding: 40, fontFamily: "monospace", fontSize: 11 }}>
      <h1>🔍 DEBUG DETALLADO - SERVICIOS PENDIENTES</h1>
      
      <div style={{ marginBottom: 30, padding: 20, background: "#f0f0f0", borderRadius: 8 }}>
        <h2>📊 Resumen:</h2>
        <p><strong>Total:</strong> {servicios.length}</p>
        <p><strong>Finalizados:</strong> {finalizados.length}</p>
        <p><strong>Pendientes:</strong> {pendientes.length}</p>
      </div>

      <div style={{ marginBottom: 30, padding: 20, background: "#fff3cd", borderRadius: 8 }}>
        <h3>Valores únicos encontrados:</h3>
        <p><strong>Campo "finalizado":</strong></p>
        <pre>{JSON.stringify(
          Array.from(new Set(servicios.map(s => JSON.stringify(s.finalizado)))), 
          null, 
          2
        )}</pre>
        
        <p><strong>Campo "servicioFinalizado":</strong></p>
        <pre>{JSON.stringify(
          Array.from(new Set(servicios.map(s => JSON.stringify(s.servicioFinalizado)))), 
          null, 
          2
        )}</pre>

        <p><strong>Campo "estado":</strong></p>
        <pre>{JSON.stringify(
          Array.from(new Set(servicios.map(s => JSON.stringify(s.estado)))), 
          null, 
          2
        )}</pre>
      </div>

      <h2 style={{ color: "red" }}>❌ SERVICIOS PENDIENTES ({pendientes.length}):</h2>
      
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, marginBottom: 40 }}>
        <thead>
          <tr style={{ background: "#fee2e2" }}>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>Consecutivo</th>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>Usuario</th>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>Fecha</th>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>finalizado</th>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>servicioFinalizado</th>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>estado</th>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>ID (primeros 8)</th>
          </tr>
        </thead>
        <tbody>
          {pendientes.map((s) => (
            <tr key={s.id} style={{ background: "#fef2f2" }}>
              <td style={{ border: "1px solid #ddd", padding: 8 }}>{s.consecutivo || "—"}</td>
              <td style={{ border: "1px solid #ddd", padding: 8 }}>{s.usuario || "—"}</td>
              <td style={{ border: "1px solid #ddd", padding: 8 }}>{s.fecha || "—"}</td>
              <td style={{ border: "1px solid #ddd", padding: 8 }}>
                <code style={{ background: "#fca5a5", padding: 2 }}>
                  {JSON.stringify(s.finalizado)}
                </code>
                <br/>
                <small>tipo: {typeof s.finalizado}</small>
              </td>
              <td style={{ border: "1px solid #ddd", padding: 8 }}>
                <code style={{ background: "#fca5a5", padding: 2 }}>
                  {JSON.stringify(s.servicioFinalizado)}
                </code>
                <br/>
                <small>tipo: {typeof s.servicioFinalizado}</small>
              </td>
              <td style={{ border: "1px solid #ddd", padding: 8 }}>
                <code style={{ background: "#fca5a5", padding: 2 }}>
                  {JSON.stringify(s.estado)}
                </code>
                <br/>
                <small>tipo: {typeof s.estado}</small>
              </td>
              <td style={{ border: "1px solid #ddd", padding: 8 }}>{s.id.slice(0, 8)}...</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ color: "green" }}>✅ SERVICIOS FINALIZADOS ({finalizados.length}):</h2>
      
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
        <thead>
          <tr style={{ background: "#d1fae5" }}>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>Consecutivo</th>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>Usuario</th>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>Fecha</th>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>finalizado</th>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>servicioFinalizado</th>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>estado</th>
            <th style={{ border: "1px solid #ddd", padding: 8 }}>ID (primeros 8)</th>
          </tr>
        </thead>
        <tbody>
          {finalizados.map((s) => (
            <tr key={s.id} style={{ background: "#ecfdf5" }}>
              <td style={{ border: "1px solid #ddd", padding: 8 }}>{s.consecutivo || "—"}</td>
              <td style={{ border: "1px solid #ddd", padding: 8 }}>{s.usuario || "—"}</td>
              <td style={{ border: "1px solid #ddd", padding: 8 }}>{s.fecha || "—"}</td>
              <td style={{ border: "1px solid #ddd", padding: 8 }}>
                <code style={{ background: "#86efac", padding: 2 }}>
                  {JSON.stringify(s.finalizado)}
                </code>
                <br/>
                <small>tipo: {typeof s.finalizado}</small>
              </td>
              <td style={{ border: "1px solid #ddd", padding: 8 }}>
                <code style={{ background: "#86efac", padding: 2 }}>
                  {JSON.stringify(s.servicioFinalizado)}
                </code>
                <br/>
                <small>tipo: {typeof s.servicioFinalizado}</small>
              </td>
              <td style={{ border: "1px solid #ddd", padding: 8 }}>
                <code style={{ background: "#86efac", padding: 2 }}>
                  {JSON.stringify(s.estado)}
                </code>
                <br/>
                <small>tipo: {typeof s.estado}</small>
              </td>
              <td style={{ border: "1px solid #ddd", padding: 8 }}>{s.id.slice(0, 8)}...</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
