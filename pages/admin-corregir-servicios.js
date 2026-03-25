// pages/admin-corregir-servicios.js
import { useState } from "react";
import { db } from "@/firebase/firebaseConfig";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import LayoutWithSidebar from "@/components/LayoutWithSidebar";
import PageHeader from "@/components/PageHeader";

export default function AdminCorregirServicios() {
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [procesando, setProcesando] = useState(false);

  const cargarServicios = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "serviciosTecnicos"));
      const datos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setServicios(datos);
      setMensaje(`✅ Se cargaron ${datos.length} servicios`);
    } catch (error) {
      console.error("Error:", error);
      setMensaje("❌ Error al cargar servicios");
    } finally {
      setLoading(false);
    }
  };

  const corregirMasivo = async () => {
    if (!window.confirm(`¿Estás seguro de actualizar TODOS los servicios seleccionados? Esta acción no se puede deshacer.`)) {
      return;
    }

    setProcesando(true);
    let actualizados = 0;
    let errores = 0;

    try {
      for (const servicio of servicios) {
        if (servicio.seleccionado) {
          try {
            await updateDoc(doc(db, "serviciosTecnicos", servicio.id), {
              finalizado: "si",
              servicioFinalizado: "si",
              estado: "finalizado"
            });
            actualizados++;
          } catch (error) {
            console.error(`Error actualizando ${servicio.id}:`, error);
            errores++;
          }
        }
      }

      setMensaje(`✅ Actualizados: ${actualizados} | ❌ Errores: ${errores}`);
      
      // Recargar servicios
      await cargarServicios();
    } catch (error) {
      console.error("Error general:", error);
      setMensaje("❌ Error en la actualización masiva");
    } finally {
      setProcesando(false);
    }
  };

  const toggleSeleccion = (id) => {
    setServicios(prev => 
      prev.map(s => s.id === id ? { ...s, seleccionado: !s.seleccionado } : s)
    );
  };

  const seleccionarTodos = () => {
    setServicios(prev => prev.map(s => ({ ...s, seleccionado: true })));
  };

  const deseleccionarTodos = () => {
    setServicios(prev => prev.map(s => ({ ...s, seleccionado: false })));
  };

  const seleccionarPendientes = () => {
    setServicios(prev => 
      prev.map(s => ({
        ...s,
        seleccionado: (String(s.finalizado || "").toLowerCase() === "no" ||
                       String(s.servicioFinalizado || "").toLowerCase() === "no")
      }))
    );
  };

  const serviciosSeleccionados = servicios.filter(s => s.seleccionado).length;

  return (
    <LayoutWithSidebar>
      <PageHeader titulo="Corrección Masiva de Servicios" />
      
      <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
        <div style={{
          background: "#fee2e2",
          border: "2px solid #dc2626",
          borderRadius: 12,
          padding: 20,
          marginBottom: 20
        }}>
          <h2 style={{ margin: "0 0 12px 0", color: "#991b1b" }}>⚠️ HERRAMIENTA ADMINISTRATIVA</h2>
          <p style={{ margin: 0, color: "#7f1d1d" }}>
            Esta herramienta permite actualizar masivamente el estado de servicios de "no finalizado" a "finalizado".
            <br/><strong>PRECAUCIÓN:</strong> Esta acción actualiza la base de datos directamente.
          </p>
        </div>

        {mensaje && (
          <div style={{
            background: mensaje.includes("❌") ? "#fee2e2" : "#d1fae5",
            color: mensaje.includes("❌") ? "#991b1b" : "#065f46",
            border: `1px solid ${mensaje.includes("❌") ? "#dc2626" : "#10b981"}`,
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            fontWeight: 700
          }}>
            {mensaje}
          </div>
        )}

        <div style={{
          display: "flex",
          gap: 12,
          marginBottom: 20,
          flexWrap: "wrap"
        }}>
          <button
            onClick={cargarServicios}
            disabled={loading}
            style={{
              padding: "12px 20px",
              background: "#0ea5e9",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.5 : 1
            }}
          >
            {loading ? "Cargando..." : "Cargar Servicios"}
          </button>

          <button
            onClick={seleccionarTodos}
            disabled={servicios.length === 0}
            style={{
              padding: "12px 20px",
              background: "#10b981",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
              cursor: servicios.length === 0 ? "not-allowed" : "pointer"
            }}
          >
            Seleccionar Todos ({servicios.length})
          </button>

          <button
            onClick={seleccionarPendientes}
            disabled={servicios.length === 0}
            style={{
              padding: "12px 20px",
              background: "#f59e0b",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
              cursor: servicios.length === 0 ? "not-allowed" : "pointer"
            }}
          >
            Seleccionar Solo Pendientes
          </button>

          <button
            onClick={deseleccionarTodos}
            disabled={servicios.length === 0}
            style={{
              padding: "12px 20px",
              background: "#6b7280",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
              cursor: servicios.length === 0 ? "not-allowed" : "pointer"
            }}
          >
            Deseleccionar Todos
          </button>

          <button
            onClick={corregirMasivo}
            disabled={serviciosSeleccionados === 0 || procesando}
            style={{
              padding: "12px 20px",
              background: "#dc2626",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
              cursor: serviciosSeleccionados === 0 || procesando ? "not-allowed" : "pointer",
              opacity: serviciosSeleccionados === 0 || procesando ? 0.5 : 1
            }}
          >
            {procesando ? "Procesando..." : `Actualizar ${serviciosSeleccionados} Seleccionados`}
          </button>
        </div>

        {servicios.length > 0 && (
          <div style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 16,
            maxHeight: 600,
            overflowY: "auto"
          }}>
            <h3 style={{ margin: "0 0 12px 0" }}>
              Servicios Cargados: {servicios.length} | Seleccionados: {serviciosSeleccionados}
            </h3>
            
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f3f4f6", position: "sticky", top: 0 }}>
                  <th style={{ border: "1px solid #d1d5db", padding: 8 }}>✓</th>
                  <th style={{ border: "1px solid #d1d5db", padding: 8 }}>Consecutivo</th>
                  <th style={{ border: "1px solid #d1d5db", padding: 8 }}>Usuario</th>
                  <th style={{ border: "1px solid #d1d5db", padding: 8 }}>Fecha</th>
                  <th style={{ border: "1px solid #d1d5db", padding: 8 }}>Estado Actual</th>
                </tr>
              </thead>
              <tbody>
                {servicios.map((s) => {
                  const esPendiente = String(s.finalizado || "").toLowerCase() === "no" ||
                                     String(s.servicioFinalizado || "").toLowerCase() === "no";
                  
                  return (
                    <tr 
                      key={s.id}
                      style={{
                        background: esPendiente ? "#fef2f2" : "#f0fdf4"
                      }}
                    >
                      <td style={{ border: "1px solid #d1d5db", padding: 8, textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={s.seleccionado || false}
                          onChange={() => toggleSeleccion(s.id)}
                          style={{ cursor: "pointer", width: 18, height: 18 }}
                        />
                      </td>
                      <td style={{ border: "1px solid #d1d5db", padding: 8 }}>
                        {s.consecutivo || "—"}
                      </td>
                      <td style={{ border: "1px solid #d1d5db", padding: 8 }}>
                        {s.usuario || "—"}
                      </td>
                      <td style={{ border: "1px solid #d1d5db", padding: 8 }}>
                        {s.fecha || "—"}
                      </td>
                      <td style={{ border: "1px solid #d1d5db", padding: 8 }}>
                        <code style={{
                          background: esPendiente ? "#fca5a5" : "#86efac",
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 11
                        }}>
                          {esPendiente ? "PENDIENTE" : "FINALIZADO"}
                        </code>
                        <br/>
                        <small style={{ color: "#6b7280" }}>
                          f:{JSON.stringify(s.finalizado)} | 
                          sf:{JSON.stringify(s.servicioFinalizado)}
                        </small>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </LayoutWithSidebar>
  );
}
